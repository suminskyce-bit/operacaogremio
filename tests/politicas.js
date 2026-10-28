/*
 * Jogadores automáticos usados nos testes e na simulação de balanceamento.
 * Todos usam só a API pública do motor (OG.motor.aplicar), como a interface, e só
 * mandam ações válidas (uma ação recusada derruba a partida simulada com erro).
 *
 *  - planejador:     o "Grêmio bem organizado" do próprio jogo (o mesmo que calcula a
 *                    meta), mas jogando COM os imprevistos do baralho
 *  - semPensar:      faz o fluxo direito (revisa, começa o que dá), mas escolhe
 *                    coordenador, equipe e card ao acaso
 *  - coordAoAcaso:   equipe enxuta com especialistas, coordenador ao acaso
 *  - equipeAoAcaso:  coordenador recomendado, equipe ao acaso (válida)
 *  - semPrioridade:  coordenador recomendado e equipe enxuta, cards por ordem de chegada
 *  - gastador:       começa pelos projetos mais caros e sempre paga as despesas opcionais
 *  - economico:      começa pelos mais baratos e nunca paga despesa opcional
 *  - descuidado:     esquece de revisar nas rodadas pares e começa o que já não cabe no prazo
 *  - parado:         não move nenhum card (linha de base)
 */
'use strict';

