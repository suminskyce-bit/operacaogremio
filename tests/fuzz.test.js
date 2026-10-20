/*
 * Fuzzing: um "jogador caótico" manda milhares de ações aleatórias (válidas e
 * inválidas, repetidas, fora de hora) e, depois de CADA ação, conferimos as
 * invariantes do jogo. Se alguma regra puder ser furada, este teste pega.
 */
'use strict';
const test = require('node:test');
const { OG, E, assert } = require('./ajudantes.js');

function invariantes(e, contexto) {
  const v = OG.persistencia.validarEstado(e);
  assert.ok(v.ok, contexto + ': estado inválido -> ' + v.motivo);
  const r = E.recursos(e);
  assert.ok(r.dinheiro >= 0, contexto + ': caixa negativo');
  assert.ok(E.cartasNaColuna(e, 'andamento').length <= OG.regras.LIMITE_EM_ANDAMENTO, contexto + ': WIP estourado');
  const ocupadas = {};
  E.cartasNaColuna(e, 'andamento').forEach((c) => c.equipe.forEach((id) => {
    assert.ok(!ocupadas[id], contexto + ': ' + id + ' em dois projetos');
    ocupadas[id] = true;
    const st = E.statusPessoa(e, id).codigo;
    assert.equal(st, 'ocupado', contexto + ': ' + id + ' em projeto mas status ' + st);
  }));
  // Cada card concluído recebeu retorno exatamente uma vez; custo cobrado no máximo uma vez.
  e.cartas.forEach((c) => {
    const proj = E.projetoDaCarta(c);
    const retornos = e.livro.filter((l) => l.tipo === 'retorno' && l.descricao === 'Concluído: ' + proj.nome).length;
    assert.equal(retornos, c.coluna === 'concluido' ? 1 : 0, contexto + ': retorno de ' + proj.nome);
    const custos = e.livro.filter((l) => l.tipo === 'custo' && l.descricao === 'Início: ' + proj.nome).length;
    assert.ok(custos <= 1, contexto + ': custo cobrado ' + custos + 'x em ' + proj.nome);
  });
  assert.ok(e.livro.filter((l) => l.tipo === 'recompensa').length <= 3, contexto + ': recompensa repetida');
}

const PESSOAS = () => E.todasPessoas().map((p) => p.id).concat(['ninguem']);

function acaoAleatoria(e, rnd) {
  const cartas = e.cartas.map((c) => c.id).concat(['inexistente']);
  const pick = (lista) => lista[Math.floor(rnd() * lista.length)];
  const pessoas = PESSOAS();
  const tipos = ['CONFIRMAR_EVENTO', 'PLANEJAR', 'DESPLANEJAR', 'INICIAR', 'REVISAR', 'COMPLETAR_EQUIPE',
    'USAR_MUTIRAO', 'ENCERRAR_RODADA', 'RESOLVER_DECISAO', 'AVANCAR', 'INICIAR', 'REVISAR', 'PLANEJAR',
    'CANCELAR_ENCERRAMENTO'];
  const tipo = pick(tipos);
  const acao = { tipo: tipo };
  if (rnd() < 0.1) acao.rodada = 1 + Math.floor(rnd() * 5);
  switch (tipo) {
    case 'CONFIRMAR_EVENTO': {
      const op = OG.eventos.opcoesEvento(e);
      acao.escolha = rnd() < 0.85 && op.length ? pick(op).id : pick(['pagar', 'recusar', 'x', undefined]);
      break;
    }
    case 'RESOLVER_DECISAO': {
      const dec = OG.eventos.decisaoFimRodada(e);
      acao.escolha = rnd() < 0.85 && dec ? pick(dec.opcoes).id : pick(['pagar', 'parar', 'voltar:mateada', 'x']);
      break;
    }
    case 'INICIAR': {
      const n = Math.floor(rnd() * 4);
      const livres = E.pessoasLivres(e).map((p) => p.id);
      acao.equipe = [];
      for (let i = 0; i < n; i++) acao.equipe.push(rnd() < 0.8 && livres.length ? pick(livres) : pick(pessoas));
      acao.cartaId = pick(cartas);
      break;
    }
    case 'REVISAR':
      acao.cartaId = pick(cartas);
      acao.revisorId = rnd() < 0.7 ? pick(OG.dados.coordenadores).id : pick(pessoas);
      break;
    case 'COMPLETAR_EQUIPE':
      acao.cartaId = pick(cartas);
      acao.pessoaId = pick(pessoas);
      break;
    default:
      acao.cartaId = pick(cartas);
  }
  return acao;
}

function rngDeTeste(semente) {
  let a = semente >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('fuzzing: ações aleatórias nunca quebram as regras do jogo', () => {
  let totalAcoes = 0;
  let aceitas = 0;
  let partidasCompletas = 0;
  OG.dados.missoes.forEach((m, mi) => {
    for (let s = 1; s <= 30; s++) {
      const rnd = rngDeTeste(s * 7 + mi * 1000);
      let e = OG.motor.criarPartida(m.id, s * 13 + mi, { caixaApertado: s % 3 === 0 });
      invariantes(e, m.id + '#' + s + ' início');
      for (let i = 0; i < 600 && e.fase !== 'fim'; i++) {
        const acao = acaoAleatoria(e, rnd);
        const antes = JSON.stringify(e);
        let r;
        assert.doesNotThrow(() => { r = OG.motor.aplicar(e, acao); }, 'exceção com ' + JSON.stringify(acao));
        totalAcoes++;
        if (r.ok) {
          aceitas++;
          assert.equal(JSON.stringify(e), antes, 'o estado antigo foi alterado por ' + JSON.stringify(acao));
          e = r.estado;
          invariantes(e, m.id + '#' + s + ' após ' + JSON.stringify(acao));
        } else {
          assert.equal(r.estado, e);
          assert.equal(JSON.stringify(e), antes);
        }
      }
      if (e.fase === 'fim') partidasCompletas++;
    }
  });
  console.log('fuzzing: ' + totalAcoes + ' ações (' + aceitas + ' aceitas), ' + partidasCompletas + ' partidas completas');
  // O fuzzing precisa de fato exercitar o jogo.
  assert.ok(totalAcoes > 50000, 'ações: ' + totalAcoes);
  assert.ok(aceitas > 5000, 'aceitas: ' + aceitas);
  assert.ok(partidasCompletas > 200, 'partidas completas: ' + partidasCompletas);
});

test('mover rápido várias vezes: repetir a mesma ação não duplica efeito', () => {
  let e = OG.motor.criarPartida('junina', 3);
  e = OG.motor.aplicar(e, { tipo: 'CONFIRMAR_EVENTO', escolha: OG.eventos.opcoesEvento(e).find((o) => o.habilitado).id }).estado;
  if (e.fase !== 'planejamento') return;
  e = OG.motor.aplicar(e, { tipo: 'PLANEJAR', cartaId: 'pescaria' }).estado;
  const acao = { tipo: 'INICIAR', cartaId: 'pescaria', equipe: ['wliam'] };
  const r1 = OG.motor.aplicar(e, acao);
  assert.ok(r1.ok, r1.erro);
  const r2 = OG.motor.aplicar(r1.estado, acao);
  const r3 = OG.motor.aplicar(r1.estado, acao);
  assert.equal(r2.ok, false);
  assert.equal(r3.ok, false);
  assert.equal(r1.estado.livro.filter((l) => l.tipo === 'custo').length, 1);
});
