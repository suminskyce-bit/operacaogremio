/* Pontuação final, meta, classificação, resumo financeiro e partidas completas. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, id, carta, ok, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, recursos } = h;
const { criarPoliticas, jogarPartida } = require('./politicas.js');

const pol = criarPoliticas(OG);
const media = (l) => l.reduce((a, b) => a + b, 0) / l.length;

/** Planeja (se preciso) e inicia com a equipe enxuta que o próprio jogo sugere. */
function iniciarSugerido(e, cartaId, coord) {
  if (E.carta(e, cartaId).coluna === 'backlog') e = ok(e, { tipo: 'PLANEJAR', cartaId: cartaId, responsavel: coord });
  const time = OG.planejador.montarEquipe(e, E.carta(e, cartaId));
  assert.ok(time, 'sem equipe possível para ' + cartaId);
  return ok(e, { tipo: 'INICIAR', cartaId: cartaId, equipe: time.equipe });
}

test('fórmula: dinheiro ÷ 10 (inteiro) + prestígio + tradição + projetos entregues no prazo × 5', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']); // 40 − 2 especialistas × 10 = 20
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'sumindo'); // +80, +5 P, +10 T
  const p = OG.pontuacao.calcular(e);
  assert.deepEqual(recursos(e), { dinheiro: 560, prestigio: 20 + 10 + 10 + 5, tradicao: 30 });
  assert.deepEqual(p.itens.map((i) => [i.id, i.pontos]), [['dinheiro', 56], ['prestigio', 45], ['tradicao', 30], ['projetos', 5]]);
  assert.equal(p.total, 136);
  assert.equal(p.entregues, 1);
  assert.equal(p.pontosIniciais, 50 + 20 + 20);
  assert.equal(p.conquistado, 136 - 90);
  assert.equal(OG.pontuacao.pontosDe(e), 136);
});

test('dinheiro quebrado é arredondado para baixo na pontuação', () => {
  const e = confirmar(novo());
  h.forcarCaixa(e, 539);
  assert.equal(OG.pontuacao.calcular(e).itens[0].pontos, 53);
});

test('entrega atrasada: metade do retorno, sem prestígio, tradição nem os 5 pontos, e não conta para a missão', () => {
  let e = confirmar(novo());
  const pedido = e.cartas.find((c) => c.origem === 'pedido' && E.projetoDaCarta(c).tempo === 1);
  assert.ok(pedido, 'a partida de teste precisa de um pedido de 1 rodada na rodada 1');
  assert.equal(pedido.prazo, 3, 'pedido da rodada 1 com 1 rodada de execução vence na rodada 3');
  const proj = E.projetoDaCarta(pedido);
  e = iniciarSugerido(e, pedido.id, 'sumindo');
  const caixaAntes = recursos(e).dinheiro;
  const pontosAntes = recursos(e);
  e = proximaRodada(e); // rodada 2: em revisão, mas ninguém revisa...
  e = proximaRodada(e); // rodada 3: ...nem agora
  e = encerrar(e);
  assert.ok(e.resumo.linhas.some((l) => l.texto.indexOf(proj.nome + ' passou do prazo') === 0));
  e = ok(e, { tipo: 'AVANCAR' });
  e = confirmar(e); // rodada 4
  assert.equal(E.farolDoPrazo(e, E.carta(e, pedido.id)), 'atrasado');
  e = ok(e, { tipo: 'REVISAR', cartaId: pedido.id, revisorId: 'antune' });
  const c = E.carta(e, pedido.id);
  assert.equal(c.noPrazo, false);
  assert.equal(c.retornoRecebido, Math.floor(proj.retorno / 2));
  assert.equal(recursos(e).dinheiro, caixaAntes + Math.floor(proj.retorno / 2));
  // Prestígio só mudou pelos eventos (3 × Divulgação Viral), tradição não mudou.
  assert.equal(recursos(e).prestigio, pontosAntes.prestigio + 30);
  assert.equal(recursos(e).tradicao, pontosAntes.tradicao);
  const p = OG.pontuacao.calcular(e);
  assert.equal(p.entregues, 0);
  assert.equal(p.atrasados, 1);
  assert.equal(E.farolDoPrazo(e, c), 'tarde');
  assert.equal(OG.pontuacao.resumoFinanceiro(e).perdaPorAtraso, proj.retorno - Math.floor(proj.retorno / 2));
  assert.ok(e.historico.some((x) => x.tipo === 'atraso' && /metade do retorno/.test(x.texto)));
  h.valido(e);
});

