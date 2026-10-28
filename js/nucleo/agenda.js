/*
 * agenda.js — o que chega ao Backlog e quando.
 *
 * Tudo é decidido na criação da partida, com um sorteio próprio derivado da semente
 * (não depende das ações do jogador nem dos eventos):
 *   - agenda de missões: a missão escolhida abre na rodada 1; nas partidas longas as
 *     outras (sorteadas) se espalham pela partida. Cada missão fica aberta por
 *     regras.JANELA_MISSAO rodadas e o prazo dos 6 projetos dela é a data da missão.
 *   - pedidos avulsos: regras.PEDIDOS_POR_RODADA por rodada (menos na última), com prazo
 *     curto: rodada de chegada + tempo do projeto + 1 (nunca depois do fim da partida).
 * Assim a mesma semente gera sempre a mesma partida, e o planejador do jogo consegue
 * jogar "a mesma partida" para calcular a meta.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const SAL_AGENDA = 0x1a9e7d;
  const SAL_PEDIDOS = 0x5ed1d0;

  function R() { return OG.regras; }

  /** [{ missaoId, abre, data, cumprida, perdida, cumpridaNaRodada }] */
  function montarAgenda(config) {
    const dur = OG.regrasUtil.duracao(config.duracao);
    const sorteio = OG.util.criarSorteio(config.semente, SAL_AGENDA);
    const outras = OG.util.embaralhar(sorteio, OG.dados.missoes
      .map(function (m) { return m.id; })
      .filter(function (id) { return id !== config.missaoId; }));
    const ids = [config.missaoId].concat(outras).slice(0, dur.missoes);
    const n = config.duracao;
    const janela = R().JANELA_MISSAO;
    return ids.map(function (id, i) {
      const abre = ids.length === 1 ? 1 : Math.round(1 + (i * (n - janela)) / (ids.length - 1));
      return { missaoId: id, abre: abre, data: abre + janela - 1, cumprida: false, perdida: false, cumpridaNaRodada: null };
    });
  }

  /**
   * Programação completa da partida: [{ id, rodada, projetoId, origem, missaoId, prazo }]
   * (ids "c1", "c2"... na ordem de chegada).
   */
  function montarProgramacao(config, agenda) {
    const n = config.duracao;
    const entradas = [];

    agenda.forEach(function (a) {
      OG.dados.missoesPorId[a.missaoId].projetos.forEach(function (projetoId) {
        entradas.push({ rodada: a.abre, projetoId: projetoId, origem: 'missao', missaoId: a.missaoId, prazo: a.data });
      });
    });

    const sorteio = OG.util.criarSorteio(config.semente, SAL_PEDIDOS);
    let saco = [];
    for (let r = 1; r <= n - 1; r++) {
      const escolhidos = [];
      let tentativas = 0;
      while (escolhidos.length < R().PEDIDOS_POR_RODADA && tentativas < 200) {
        tentativas++;
        if (!saco.length) saco = OG.util.embaralhar(sorteio, OG.dados.pedidos.map(function (p) { return p.id; }));
        const projetoId = saco.shift();
        const proj = OG.dados.projetosPorId[projetoId];
        // Só chega o que ainda dá tempo de terminar e revisar antes do fim da partida.
        if (r + proj.tempo > n) continue;
        if (escolhidos.indexOf(projetoId) !== -1) continue;
        escolhidos.push(projetoId);
      }
      escolhidos.forEach(function (projetoId) {
        const proj = OG.dados.projetosPorId[projetoId];
        entradas.push({ rodada: r, projetoId: projetoId, origem: 'pedido', missaoId: null, prazo: Math.min(r + proj.tempo + 1, n) });
      });
    }

    entradas.sort(function (a, b) {
      if (a.rodada !== b.rodada) return a.rodada - b.rodada;
      if (a.origem !== b.origem) return a.origem === 'missao' ? -1 : 1;
      return 0;
    });
    return entradas.map(function (e, i) { return Object.assign({ id: 'c' + (i + 1) }, e); });
  }

  function novaCarta(entrada, ordem) {
    return {
      id: entrada.id,
      projetoId: entrada.projetoId,
      origem: entrada.origem,
      missaoId: entrada.missaoId,
      chegada: entrada.rodada,
      prazo: entrada.prazo,
      coluna: 'backlog',
      ordem: ordem,
      responsavel: null,
      equipe: [],
      equipeFinal: [],
      progresso: 0,
      tempoTotal: null,
      custoPago: null,
      custoItens: [],
      recompensado: false,
      retornoRecebido: null,
      noPrazo: null,
      iniciadoNaRodada: null,
      concluidoNaRodada: null,
      revisor: null,
    };
  }

  /** Coloca no Backlog tudo o que chega na rodada atual (missões que abrem e pedidos). */
  function receberChegadas(estado) {
    const agora = estado.programacao.filter(function (e) { return e.rodada === estado.rodada; });
    if (!agora.length) return [];
    estado.programacao = estado.programacao.filter(function (e) { return e.rodada !== estado.rodada; });
    const chegaram = agora.map(function (e) {
      const c = novaCarta(e, estado.proximaOrdem++);
      estado.cartas.push(c);
      return c;
    });

    estado.agenda.forEach(function (a) {
      if (a.abre !== estado.rodada) return;
      const m = OG.dados.missoesPorId[a.missaoId];
      estado.historico.push({
        rodada: estado.rodada, tipo: 'missao',
        texto: 'Missão aberta: ' + m.nome + '. Conclua ' + m.objetivo + ' dos 6 projetos até a rodada ' + a.data + '.',
      });
    });
    const pedidos = chegaram.filter(function (c) { return c.origem === 'pedido'; });
    if (pedidos.length) {
      estado.historico.push({
        rodada: estado.rodada, tipo: 'sistema',
        texto: 'Pedidos novos no Backlog: ' + OG.util.listaPt(pedidos.map(function (c) {
          return OG.dados.projetosPorId[c.projetoId].nome + ' (prazo: rodada ' + c.prazo + ')';
        })) + '.',
      });
    }
    return chegaram;
  }

  OG.agenda = {
    montarAgenda,
    montarProgramacao,
    novaCarta,
    receberChegadas,
  };
})(globalThis);
