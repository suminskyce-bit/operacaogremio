/* Agenda de missões, pedidos avulsos e chegadas ao Backlog. */
'use strict';
const test = require('node:test');
const { OG, E, assert, novo, ok, confirmar, proximaRodada, valido } = require('./ajudantes.js');

const CONFIGS = [4, 8, 10, 26].map((duracao) => ({ missaoId: 'junina', duracao, semente: 77, caixaApertado: false }));

test('agenda: a missão escolhida abre na rodada 1; as outras se espalham até o fim da partida', () => {
  const esperado = {
    4: [[1, 4]],
    8: [[1, 4], [5, 8]],
    10: [[1, 4], [4, 7], [7, 10]],
    26: [[1, 4], [3, 6], [6, 9], [8, 11], [11, 14], [13, 16], [16, 19], [18, 21], [21, 24], [23, 26]],
  };
  CONFIGS.forEach((cfg) => {
    const agenda = OG.agenda.montarAgenda(cfg);
    assert.deepEqual(agenda.map((a) => [a.abre, a.data]), esperado[cfg.duracao], 'duração ' + cfg.duracao);
    assert.equal(agenda[0].missaoId, 'junina');
    assert.equal(new Set(agenda.map((a) => a.missaoId)).size, agenda.length, 'missão repetida');
    agenda.forEach((a) => assert.equal(a.data - a.abre + 1, OG.regras.JANELA_MISSAO));
  });
  // O ano letivo usa as 10 missões.
  assert.equal(new Set(OG.agenda.montarAgenda(CONFIGS[3]).map((a) => a.missaoId)).size, 10);
});

test('agenda e pedidos são determinísticos pela semente e mudam com ela', () => {
  const a = OG.motor.criarPartida({ missaoId: 'liga', duracao: 10, semente: 5 });
  const b = OG.motor.criarPartida({ missaoId: 'liga', duracao: 10, semente: 5 });
  const c = OG.motor.criarPartida({ missaoId: 'liga', duracao: 10, semente: 6 });
  assert.deepEqual(a.agenda, b.agenda);
  assert.deepEqual(a.programacao, b.programacao);
  assert.deepEqual(a.cartas, b.cartas);
  const assinatura = (e) => JSON.stringify(e.agenda.map((x) => x.missaoId)) + JSON.stringify(e.programacao.map((x) => x.projetoId));
  assert.notEqual(assinatura(a), assinatura(c));
});

test('programação: 6 cards por missão na abertura e 2 pedidos por rodada (menos a última), com prazos certos', () => {
  CONFIGS.forEach((cfg) => {
    const agenda = OG.agenda.montarAgenda(cfg);
    const prog = OG.agenda.montarProgramacao(cfg, agenda);
    const n = cfg.duracao;
    assert.equal(new Set(prog.map((p) => p.id)).size, prog.length, 'ids repetidos');
    agenda.forEach((a) => {
      const daMissao = prog.filter((p) => p.missaoId === a.missaoId);
      assert.equal(daMissao.length, 6);
      daMissao.forEach((p) => {
        assert.equal(p.origem, 'missao');
        assert.equal(p.rodada, a.abre);
        assert.equal(p.prazo, a.data);
      });
    });
    for (let r = 1; r <= n; r++) {
      const pedidos = prog.filter((p) => p.origem === 'pedido' && p.rodada === r);
      assert.equal(pedidos.length, r < n ? OG.regras.PEDIDOS_POR_RODADA : 0, 'pedidos na rodada ' + r + ' de ' + n);
      assert.equal(new Set(pedidos.map((p) => p.projetoId)).size, pedidos.length, 'pedido repetido na mesma rodada');
      pedidos.forEach((p) => {
        const proj = OG.dados.projetosPorId[p.projetoId];
        assert.equal(proj.tipo, 'pedido');
        assert.ok(r + proj.tempo <= n, 'pedido que não dá tempo de terminar');
        assert.equal(p.prazo, Math.min(r + proj.tempo + 1, n));
      });
    }
    for (let i = 1; i < prog.length; i++) assert.ok(prog[i - 1].rodada <= prog[i].rodada, 'programação fora de ordem');
  });
});

test('partida nova: só o que chega na rodada 1 está no Backlog; o resto espera na programação', () => {
  const e = OG.motor.criarPartida({ missaoId: 'farroupilha', duracao: 4, semente: 9 });
  assert.equal(e.cartas.length, 8);
  assert.equal(e.cartas.filter((c) => c.origem === 'missao').length, 6);
  assert.equal(e.cartas.filter((c) => c.origem === 'pedido').length, 2);
  assert.ok(e.cartas.every((c) => c.coluna === 'backlog' && c.chegada === 1 && c.responsavel === null));
  assert.equal(e.programacao.length, 4);
  assert.ok(e.programacao.every((p) => p.rodada > 1));
  valido(e);
});

test('a cada rodada chegam os pedidos programados (e as missões que abrem), registrados no histórico', () => {
  let e = confirmar(novo({ missaoId: 'liga', duracao: 8, semente: 3 }));
  for (let r = 2; r <= 8; r++) {
    const esperados = e.programacao.filter((p) => p.rodada === r).map((p) => p.id);
    e = proximaRodada(e);
    assert.equal(e.rodada, r);
    esperados.forEach((cid) => {
      const c = E.carta(e, cid);
      assert.ok(c, 'não chegou ' + cid);
      assert.equal(c.coluna, 'backlog');
      assert.equal(c.chegada, r);
    });
    assert.ok(e.programacao.every((p) => p.rodada > r));
    valido(e);
  }
  assert.ok(e.historico.some((h) => /Missão aberta: /.test(h.texto) && h.rodada === 5));
  assert.ok(e.historico.some((h) => /Pedidos novos no Backlog/.test(h.texto)));
});

test('criarPartida recusa missão ou duração inválidas', () => {
  assert.throws(() => OG.motor.criarPartida({ missaoId: 'festa_secreta', duracao: 4 }), /Missão desconhecida/);
  assert.throws(() => OG.motor.criarPartida({ missaoId: 'junina', duracao: 7 }), /Duração inválida/);
  const e = OG.motor.criarPartida({ missaoId: 'junina' });
  assert.equal(e.config.duracao, 4);
  assert.equal(ok(e, { tipo: 'CONFIRMAR_EVENTO', escolha: OG.eventos.opcoesEvento(e).find((o) => o.habilitado).id }).rodada, 1);
});