test('missão: recompensa entra uma vez, quando o 4º projeto da missão é concluído no prazo', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  e = iniciar(e, 'deco_farroupilha', 'luize', ['dexter', 'maicon']);
  e = iniciar(e, 'camp_concolor', 'sumindo', ['deyverson', 'costit']);
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'ryani');
  e = revisar(e, 'cuca', 'antune');
  e = revisar(e, 'deco_farroupilha', 'jv');
  assert.equal(E.entradaAgenda(e, 'farroupilha').cumprida, false);
  const antes = recursos(e);
  e = revisar(e, 'camp_concolor', 'luize');
  const a = E.entradaAgenda(e, 'farroupilha');
  assert.equal(a.cumprida, true);
  assert.equal(a.cumpridaNaRodada, 2);
  assert.equal(recursos(e).dinheiro, antes.dinheiro + 150 + 100, 'retorno do Concolor + R$ 100 da missão');
  assert.equal(recursos(e).tradicao, antes.tradicao + 0 + 10);
  assert.equal(e.livro.filter((l) => l.tipo === 'recompensa').length, 2);
  assert.ok(e.historico.some((x) => /MISSÃO CUMPRIDA: Festa Farroupilha/.test(x.texto)));
  const p = OG.pontuacao.calcular(e);
  assert.equal(p.missoesCumpridas, 1);
  assert.equal(p.missoes[0].situacao, 'cumprida');
  h.valido(e);
});

test('missão perdida: chegou à data sem o objetivo, sem recompensa', () => {
  let e = confirmar(novo());
  for (let r = 1; r <= 3; r++) e = proximaRodada(e);
  e = encerrar(e);
  const a = E.entradaAgenda(e, 'farroupilha');
  assert.equal(a.perdida, true);
  assert.ok(e.resumo.linhas.some((l) => /Missão perdida: Festa Farroupilha chegou à data com 0 de 4/.test(l.texto)));
  assert.equal(OG.pontuacao.calcular(e).missoes[0].situacao, 'perdida');
  h.valido(e);
});

test('classificação por faixa de aproveitamento (100/85/70/50)', () => {
  const c = OG.pontuacao.classificar;
  assert.equal(c(120), 'GRÊMIO LENDÁRIO');
  assert.equal(c(100), 'GRÊMIO LENDÁRIO');
  assert.equal(c(99), 'GRÊMIO DESTAQUE');
  assert.equal(c(85), 'GRÊMIO DESTAQUE');
  assert.equal(c(84), 'GRÊMIO APROVADO');
  assert.equal(c(70), 'GRÊMIO APROVADO');
  assert.equal(c(69), 'GRÊMIO SOBREVIVEU');
  assert.equal(c(50), 'GRÊMIO SOBREVIVEU');
  assert.equal(c(49), 'A DIREÇÃO QUER CONVERSAR');
  assert.equal(c(-10), 'A DIREÇÃO QUER CONVERSAR');
});

test('meta: o planejador jogando a mesma partida sem imprevistos tem exatamente 100% de aproveitamento', () => {
  [4, 8, 10].forEach((duracao) => {
    const config = { missaoId: 'junina', duracao: duracao, semente: 77, caixaApertado: false };
    const fim = OG.planejador.simular(config, { eventosNeutros: true });
    const p = OG.pontuacao.calcular(fim);
    assert.equal(p.aproveitamento, 100, duracao + ' rodadas');
    assert.equal(p.classificacao, 'GRÊMIO LENDÁRIO');
    assert.equal(p.meta.total, p.total);
  });
});

test('meta: depende só da configuração (mesma partida, mesma meta) e muda com a semente e a duração', () => {
  const cfg = { missaoId: 'liga', duracao: 8, semente: 4242, caixaApertado: false };
  const m1 = OG.pontuacao.metaDaPartida(cfg);
  const m2 = OG.pontuacao.metaDaPartida(Object.assign({}, cfg));
  assert.deepEqual(m1, m2);
  // A meta é recalculada da configuração: o estado salvo não guarda (nem pode adulterar) a meta.
  const e = OG.motor.criarPartida(cfg);
  assert.equal(e.meta, undefined);
  assert.deepEqual(OG.pontuacao.calcular(e).meta, m1);
  assert.notDeepEqual(OG.pontuacao.metaDaPartida(Object.assign({}, cfg, { semente: 4243 })), m1);
  assert.notDeepEqual(OG.pontuacao.metaDaPartida(Object.assign({}, cfg, { duracao: 10 })), m1);
  const apertado = OG.pontuacao.metaDaPartida(Object.assign({}, cfg, { caixaApertado: true }));
  assert.ok(apertado.total < m1.total, 'com menos caixa a meta em pontos é menor');
});