function criarRng(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function criarPoliticas(OG) {
  const E = OG.estado;

  function escolher(lista, rnd) {
    return lista[Math.floor(rnd() * lista.length)];
  }

  function embaralhar(lista, rnd) {
    const l = lista.slice();
    for (let i = l.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = l[i];
      l[i] = l[j];
      l[j] = t;
    }
    return l;
  }

  function regra(fn) {
    try {
      fn();
      return true;
    } catch (erro) {
      if (erro instanceof OG.estado.ErroDeRegra) return false;
      throw erro;
    }
  }

  /** Equipe válida (força suficiente e ninguém sobrando) escolhida ao acaso, ou null. */
  function equipeAoAcaso(estado, c, rnd) {
    const proj = E.projetoDaCarta(c);
    const precisa = E.forcaNecessaria(proj);
    const equipe = [];
    embaralhar(OG.kanban.candidatos(estado, c), rnd).forEach(function (p) {
      if (E.forcaDaEquipe(proj, true, equipe) < precisa) equipe.push(p.id);
    });
    if (E.forcaDaEquipe(proj, true, equipe) < precisa) return null;
    let sobrando = E.voluntariosSobrando(proj, equipe);
    while (sobrando.length) {
      equipe.splice(equipe.indexOf(escolher(sobrando, rnd)), 1);
      sobrando = E.voluntariosSobrando(proj, equipe);
    }
    return equipe;
  }

  function montarEquipe(estado, c, opts, rnd) {
    if (opts.equipe === 'acaso') return equipeAoAcaso(estado, c, rnd);
    const t = OG.planejador.montarEquipe(estado, c);
    return t ? t.equipe : null;
  }

  // ---------------- Eventos ----------------

  function decidirEvento(estado, opts) {
    if (opts.pagar === 'planejador') return OG.planejador.decidir(estado);
    const habilitadas = OG.eventos.opcoesEvento(estado).filter(function (o) { return o.habilitado; });
    const preferida = opts.pagar === 'sempre' ? 'pagar' : 'recusar';
    const op = habilitadas.find(function (o) { return o.id === preferida; }) || habilitadas[0];
    return { tipo: 'CONFIRMAR_EVENTO', escolha: op.id, rodada: estado.rodada };
  }

  function decidirFim(estado, opts, rnd) {
    if (opts.pagar === 'planejador') return OG.planejador.decidir(estado);
    const habilitadas = OG.eventos.decisaoFimRodada(estado).opcoes.filter(function (o) { return o.habilitado; });
    const pagar = habilitadas.find(function (o) { return o.id === 'pagar'; });
    if (opts.pagar === 'sempre' && pagar) return { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' };
    const outras = habilitadas.filter(function (o) { return o.id !== 'pagar'; });
    return { tipo: 'RESOLVER_DECISAO', escolha: (outras.length ? escolher(outras, rnd) : habilitadas[0]).id };
  }

  // ---------------- Planejamento ----------------

  function planejamento(estado, opts, rnd) {
    const ordenar = function (lista) {
      if (opts.ordem === 'acaso') return embaralhar(lista, rnd);
      if (opts.ordem) return lista.slice().sort(opts.ordem);
      return lista; // ordem do quadro (chegada)
    };

    // 1. Revisões (prefere quem não tem projeto que ficaria parado: o aviso aparece na interface).
    const esquece = opts.esqueceRevisao && estado.rodada % 2 === 0;
    if (!esquece) {
      const revisaveis = E.cartasNaColuna(estado, 'revisao');
      for (let i = 0; i < revisaveis.length; i++) {
        const c = revisaveis[i];
        if (!regra(function () { OG.kanban.validarPreRevisao(estado, c); })) continue;
        const possiveis = OG.kanban.revisoresPossiveis(estado, c);
        const gratis = possiveis.filter(function (p) { return !E.projetoParadoSeRevisar(estado, p.id); });
        const lista = gratis.length ? gratis : possiveis;
        if (lista.length) return { tipo: 'REVISAR', cartaId: c.id, revisorId: escolher(lista, rnd).id, rodada: estado.rodada };
      }
    }

    // 2. Mutirão no primeiro card que puder usar.
    if (OG.kanban.mutiraoDisponivel(estado)) {
      const alvo = E.cartasNaColuna(estado, 'andamento').find(function (c) { return !E.bloqueioDaCarta(estado, c); });
      if (alvo) return { tipo: 'USAR_MUTIRAO', cartaId: alvo.id };
    }

    // 3. Completar equipe desfalcada.
    const andamento = E.cartasNaColuna(estado, 'andamento');
    for (let i = 0; i < andamento.length; i++) {
      const c = andamento[i];
      if (E.forcaDaCarta(c) >= E.forcaNecessaria(E.projetoDaCarta(c))) continue;
      const cand = OG.kanban.candidatos(estado, c);
      if (cand.length) return { tipo: 'COMPLETAR_EQUIPE', cartaId: c.id, pessoaId: escolher(cand, rnd).id };
    }

    // 4. Iniciar o que já está em A Fazer.
    const afazer = ordenar(E.cartasNaColuna(estado, 'afazer'));
    for (let i = 0; i < afazer.length; i++) {
      const c = afazer[i];
      if (!regra(function () { OG.kanban.validarPreInicio(estado, c); })) continue;
      if (!opts.ignoraPrazo && !E.terminaNoPrazo(estado, c)) continue;
      const equipe = montarEquipe(estado, c, opts, rnd);
      if (!equipe) continue;
      const acao = { tipo: 'INICIAR', cartaId: c.id, equipe: equipe };
      if (OG.motor.aplicar(estado, acao).ok) return acao;
    }

    // 5. Planejar: Backlog -> A Fazer.
    const livres = E.coordenadoresLivres(estado).filter(function (p) { return E.filaDe(estado, p.id).length === 0; });
    if (livres.length) {
      const backlog = ordenar(E.cartasNaColuna(estado, 'backlog').filter(function (c) {
        return opts.ignoraPrazo || E.terminaNoPrazo(estado, c, 'sumindo');
      }));
      for (let i = 0; i < backlog.length; i++) {
        const c = backlog[i];
        let coordId;
        if (opts.coord === 'recomendado') {
          const rec = OG.planejador.avaliarCoordenadores(estado, c).find(function (x) { return x.recomendado; });
          if (!rec) continue;
          coordId = rec.coordId;
        } else {
          coordId = escolher(livres, rnd).id;
        }
        const acao = { tipo: 'PLANEJAR', cartaId: c.id, responsavel: coordId };
        if (OG.motor.aplicar(estado, acao).ok) return acao;
      }
    }

    return { tipo: 'ENCERRAR_RODADA', rodada: estado.rodada };
  }

  function guiada(nome, opts) {
    const o = Object.assign({ coord: 'recomendado', equipe: 'enxuta', ordem: null, pagar: 'planejador' }, opts || {});
    return {
      nome: nome,
      criar: function (semente) {
        const rnd = criarRng((semente || 1) * 2654435761);
        return function (estado) {
          switch (estado.fase) {
            case 'evento': return decidirEvento(estado, o, rnd);
            case 'decisao': return decidirFim(estado, o, rnd);
            case 'resumo': return { tipo: 'AVANCAR' };
            case 'planejamento': return planejamento(estado, o, rnd);
            default: return null;
          }
        };
      },
    };
  }

  const custo = function (a, b) { return E.projetoDaCarta(a).custo - E.projetoDaCarta(b).custo; };

  return {
    planejador: {
      nome: 'planejador',
      criar: function () {
        return function (estado) { return OG.planejador.decidir(estado); };
      },
    },
    semPensar: guiada('semPensar', { coord: 'acaso', equipe: 'acaso', ordem: 'acaso' }),
    coordAoAcaso: guiada('coordAoAcaso', { coord: 'acaso', ordem: 'acaso' }),
    equipeAoAcaso: guiada('equipeAoAcaso', { equipe: 'acaso', ordem: 'acaso' }),
    semPrioridade: guiada('semPrioridade', {}),
    gastador: guiada('gastador', { pagar: 'sempre', ordem: function (a, b) { return custo(b, a); } }),
    economico: guiada('economico', { pagar: 'nunca', ordem: custo }),
    descuidado: guiada('descuidado', { coord: 'acaso', esqueceRevisao: true, ignoraPrazo: true, ordem: 'acaso' }),
    parado: {
      nome: 'parado',
      criar: function () {
        return function (estado) {
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
        };
      },
    },
  };
}

/** Quem está trabalhando agora: responsáveis e equipes EM ANDAMENTO, e quem revisou na rodada. */
function ocupados(OG, estado) {
  const s = new Set();
  OG.estado.cartasNaColuna(estado, 'andamento').forEach(function (c) {
    s.add(c.responsavel);
    c.equipe.forEach(function (id) { s.add(id); });
  });
  estado.revisoresDaRodada.forEach(function (id) { s.add(id); });
  return s;
}

/**
 * Joga uma partida inteira.
 *   config:  { missaoId, duracao, semente, caixaApertado }
 *   opcoes:  { ajustar(estado) (ex.: forçar o baralho), semente da política }
 * Retorna estatísticas de uso das pessoas e do caixa ao longo da partida.
 */
function jogarPartida(OG, config, politica, opcoes) {
  const o = opcoes || {};
  let estado = OG.motor.criarPartida(config);
  if (o.ajustar) estado = o.ajustar(estado) || estado;
  const decidir = politica.criar(o.semente || config.semente);
  const trabalharam = new Set();
  const rodadasTrabalhadas = {};
  let somaOcupacao = 0;
  let rodadasMedidas = 0;
  let menorCaixa = OG.estado.recursos(estado).dinheiro;
  let passos = 0;
  const limite = 60 * config.duracao + 200;
  while (estado.fase !== 'fim') {
    const acao = decidir(estado);
    if (estado.fase === 'planejamento' && acao && acao.tipo === 'ENCERRAR_RODADA') {
      const agora = ocupados(OG, estado);
      const presentes = OG.estado.todasPessoas().filter(function (p) { return OG.estado.presente(estado, p.id); }).length;
      agora.forEach(function (id) {
        trabalharam.add(id);
        rodadasTrabalhadas[id] = (rodadasTrabalhadas[id] || 0) + 1;
      });
      somaOcupacao += agora.size / presentes;
      rodadasMedidas++;
    }
    const r = OG.motor.aplicar(estado, acao);
    if (!r.ok) {
      throw new Error('A política "' + politica.nome + '" tentou uma ação inválida: ' + JSON.stringify(acao) + ' -> ' + r.erro);
    }
    estado = r.estado;
    menorCaixa = Math.min(menorCaixa, OG.estado.recursos(estado).dinheiro);
    if (++passos > limite) throw new Error('Partida não terminou (laço infinito?) com a política ' + politica.nome);
  }
  return {
    estado: estado,
    menorCaixa: menorCaixa,
    passos: passos,
    trabalharam: trabalharam,
    rodadasTrabalhadas: rodadasTrabalhadas,
    ocupacao: rodadasMedidas ? somaOcupacao / rodadasMedidas : 0,
  };
}

/** Troca o baralho da partida (antes de confirmar o 1º evento). A lista é repetida até cobrir a partida. */
function forcarBaralho(OG, estado, eventos) {
  estado.baralho = Array.from({ length: estado.config.duracao }, function (_, i) { return eventos[i % eventos.length]; });
  estado.historico = estado.historico.filter(function (h) { return h.tipo !== 'evento'; });
  OG.eventos.revelarEvento(estado);
  return estado;
}

module.exports = { criarPoliticas, jogarPartida, forcarBaralho, criarRng };
