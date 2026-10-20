/* Pontuação final, classificação e partidas completas. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, ok, confirmar, iniciar, revisar, encerrar, proximaRodada, recursos } = h;
const { criarPoliticas, jogarPartida } = require('./politicas.js');

test('fórmula: dinheiro ÷ 10 (inteiro) + prestígio + tradição + projetos × 5', () => {
  let e = confirmar(novo('farroupilha', ['ev_viral', 'ev_viral', 'ev_viral', 'ev_viral']));
  e = iniciar(e, 'mateada', ['wesley']); // custo 40
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'sumindo'); // +80, +5 P, +10 T
  const p = OG.pontuacao.calcular(e);
  const r = recursos(e);
  assert.deepEqual(r, { dinheiro: 540, prestigio: 20 + 10 + 10 + 5, tradicao: 30 });
  assert.deepEqual(p.itens.map((i) => i.pontos), [54, 45, 30, 5]);
  assert.equal(p.total, 134);
  assert.ok(Number.isInteger(p.total));
});

test('dinheiro com centavos/quebrados é arredondado para baixo na pontuação', () => {
  let e = confirmar(novo('farroupilha', ['ev_viral', 'ev_viral', 'ev_viral', 'ev_viral']));
  h.forcarCaixa(e, 539);
  assert.equal(OG.pontuacao.calcular(e).itens[0].pontos, 53);
});

test('aproveitamento mede o que foi conquistado; não fazer nada = A DIREÇÃO QUER CONVERSAR', () => {
  const pol = criarPoliticas(OG);
  for (let s = 1; s <= 30; s++) {
    const { estado } = jogarPartida(OG, 'farroupilha', s, pol.parado);
    const p = OG.pontuacao.calcular(estado);
    assert.equal(p.pontosIniciais, 90);
    assert.equal(p.conquistado, p.total - 90);
    assert.ok(p.aproveitamento < 40, 'semente ' + s + ': ' + p.aproveitamento + '%');
    assert.equal(p.classificacao, 'A DIREÇÃO QUER CONVERSAR');
  }
});

test('classificação por faixa de aproveitamento (100/80/60/40)', () => {
  assert.equal(OG.pontuacao.classificar(120), 'GRÊMIO LENDÁRIO');
  assert.equal(OG.pontuacao.classificar(100), 'GRÊMIO LENDÁRIO');
  assert.equal(OG.pontuacao.classificar(99), 'GRÊMIO DESTAQUE');
  assert.equal(OG.pontuacao.classificar(80), 'GRÊMIO DESTAQUE');
  assert.equal(OG.pontuacao.classificar(79), 'GRÊMIO APROVADO');
  assert.equal(OG.pontuacao.classificar(60), 'GRÊMIO APROVADO');
  assert.equal(OG.pontuacao.classificar(59), 'GRÊMIO SOBREVIVEU');
  assert.equal(OG.pontuacao.classificar(40), 'GRÊMIO SOBREVIVEU');
  assert.equal(OG.pontuacao.classificar(39), 'A DIREÇÃO QUER CONVERSAR');
  assert.equal(OG.pontuacao.classificar(-10), 'A DIREÇÃO QUER CONVERSAR');
});

test('investimento parado: projetos pagos e não concluídos aparecem no resumo financeiro', () => {
  let e = confirmar(novo('farroupilha', ['ev_viral', 'ev_viral', 'ev_viral', 'ev_viral']));
  for (let r = 1; r < 4; r++) e = proximaRodada(e);
  e = iniciar(e, 'pilcha', ['antune']); // rodada 4: não termina
  e = encerrar(e);
  e = ok(e, { tipo: 'AVANCAR' });
  assert.equal(e.fase, 'fim');
  const fin = OG.pontuacao.resumoFinanceiro(e);
  assert.equal(fin.investimentoParado, 50);
  assert.equal(E.carta(e, 'pilcha').coluna, 'revisao');
  assert.equal(OG.pontuacao.calcular(e).concluidos, 0);
});

test('partidas completas em todas as missões, com todos os perfis, sem travar', () => {
  const pol = criarPoliticas(OG);
  OG.dados.missoes.forEach((m) => {
    Object.values(pol).forEach((p) => {
      for (let s = 1; s <= 15; s++) {
        const r = jogarPartida(OG, m.id, s * 101, p);
        assert.equal(r.estado.fase, 'fim');
        assert.equal(r.estado.rodada, 4);
        assert.ok(OG.persistencia.validarEstado(r.estado).ok, m.id + '/' + p.nome);
      }
    });
  });
});

test('o jogador "bom" cumpre a missão na grande maioria das partidas de todas as missões', () => {
  const pol = criarPoliticas(OG);
  OG.dados.missoes.forEach((m) => {
    let cumpridas = 0;
    const n = 40;
    for (let s = 1; s <= n; s++) {
      if (OG.pontuacao.calcular(jogarPartida(OG, m.id, s * 3571, pol.bom).estado).missaoCumprida) cumpridas++;
    }
    assert.ok(cumpridas / n >= 0.85, m.nome + ': ' + cumpridas + '/' + n);
  });
});

test('modo caixa apertado continua jogável em todas as missões', () => {
  const pol = criarPoliticas(OG);
  OG.dados.missoes.forEach((m) => {
    for (let s = 1; s <= 10; s++) {
      const r = jogarPartida(OG, m.id, s, pol.bom, (e) => OG.motor.criarPartida(m.id, s, { caixaApertado: true }));
      assert.ok(r.menorCaixa >= 0);
      assert.equal(r.estado.fase, 'fim');
    }
  });
});