test('meta: positiva e com todas as missões cumpridas em todas as missões e durações', () => {
  OG.dados.missoes.forEach((m, i) => {
    [4, 8, 10].forEach((duracao) => {
      const meta = OG.pontuacao.metaDaPartida({ missaoId: m.id, duracao: duracao, semente: 100 + i, caixaApertado: false });
      assert.ok(meta.conquistado > 100, m.id + '/' + duracao + ': ' + meta.conquistado);
      assert.equal(meta.missoesCumpridas, OG.regrasUtil.duracao(duracao).missoes, m.id + '/' + duracao);
    });
  });
});

test('não fazer nada = A DIREÇÃO QUER CONVERSAR, em todas as durações', () => {
  [4, 8, 10, 26].forEach((duracao) => {
    for (let s = 1; s <= (duracao === 26 ? 2 : 8); s++) {
      const r = jogarPartida(OG, { missaoId: OG.dados.missoes[s % 10].id, duracao: duracao, semente: s * 31 }, pol.parado);
      const p = OG.pontuacao.calcular(r.estado);
      // Só os eventos positivos dão algum ponto a quem não joga.
      assert.ok(p.aproveitamento < 20, duracao + '/' + s + ': ' + p.aproveitamento + '%');
      assert.equal(p.classificacao, 'A DIREÇÃO QUER CONVERSAR');
      assert.equal(p.entregues, 0);
      // Tudo o que chegou ao quadro venceu e foi arquivado.
      assert.equal(r.estado.cartas.length, 0);
    }
  });
});

test('resumo financeiro: receita não é lucro; investimento parado inclui pago e não concluído (e vencido)', () => {
  let e = confirmar(novo({ baralho: ['ev_viral', 'ev_fornecedor', 'ev_viral', 'ev_viral'] }));
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']); // paga 20
  e = proximaRodada(e); // rodada 2: Fornecedor
  e = revisar(e, 'mateada', 'sumindo'); // retorno 80
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']); // paga 50 (fornecedor)
  e = encerrar(e, 'voltar:' + id(e, 'cuca')); // não paga: volta para A FAZER (custo já pago)
  e = ok(e, { tipo: 'AVANCAR' });
  e = confirmar(e); // rodada 3
  e = iniciar(e, 'tche_musica', 'antune', ['agatha', 'giulie']); // paga 80; 2 rodadas: não termina a tempo de revisar
  e = proximaRodada(e); // rodada 4
  e = encerrar(e); // a Cuca nunca foi retomada: vence no fim da rodada 4
  e = ok(e, { tipo: 'AVANCAR' });
  assert.equal(e.fase, 'fim');
  const f = OG.pontuacao.resumoFinanceiro(e);
  assert.equal(f.caixaInicial, 500);
  assert.equal(f.investido, 20 + 50 + 80);
  assert.equal(f.receitaProjetos, 80);
  assert.equal(f.lucroProjetosConcluidos, 80 - 20);
  assert.equal(f.investimentoParado, 50 + 80, 'Cuca (paga e vencida) + Tchê Música (em revisão no fim)');
  assert.equal(f.caixaFinal, recursos(e).dinheiro);
  assert.equal(f.caixaFinal, 500 - 150 + 80);
  assert.ok(e.arquivo.some((a) => a.projetoId === 'cuca' && a.custoPago === 50));
  h.valido(e);
});

