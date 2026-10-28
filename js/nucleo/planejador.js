/*
 * planejador.js — o "Grêmio bem organizado" do jogo.
 *
 * Um jogador automático, determinístico, usado para três coisas:
 *   1. calcular a META de cada partida: ele joga a mesma partida (mesma agenda e mesmos
 *      pedidos) sem imprevistos, e a classificação compara o jogador com ele;
 *   2. sugerir equipes enxutas na janela de iniciar projeto (especialistas primeiro);
 *   3. comparar os coordenadores na janela "Quem vai tocar?".
 * Ele só usa as regras públicas do núcleo: nunca faz nada que o jogador não possa fazer.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function E() { return OG.estado; }
  function R() { return OG.regras; }

  // ---------------- Valor de um card ----------------

  /** Projetos da missão a caminho de contar (em andamento/revisão e ainda no prazo). */
  function aCaminho(estado, missaoId) {
    return estado.cartas.filter(function (c) {
      return c.missaoId === missaoId && (c.coluna === 'andamento' || c.coluna === 'revisao') && E().terminaNoPrazo(estado, c);
    }).length;
  }

  /** Quanto vale concluir o card no prazo, em pontos da pontuação final (estimativa). */
  function valorCarta(estado, c) {
    const proj = E().projetoDaCarta(c);
    let v = (proj.retorno - proj.custo) / R().REAIS_POR_PONTO + proj.prestigio + proj.tradicao + R().PONTOS_POR_PROJETO;
    if (c.missaoId) {
      const entrada = E().entradaAgenda(estado, c.missaoId);
      const m = E().missaoPorId(c.missaoId);
      if (entrada && !entrada.cumprida && !entrada.perdida) {
        const faltam = m.objetivo - E().progressoMissao(estado, c.missaoId) - aCaminho(estado, c.missaoId);
        if (faltam > 0) v += OG.kanban.pontosRecompensa(m.recompensa) / faltam;
      }
    }
    return v;
  }

  // ---------------- Equipe ----------------

  function demandaPorCategoria(estado) {
    const d = {};
    estado.cartas.forEach(function (c) {
      if (c.coluna !== 'backlog' && c.coluna !== 'afazer') return;
      const cat = E().projetoDaCarta(c).categoria;
      d[cat] = (d[cat] || 0) + 1;
    });
    return d;
  }

  /** Quanto o voluntário faria falta em outro projeto (especialistas de categorias muito pedidas). */
  function utilidadeFutura(p, demanda) {
    const e = p.especialidade || {};
    if (e.coringa) return 50;
    let u = (e.categorias || []).reduce(function (s, cat) { return s + (demanda[cat] || 0); }, 0);
    if (e.riscos && e.riscos.length) u += 1;
    return u;
  }

  function ordenarVoluntarios(lista, demanda) {
    return lista.slice().sort(function (a, b) {
      // Temporários primeiro (vão embora de qualquer jeito), depois quem faz menos falta.
      const ta = a.somentePorEvento ? 1 : 0;
      const tb = b.somentePorEvento ? 1 : 0;
      if (ta !== tb) return tb - ta;
      const ua = utilidadeFutura(a, demanda);
      const ub = utilidadeFutura(b, demanda);
      if (ua !== ub) return ua - ub;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }

  /**
   * Menor equipe de voluntários que completa a força do card com o coordenador coordId
   * (ou com o responsável do card). Para card EM ANDAMENTO, completa o que falta.
   * opcoes.excluir: ids que não podem entrar. Retorna { equipe, forca } ou null.
   */
  function montarEquipe(estado, c, coordId, opcoes) {
    const proj = E().projetoDaCarta(c);
    const coord = coordId || c.responsavel;
    const emAndamento = c.coluna === 'andamento';
    const restante = emAndamento ? c.tempoTotal - c.progresso : E().tempoComCoordenador(proj, coord);
    const jaNaEquipe = emAndamento ? c.equipe : [];
    const precisa = E().forcaNecessaria(proj) - E().forcaDaEquipe(proj, true, jaNaEquipe);
    if (precisa <= 0) return { equipe: [], forca: 0 };
    const excluir = (opcoes && opcoes.excluir) || [];
    const demanda = (opcoes && opcoes.demanda) || demandaPorCategoria(estado);
    const livres = E().voluntariosLivres(estado).filter(function (p) {
      return excluir.indexOf(p.id) === -1 && E().rodadasRestantes(estado, p.id) >= restante;
    });
    const esp = ordenarVoluntarios(livres.filter(function (p) { return E().ehEspecialista(p, proj); }), demanda);
    const outros = ordenarVoluntarios(livres.filter(function (p) { return !E().ehEspecialista(p, proj); }), demanda);

    const equipe = [];
    let forca = 0;
    const k = Math.min(esp.length, Math.ceil(precisa / R().FORCA_ESPECIALISTA));
    for (let i = 0; i < k; i++) {
      equipe.push(esp[i].id);
      forca += R().FORCA_ESPECIALISTA;
    }
    for (let j = 0; forca < precisa && j < outros.length; j++) {
      equipe.push(outros[j].id);
      forca += R().FORCA_VOLUNTARIO;
    }
    if (forca < precisa) return null;
    return { equipe: equipe, forca: forca };
  }

  // ---------------- Coordenadores ----------------

  /**
   * Compara os 5 coordenadores para um card (janela "Quem vai tocar?").
   * Para cada um: tempo de execução, se está na área, quando conseguiria começar,
   * em que rodada o card poderia ser revisado e se isso cabe no prazo.
   */
  function avaliarCoordenadores(estado, c) {
    const proj = E().projetoDaCarta(c);
    const n = E().totalRodadas(estado);
    const lista = E().coordenadores().map(function (p) {
      const tempo = E().tempoComCoordenador(proj, p.id);
      const st = E().statusPessoa(estado, p.id);
      const fila = E().filaDe(estado, p.id).filter(function (x) { return x.id !== c.id; });
      let impedimento = null;
      try {
        OG.kanban.validarResponsavel(estado, c, p.id);
      } catch (erro) {
        if (!(erro instanceof OG.estado.ErroDeRegra)) throw erro;
        impedimento = erro.message;
      }
      let comecaEm = estado.rodada;
      if (st.codigo === 'tocando') {
        const atual = E().carta(estado, st.cartaId);
        comecaEm = estado.rodada + (atual.tempoTotal - atual.progresso);
      } else if (st.codigo === 'doente') {
        comecaEm = estado.rodada + 1;
      }
      fila.forEach(function (f) { comecaEm += E().tempoTotal(f, p.id); });
      const revisaoEm = comecaEm + tempo;
      return {
        coordId: p.id,
        nome: p.nome,
        tempo: tempo,
        naArea: E().naArea(p.id, proj),
        status: st,
        fila: fila.length,
        impedimento: impedimento,
        comecaEm: comecaEm,
        revisaoEm: revisaoEm,
        noPrazo: revisaoEm <= Math.min(c.prazo, n),
        recomendado: false,
      };
    });
    const candidatos = lista.filter(function (x) { return !x.impedimento; }).sort(function (a, b) {
      if (a.noPrazo !== b.noPrazo) return a.noPrazo ? -1 : 1;
      if (a.revisaoEm !== b.revisaoEm) return a.revisaoEm - b.revisaoEm;
      if (a.naArea !== b.naArea) return a.naArea ? -1 : 1;
      // Sumindo (coringa) fica por último no empate: ele serve para tudo.
      const ca = E().pessoa(a.coordId).area.coringa ? 1 : 0;
      const cb = E().pessoa(b.coordId).area.coringa ? 1 : 0;
      if (ca !== cb) return ca - cb;
      return a.fila - b.fila;
    });
    if (candidatos.length) candidatos[0].recomendado = true;
    return lista;
  }

  // ---------------- Política ----------------

  function decidirEvento(estado) {
    const opcoes = OG.eventos.opcoesEvento(estado).filter(function (o) { return o.habilitado; });
    let escolha = opcoes[0].id;
    if (estado.eventoAtual.id === 'ev_impressoes') {
      const pagar = opcoes.some(function (o) { return o.id === 'pagar'; });
      // R$ 40 valem 4 pontos; recusar custa 5 de prestígio. Paga se o caixa aguenta.
      escolha = pagar && OG.financas.caixa(estado) - OG.dados.despesas.impressoes.valor >= 100 ? 'pagar' : 'recusar';
    }
    return { tipo: 'CONFIRMAR_EVENTO', escolha: escolha };
  }

  /** Pontos perdidos se o card ficar parado 1 rodada (ou voltar para A FAZER). */
  function perdaSeParar(estado, c, voltar) {
    const proj = E().projetoDaCarta(c);
    const n = E().totalRodadas(estado);
    // Parado agora, volta a andar na próxima rodada; quem voltou para A FAZER recomeça do zero.
    const restante = voltar ? c.tempoTotal : c.tempoTotal - c.progresso;
    const revisao = estado.rodada + 1 + restante;
    if (revisao <= Math.min(c.prazo, n)) return voltar ? 2 : 0.5; // atrasa, mas ainda cabe no prazo
    const valorNoPrazo = valorCarta(estado, c);
    if (revisao <= n) {
      // Vira entrega atrasada: sobra só metade do retorno.
      return valorNoPrazo - Math.floor(proj.retorno * R().FRACAO_RETORNO_ATRASADO) / R().REAIS_POR_PONTO;
    }
    return valorNoPrazo; // não termina mais
  }

  function decidirFimDeRodada(estado) {
    const dec = OG.eventos.decisaoFimRodada(estado);
    const def = E().definicaoEvento(dec.eventoId);
    let melhor = null;
    dec.opcoes.forEach(function (o) {
      if (!o.habilitado) return;
      let custo;
      if (o.id === 'pagar') {
        custo = OG.dados.despesas[def.despesa].valor / R().REAIS_POR_PONTO;
      } else if (o.id === 'parar') {
        custo = E().cartasNaColuna(estado, 'andamento')
          .filter(function (c) { return E().projetoDaCarta(c).riscos.indexOf(def.risco) !== -1; })
          .reduce(function (s, c) { return s + perdaSeParar(estado, c, false); }, 0);
      } else {
        const partes = o.id.split(':');
        const c = E().carta(estado, partes[1]);
        custo = perdaSeParar(estado, c, partes[0] === 'voltar');
      }
      if (!melhor || custo < melhor.custo) melhor = { id: o.id, custo: custo };
    });
    return { tipo: 'RESOLVER_DECISAO', escolha: melhor.id };
  }

  function folgaDe(estado, c) {
    if (!c) return Infinity;
    return Math.min(c.prazo, E().totalRodadas(estado)) - E().rodadaDeRevisaoPrevista(estado, c);
  }

  function revisoesFeitas(estado, coordId) {
    return estado.cartas.filter(function (c) { return c.revisor === coordId; }).length;
  }

  function decidirRevisao(estado, somenteUrgentes) {
    const r = estado.rodada;
    const ultima = E().ultimaRodada(estado);
    const revisaveis = E().cartasNaColuna(estado, 'revisao')
      .filter(function (c) { return !E().bloqueioDaCarta(estado, c); })
      .sort(function (a, b) {
        const ua = a.prazo === r ? 0 : 1;
        const ub = b.prazo === r ? 0 : 1;
        if (ua !== ub) return ua - ub;
        return valorCarta(estado, b) - valorCarta(estado, a);
      });
    for (let i = 0; i < revisaveis.length; i++) {
      const c = revisaveis[i];
      const urgente = c.prazo === r || ultima;
      if (somenteUrgentes && !urgente) continue;
      try {
        OG.kanban.validarPreRevisao(estado, c);
      } catch (erro) {
        if (erro instanceof OG.estado.ErroDeRegra) continue;
        throw erro;
      }
      const possiveis = OG.kanban.revisoresPossiveis(estado, c);
      const gratis = possiveis
        .filter(function (p) { return !E().projetoParadoSeRevisar(estado, p.id); })
        .sort(function (a, b) { return revisoesFeitas(estado, a.id) - revisoesFeitas(estado, b.id); });
      if (gratis.length) return { tipo: 'REVISAR', cartaId: c.id, revisorId: gratis[0].id };
      if (!urgente) continue;
      // Só revisores no meio de um projeto: revisa se o atraso do projeto dele não custa mais.
      const caros = possiveis.slice().sort(function (a, b) {
        return folgaDe(estado, E().projetoParadoSeRevisar(estado, b.id)) - folgaDe(estado, E().projetoParadoSeRevisar(estado, a.id));
      });
      if (caros.length) {
        const parado = E().projetoParadoSeRevisar(estado, caros[0].id);
        const perda = parado ? perdaSeParar(estado, parado, false) : 0;
        const ganho = valorCarta(estado, c) - (ultima ? 0 : Math.floor(E().projetoDaCarta(c).retorno * R().FRACAO_RETORNO_ATRASADO) / R().REAIS_POR_PONTO);
        if (ganho > perda) return { tipo: 'REVISAR', cartaId: c.id, revisorId: caros[0].id };
      }
    }
    return null;
  }

  function movimentoPermitido(estado, cartaId) {
    if (!E().eventoAtivo(estado, 'ev_provas')) return true;
    const movidas = estado.cartasMovidasNaRodada;
    return movidas.indexOf(cartaId) !== -1 || movidas.length < R().LIMITE_MOVIMENTOS_PROVAS;
  }

  /** Melhor projeto para começar agora (com qual coordenador e qual equipe), ou null. */
  function melhorInicio(estado, opcoes) {
    if (E().eventoAtivo(estado, 'ev_chimarrao') &&
      OG.kanban.iniciadosNaRodada(estado).length >= R().LIMITE_INICIOS_CHIMARRAO) return null;
    const livres = E().coordenadoresLivres(estado);
    if (!livres.length) return null;
    const caixa = OG.financas.caixa(estado);
    const reserva = (opcoes && opcoes.reserva) || 0;
    const demanda = demandaPorCategoria(estado);
    const cartas = estado.cartas.filter(function (c) { return c.coluna === 'backlog' || c.coluna === 'afazer'; });
    let melhor = null;

    livres.forEach(function (coord) {
      cartas.forEach(function (c) {
        if (c.coluna === 'afazer' && c.responsavel !== coord.id) return;
        if (E().bloqueioDaCarta(estado, c)) return;
        if (!movimentoPermitido(estado, c.id)) return;
        if (c.coluna === 'backlog' && E().filaDe(estado, coord.id).length >= R().FILA_POR_COORDENADOR) return;
        if (!E().terminaNoPrazo(estado, c, coord.id)) return;
        const time = montarEquipe(estado, c, coord.id, { demanda: demanda });
        if (!time) return;
        const custo = c.custoPago !== null ? 0 : OG.financas.calcularCusto(estado, c, time.equipe).final;
        if (custo > caixa - reserva) return;
        const proj = E().projetoDaCarta(c);
        const tempo = E().tempoComCoordenador(proj, coord.id);
        let nota = valorCarta(estado, c) / tempo - 0.75 * time.equipe.length;
        // Sumindo serve para tudo: não gastar o coringa onde outro coordenador livre é da área.
        if (coord.area.coringa && livres.some(function (o) { return o.id !== coord.id && E().naArea(o.id, proj); })) nota -= 3;
        if (!melhor || nota > melhor.nota) melhor = { nota: nota, carta: c, coord: coord, equipe: time.equipe };
      });
    });
    if (!melhor) return null;
    if (melhor.carta.coluna === 'backlog') {
      return { tipo: 'PLANEJAR', cartaId: melhor.carta.id, responsavel: melhor.coord.id };
    }
    return { tipo: 'INICIAR', cartaId: melhor.carta.id, equipe: melhor.equipe };
  }

  function decidirPlanejamento(estado, opcoes) {
    const provas = E().eventoAtivo(estado, 'ev_provas');

    // 1. Revisões que não podem esperar (e, sem Semana de Provas, todas as gratuitas).
    const revisao = decidirRevisao(estado, provas);
    if (revisao) return revisao;

    // 2. Mutirão no card que mais ganha com +1 de execução.
    if (OG.kanban.mutiraoDisponivel(estado)) {
      const alvos = E().cartasNaColuna(estado, 'andamento').filter(function (c) { return !E().bloqueioDaCarta(estado, c); });
      if (alvos.length) {
        alvos.sort(function (a, b) {
          const fa = a.tempoTotal - a.progresso === 1 ? 0 : 1;
          const fb = b.tempoTotal - b.progresso === 1 ? 0 : 1;
          if (fa !== fb) return fa - fb;
          return valorCarta(estado, b) - valorCarta(estado, a);
        });
        return { tipo: 'USAR_MUTIRAO', cartaId: alvos[0].id };
      }
    }

    // 3. Completar equipes desfalcadas (ex.: Patrício foi embora).
    const desfalcadas = E().cartasNaColuna(estado, 'andamento').filter(function (c) {
      return E().forcaDaCarta(c) < E().forcaNecessaria(E().projetoDaCarta(c));
    });
    for (let i = 0; i < desfalcadas.length; i++) {
      const time = montarEquipe(estado, desfalcadas[i]);
      if (time && time.equipe.length) {
        return { tipo: 'COMPLETAR_EQUIPE', cartaId: desfalcadas[i].id, pessoaId: time.equipe[0] };
      }
    }

    // 4. Começar projetos.
    const inicio = melhorInicio(estado, opcoes);
    if (inicio) return inicio;

    // 5. Na Semana de Provas, as revisões que sobraram de movimento.
    if (provas) {
      const resto = decidirRevisao(estado, false);
      if (resto) return resto;
    }

    return { tipo: 'ENCERRAR_RODADA' };
  }

  /** Próxima ação do planejador para o estado atual. */
  function decidir(estado, opcoes) {
    switch (estado.fase) {
      case 'evento': return decidirEvento(estado);
      case 'decisao': return decidirFimDeRodada(estado);
      case 'resumo': return { tipo: 'AVANCAR' };
      case 'planejamento': return decidirPlanejamento(estado, opcoes || {});
      default: return null;
    }
  }

  /** Joga uma partida inteira com o planejador. Por padrão, sem imprevistos (para a meta). */
  function simular(config, opcoes) {
    const neutros = !opcoes || opcoes.eventosNeutros !== false;
    const estado = OG.motor.criarPartida(config, { eventosNeutros: neutros });
    let passos = 0;
    while (estado.fase !== 'fim') {
      OG.motor.aplicarNoLugar(estado, decidir(estado, opcoes));
      if (++passos > 20000) throw new Error('O planejador não terminou a partida.');
    }
    return estado;
  }

  OG.planejador = {
    valorCarta,
    montarEquipe,
    avaliarCoordenadores,
    decidir,
    simular,
  };
})(globalThis);
