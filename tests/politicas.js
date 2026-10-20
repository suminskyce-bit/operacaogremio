/*
 * Jogadores automáticos usados na simulação de balanceamento e nos testes.
 * Eles só usam a API pública do motor (OG.motor.aplicar), como a interface.
 *
 *  - bom:        planeja a missão, usa especialistas, paga quando compensa
 *  - parado:     não move nenhum card (linha de base)
 *  - aleatorio:  ações aleatórias, válidas ou não (fuzzing)
 *  - gastador:   prioriza projetos caros/longos e sempre paga
 *  - economico:  prioriza projetos baratos e evita pagar despesas opcionais
 *  - prestigio:  prioriza ganho de prestígio
 *  - descuidado: esquece revisões e inicia projetos até na última rodada
 */
'use strict';

function criarPoliticas(OG) {
  const E = OG.estado;
  const R = OG.regras;

  function valorCarta(c, foco) {
    const p = E.projetoDaCarta(c);
    const dinheiro = (p.retorno - p.custo) / R.REAIS_POR_PONTO;
    if (foco === 'prestigio') return p.prestigio * 3 + p.tradicao + dinheiro * 0.5 + R.PONTOS_POR_PROJETO;
    return dinheiro + p.prestigio + p.tradicao + R.PONTOS_POR_PROJETO;
  }

  function equipeSugerida(estado, c, preferirVoluntarios) {
    const proj = E.projetoDaCarta(c);
    const cand = OG.kanban.candidatos(estado, c);
    const pontua = function (p) {
      let s = 0;
      if (E.ehEspecialista(p, proj)) s += 10;
      if (preferirVoluntarios && p.papel === 'coordenador') s -= 3;
      if (p.somentePorEvento) s += 1; // usa o temporário enquanto ele está aqui
      return s;
    };
    return cand
      .slice()
      .sort(function (a, b) { return pontua(b) - pontua(a); })
      .slice(0, proj.trabalhadores)
      .map(function (p) { return p.id; });
  }

  function revisorSugerido(estado) {
    const livres = E.coordenadoresLivres(estado);
    if (!livres.length) return null;
    // Prefere quem não é especialista dos cards que ainda vão começar.
    const futuros = estado.cartas.filter(function (c) { return c.coluna === 'backlog' || c.coluna === 'afazer'; });
    const utilidade = function (p) {
      return futuros.filter(function (c) { return E.ehEspecialista(p, E.projetoDaCarta(c)); }).length;
    };
    return livres.slice().sort(function (a, b) { return utilidade(a) - utilidade(b); })[0].id;
  }

  function podeIniciarAgora(estado, c) {
    try {
      OG.kanban.validarPreInicio(estado, c);
      return true;
    } catch (erro) {
      return false;
    }
  }

  function podePlanejarAgora(estado, c) {
    return OG.kanban.avaliarMovimento(estado, c.id, 'afazer').ok;
  }

  /** Capacidade (vagas-rodada) que ainda resultam em conclusão, a partir desta rodada. */
  function capacidadeRestante(estado) {
    let total = 0;
    for (let r = estado.rodada; r <= R.TOTAL_RODADAS - 1; r++) {
      let ocupadas = 0;
      E.cartasNaColuna(estado, 'andamento').forEach(function (c) {
        const p = E.projetoDaCarta(c);
        const restante = p.tempo - c.progresso;
        if (r < estado.rodada + restante) ocupadas++;
      });
      let vagas = R.LIMITE_EM_ANDAMENTO - ocupadas;
      if (r === estado.rodada) {
        if (E.eventoAtivo(estado, 'ev_chimarrao')) {
          vagas = Math.min(vagas, OG.kanban.iniciadosNaRodada(estado).length ? 0 : 1);
        }
        if (E.eventoAtivo(estado, 'ev_provas')) {
          // Só um card se move na rodada, mas ele pode ir do BACKLOG até EM ANDAMENTO.
          const movidas = estado.cartasMovidasNaRodada;
          const aindaPodeIniciar = movidas.length === 0 ||
            (movidas.length === 1 && E.carta(estado, movidas[0]).coluna === 'afazer');
          vagas = Math.min(vagas, aindaPodeIniciar ? 1 : 0);
        }
      }
      total += Math.max(0, vagas);
    }
    return total;
  }

  /**
   * Escolhe quais cards ainda vale a pena começar (planejamento ótimo por força bruta,
   * são no máximo 6 cards). Retorna os ids na ordem de prioridade de início.
   */
  function planoIdeal(estado, foco) {
    const m = E.missao(estado);
    const disponiveis = estado.cartas.filter(function (c) {
      return (c.coluna === 'backlog' || c.coluna === 'afazer') && E.terminaATempo(estado, c);
    });
    const garantidos = E.totalConcluidos(estado) +
      E.cartasNaColuna(estado, 'revisao').length +
      E.cartasNaColuna(estado, 'andamento').filter(function (c) { return E.terminaATempo(estado, c); }).length;
    const capacidade = capacidadeRestante(estado);
    const bonusMissao = estado.missaoCumprida ? 0 :
      m.recompensa.dinheiro / R.REAIS_POR_PONTO + m.recompensa.prestigio + m.recompensa.tradicao;

    let melhor = { valor: -Infinity, cartas: [] };
    const n = disponiveis.length;
    for (let mask = 0; mask < (1 << n); mask++) {
      const escolhidos = [];
      let usado = 0;
      let valor = 0;
      for (let i = 0; i < n; i++) {
        if (mask & (1 << i)) {
          const c = disponiveis[i];
          escolhidos.push(c);
          usado += E.projetoDaCarta(c).tempo - c.progresso;
          valor += valorCarta(c, foco);
        }
      }
      if (usado > capacidade) continue;
      // Projetos de 2 rodadas só cabem se começarem até a penúltima rodada útil.
      if (!estado.missaoCumprida && garantidos + escolhidos.length >= m.objetivo) valor += bonusMissao;
      // Desempate: menos projetos longos (menos risco de evento).
      valor -= escolhidos.filter(function (c) { return E.projetoDaCarta(c).tempo > 1; }).length * 0.5;
      if (valor > melhor.valor) melhor = { valor: valor, cartas: escolhidos };
    }
    return melhor.cartas
      .slice()
      .sort(function (a, b) {
        const ta = E.projetoDaCarta(a).tempo - a.progresso;
        const tb = E.projetoDaCarta(b).tempo - b.progresso;
        if (ta !== tb) return tb - ta; // longos primeiro (precisam de tempo)
        return valorCarta(b, foco) - valorCarta(a, foco);
      })
      .map(function (c) { return c.id; });
  }

  function arriscadoNestaRodada(estado, c) {
    const p = E.projetoDaCarta(c);
    const ev = estado.eventoAtual && estado.eventoAtual.id;
    const def = ev && E.definicaoEvento(ev);
    if (!def || !def.risco || def.quando !== 'fim') return false;
    return p.riscos.indexOf(def.risco) !== -1;
  }

  function decisaoEvento(estado, opts) {
    const opcoes = OG.eventos.opcoesEvento(estado).filter(function (o) { return o.habilitado; });
    let escolha = opcoes[0].id;
    if (estado.eventoAtual.id === 'ev_impressoes') {
      const caixa = OG.financas.caixa(estado);
      const pagar = opcoes.find(function (o) { return o.id === 'pagar'; });
      if (opts.sempreRecusa || !pagar) escolha = 'recusar';
      else if (opts.sempreLeva) escolha = 'pagar';
      else escolha = caixa - 40 >= 120 ? 'pagar' : 'recusar';
    }
    return { tipo: 'CONFIRMAR_EVENTO', escolha: escolha, rodada: estado.rodada };
  }

  function decisaoFim(estado, opts) {
    const dec = OG.eventos.decisaoFimRodada(estado);
    const habilitadas = dec.opcoes.filter(function (o) { return o.habilitado; });
    const pagar = habilitadas.find(function (o) { return o.id === 'pagar'; });
    const ultima = estado.rodada >= R.TOTAL_RODADAS;
    if (pagar && !ultima && !opts.sempreRecusa) {
      // Pagar só se algum projeto afetado ainda termina a tempo.
      const afetados = habilitadas.filter(function (o) { return o.id !== 'pagar'; });
      const importa = afetados.some(function (o) {
        const id = o.id.split(':')[1];
        if (!id) return true;
        const c = E.carta(estado, id);
        return E.terminaATempo(estado, c);
      });
      if (importa || opts.sempreLeva) return { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' };
    }
    // Escolhe o card cuja perda dói menos (que não termina a tempo ou vale menos).
    const naoPagar = habilitadas.filter(function (o) { return o.id !== 'pagar'; });
    const custoDaPerda = function (o) {
      const id = o.id.split(':')[1];
      if (!id) return 0;
      const c = E.carta(estado, id);
      const p = E.projetoDaCarta(c);
      // Ficar parado atrasa 1 rodada: perde se deixaria de terminar a tempo.
      const aindaTermina = estado.rodada + 1 + (p.tempo - c.progresso) <= R.TOTAL_RODADAS;
      return aindaTermina ? 1 : valorCarta(c);
    };
    naoPagar.sort(function (a, b) { return custoDaPerda(a) - custoDaPerda(b); });
    return { tipo: 'RESOLVER_DECISAO', escolha: (naoPagar[0] || habilitadas[0]).id };
  }

  function planejamento(estado, opts) {
    const rodada = estado.rodada;

    // 1. Revisões (na Semana de Provas, só se não houver início melhor).
    const provas = E.eventoAtivo(estado, 'ev_provas');
    const revisaveis = E.cartasNaColuna(estado, 'revisao').filter(function (c) {
      return OG.kanban.avaliarMovimento(estado, c.id, 'concluido').ok;
    });
    const esquecer = opts.esqueceRevisao && (rodada % 2 === 0);
    if (revisaveis.length && !esquecer) {
      const preferirInicio = provas && rodada < R.TOTAL_RODADAS && planoIdeal(estado, opts.foco).some(function (id) {
        return podeIniciarAgora(estado, E.carta(estado, id)) || podePlanejarAgora(estado, E.carta(estado, id));
      });
      if (!preferirInicio) {
        const revisor = revisorSugerido(estado);
        if (revisor) return { tipo: 'REVISAR', cartaId: revisaveis[0].id, revisorId: revisor, rodada: rodada };
      }
    }

    // 2. Mutirão: no card que mais ganha com +1 de progresso.
    if (OG.kanban.mutiraoDisponivel(estado)) {
      const alvos = E.cartasNaColuna(estado, 'andamento').filter(function (c) { return !E.bloqueioDaCarta(estado, c); });
      if (alvos.length) {
        alvos.sort(function (a, b) {
          const ra = E.projetoDaCarta(a).tempo - a.progresso;
          const rb = E.projetoDaCarta(b).tempo - b.progresso;
          return rb - ra || valorCarta(b) - valorCarta(a);
        });
        return { tipo: 'USAR_MUTIRAO', cartaId: alvos[0].id, rodada: rodada };
      }
    }

    // 3. Completar equipe incompleta.
    const incompleta = E.cartasNaColuna(estado, 'andamento').find(function (c) {
      return c.equipe.length < E.projetoDaCarta(c).trabalhadores;
    });
    if (incompleta) {
      const cand = OG.kanban.candidatos(estado, incompleta);
      if (cand.length) return { tipo: 'COMPLETAR_EQUIPE', cartaId: incompleta.id, pessoaId: cand[0].id, rodada: rodada };
    }

    // 4. Iniciar projetos.
    if (E.cartasNaColuna(estado, 'andamento').length < R.LIMITE_EM_ANDAMENTO) {
      // Semana de Provas: o card que já se moveu é o único que pode continuar.
      if (provas && estado.cartasMovidasNaRodada.length === 1) {
        const movida = E.carta(estado, estado.cartasMovidasNaRodada[0]);
        if (movida.coluna === 'afazer' && podeIniciarAgora(estado, movida)) {
          return { tipo: 'INICIAR', cartaId: movida.id, equipe: equipeSugerida(estado, movida, true), rodada: rodada };
        }
      }
      let ordem;
      if (opts.ordenar) {
        ordem = estado.cartas
          .filter(function (c) { return c.coluna === 'backlog' || c.coluna === 'afazer'; })
          .filter(function (c) { return opts.ignoraPrazo || E.terminaATempo(estado, c); })
          .sort(opts.ordenar)
          .map(function (c) { return c.id; });
      } else {
        ordem = planoIdeal(estado, opts.foco);
        // Evita expor ao risco de fim de rodada se houver alternativa.
        const seguros = ordem.filter(function (id) { return !arriscadoNestaRodada(estado, E.carta(estado, id)); });
        if (seguros.length) ordem = seguros.concat(ordem.filter(function (id) { return seguros.indexOf(id) === -1; }));
      }
      for (let i = 0; i < ordem.length; i++) {
        const c = E.carta(estado, ordem[i]);
        if (c.coluna === 'backlog') {
          if (podePlanejarAgora(estado, c)) return { tipo: 'PLANEJAR', cartaId: c.id, rodada: rodada };
          continue;
        }
        if (podeIniciarAgora(estado, c)) {
          const equipe = equipeSugerida(estado, c, true);
          const v = OG.motor.aplicar(estado, { tipo: 'INICIAR', cartaId: c.id, equipe: equipe });
          if (v.ok) return { tipo: 'INICIAR', cartaId: c.id, equipe: equipe, rodada: rodada };
        }
      }
    }

    return { tipo: 'ENCERRAR_RODADA', rodada: rodada };
  }

  function politicaGuiada(nome, opts) {
    opts = opts || {};
    return {
      nome: nome,
      decidir: function (estado) {
        switch (estado.fase) {
          case 'evento': return decisaoEvento(estado, opts);
          case 'decisao': return decisaoFim(estado, opts);
          case 'resumo': return { tipo: 'AVANCAR' };
          case 'planejamento': return planejamento(estado, opts);
          default: return null;
        }
      },
    };
  }

  const custo = function (c) { return E.projetoDaCarta(c).custo; };

  return {
    bom: politicaGuiada('bom'),
    prestigio: politicaGuiada('prestigio', { foco: 'prestigio' }),
    gastador: politicaGuiada('gastador', {
      sempreLeva: true,
      ordenar: function (a, b) {
        return (E.projetoDaCarta(b).tempo - E.projetoDaCarta(a).tempo) || (custo(b) - custo(a));
      },
    }),
    economico: politicaGuiada('economico', {
      sempreRecusa: true,
      ordenar: function (a, b) { return custo(a) - custo(b); },
    }),
    descuidado: politicaGuiada('descuidado', {
      esqueceRevisao: true,
      ignoraPrazo: true,
      ordenar: function (a, b) { return custo(b) - custo(a); },
    }),
    parado: {
      nome: 'parado',
      decidir: function (estado) {
        switch (estado.fase) {
          case 'evento': {
            const op = OG.eventos.opcoesEvento(estado).filter(function (o) { return o.habilitado; });
            const recusar = op.find(function (o) { return o.id === 'recusar'; });
            return { tipo: 'CONFIRMAR_EVENTO', escolha: (recusar || op[0]).id };
          }
          case 'decisao': {
            const dec = OG.eventos.decisaoFimRodada(estado);
            return { tipo: 'RESOLVER_DECISAO', escolha: dec.opcoes.filter(function (o) { return o.habilitado; })[0].id };
          }
          case 'resumo': return { tipo: 'AVANCAR' };
          case 'planejamento': return { tipo: 'ENCERRAR_RODADA' };
          default: return null;
        }
      },
    },
  };
}

/** Joga uma partida inteira. `ajustar(estado)` permite forçar o baralho em cenários de teste. */
function jogarPartida(OG, missaoId, semente, politica, ajustar) {
  let estado = OG.motor.criarPartida(missaoId, semente);
  if (ajustar) estado = ajustar(estado) || estado;
  let menorCaixa = OG.estado.recursos(estado).dinheiro;
  let passos = 0;
  while (estado.fase !== 'fim') {
    const acao = politica.decidir(estado);
    const r = OG.motor.aplicar(estado, acao);
    if (!r.ok) {
      throw new Error('A política "' + politica.nome + '" tentou uma ação inválida: ' + JSON.stringify(acao) + ' -> ' + r.erro);
    }
    estado = r.estado;
    menorCaixa = Math.min(menorCaixa, OG.estado.recursos(estado).dinheiro);
    if (++passos > 400) throw new Error('Partida não terminou (laço infinito?) com a política ' + politica.nome);
  }
  return { estado: estado, menorCaixa: menorCaixa, passos: passos };
}

/** Troca o baralho da partida (antes de confirmar o 1º evento). */
function forcarBaralho(OG, estado, eventos) {
  estado.baralho = eventos.slice();
  estado.historico = estado.historico.filter(function (h) { return h.tipo !== 'evento'; });
  OG.eventos.revelarEvento(estado);
  return estado;
}

module.exports = { criarPoliticas, jogarPartida, forcarBaralho };