test('partidas completas em todas as durações e com todos os perfis, sem travar e sem estado inválido', () => {
  const porDuracao = { 4: 5, 8: 2, 10: 2, 26: 1 };
  Object.keys(pol).forEach((nome) => {
    Object.keys(porDuracao).forEach((d) => {
      const duracao = Number(d);
      for (let s = 1; s <= porDuracao[d]; s++) {
        const cfg = { missaoId: OG.dados.missoes[(s * 3 + duracao) % 10].id, duracao: duracao, semente: s * 101 + duracao, caixaApertado: s % 4 === 0 };
        const r = jogarPartida(OG, cfg, pol[nome]);
        assert.equal(r.estado.fase, 'fim', nome);
        assert.equal(r.estado.rodada, duracao, nome);
        assert.ok(r.menorCaixa >= 0, nome);
        const v = OG.persistencia.validarEstado(JSON.parse(JSON.stringify(r.estado)));
        assert.ok(v.ok, nome + '/' + duracao + ': ' + v.motivo);
      }
    });
  });
});

test('pensar faz diferença: planejador > sem prioridade > coordenador ao acaso > sem pensar > descuidado > parado', () => {
  const amostra = (politica, duracao, n) => {
    const l = [];
    for (let s = 1; s <= n; s++) {
      const r = jogarPartida(OG, { missaoId: OG.dados.missoes[s % 10].id, duracao: duracao, semente: s * 7919 }, politica);
      l.push(OG.pontuacao.calcular(r.estado).aproveitamento);
    }
    return media(l);
  };
  [[4, 20], [8, 8]].forEach(([duracao, n]) => {
    const plan = amostra(pol.planejador, duracao, n);
    const semPrioridade = amostra(pol.semPrioridade, duracao, n);
    const coord = amostra(pol.coordAoAcaso, duracao, n);
    const semPensar = amostra(pol.semPensar, duracao, n);
    const descuidado = amostra(pol.descuidado, duracao, n);
    const parado = amostra(pol.parado, duracao, n);
    const txt = duracao + ' rodadas: ' + [plan, semPrioridade, coord, semPensar, descuidado, parado].map((x) => x.toFixed(0)).join(' / ');
    assert.ok(plan >= 85, txt);
    assert.ok(plan > semPrioridade + 5, txt);
    assert.ok(plan > coord + 15, 'escolher bem o coordenador precisa valer muito: ' + txt);
    assert.ok(semPensar < 70, 'jogar sem pensar não pode passar de SOBREVIVEU em média: ' + txt);
    assert.ok(descuidado < 50 && parado < 10, txt);
  });
});

test('todos os personagens trabalham: o planejador usa os 5 coordenadores e quase todos os voluntários', () => {
  const usados = [];
  const ocupacao = [];
  for (let s = 1; s <= 12; s++) {
    const r = jogarPartida(OG, { missaoId: OG.dados.missoes[s % 10].id, duracao: 4, semente: s * 313 }, pol.planejador);
    const coord = Array.from(r.trabalharam).filter((x) => E.ehCoordenador(x));
    assert.equal(coord.length, 5, 'semente ' + s);
    usados.push(Array.from(r.trabalharam).filter((x) => x !== 'patricio').length);
    ocupacao.push(r.ocupacao);
  }
  assert.ok(media(usados) >= 16, 'pessoas fixas usadas em média: ' + media(usados).toFixed(1) + ' de 17');
  assert.ok(media(ocupacao) > 0.55, 'ocupação média: ' + media(ocupacao).toFixed(2));
});

test('toda missão é possível na partida rápida (o planejador cumpre na grande maioria das partidas)', () => {
  OG.dados.missoes.forEach((m) => {
    let cumpridas = 0;
    const n = 10;
    for (let s = 1; s <= n; s++) {
      const r = jogarPartida(OG, { missaoId: m.id, duracao: 4, semente: s * 3571 }, pol.planejador);
      if (OG.pontuacao.calcular(r.estado).missoesCumpridas === 1) cumpridas++;
    }
    assert.ok(cumpridas / n >= 0.7, m.nome + ': ' + cumpridas + '/' + n);
  });
});

test('caixa apertado continua jogável: o caixa nunca fica negativo e a missão ainda é possível', () => {
  let cumpridas = 0;
  for (let s = 1; s <= 10; s++) {
    const cfg = { missaoId: OG.dados.missoes[s % 10].id, duracao: 4, semente: s * 17, caixaApertado: true };
    const r = jogarPartida(OG, cfg, pol.planejador);
    assert.ok(r.menorCaixa >= 0);
    assert.equal(r.estado.fase, 'fim');
    if (OG.pontuacao.calcular(r.estado).missoesCumpridas) cumpridas++;
  }
  assert.ok(cumpridas >= 7, 'missões cumpridas com caixa apertado: ' + cumpridas + '/10');
});
