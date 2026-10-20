/* Funções de apoio para os testes do núcleo. */
'use strict';
const assert = require('node:assert/strict');
const { carregarJogo } = require('./carregar-jogo.js');

const OG = carregarJogo();
const E = OG.estado;

/** Baralho "neutro" padrão para os testes não serem afetados por sorteio. */
const NEUTRO = ['ev_viral', 'ev_post', 'ev_viral', 'ev_post'];

/** Cria partida com baralho escolhido (sem as regras de composição — é teste). */
function novo(missaoId, baralho, semente, opcoes) {
  const e = OG.motor.criarPartida(missaoId || 'farroupilha', semente || 1, opcoes);
  e.baralho = (baralho || ['ev_professor', 'ev_post', 'ev_transporte', 'ev_limpeza']).slice();
  e.historico = [];
  OG.eventos.revelarEvento(e);
  return e;
}

function ok(e, acao) {
  const r = OG.motor.aplicar(e, acao);
  assert.ok(r.ok, 'esperava sucesso em ' + JSON.stringify(acao) + ' mas veio: ' + r.erro);
  assert.notEqual(r.estado, e, 'aplicar deve devolver um estado novo');
  return r.estado;
}

function falha(e, acao, trecho) {
  const antes = JSON.stringify(e);
  const r = OG.motor.aplicar(e, acao);
  assert.equal(r.ok, false, 'esperava falha em ' + JSON.stringify(acao));
  assert.equal(r.estado, e, 'ação inválida deve devolver o MESMO estado');
  assert.equal(JSON.stringify(e), antes, 'ação inválida não pode alterar o estado');
  assert.equal(typeof r.erro, 'string');
  assert.ok(r.erro.length > 5, 'a mensagem de erro precisa explicar o motivo');
  if (trecho) assert.match(r.erro, trecho);
  return r.erro;
}

function confirmar(e, escolha) {
  return ok(e, { tipo: 'CONFIRMAR_EVENTO', escolha: escolha });
}

function planejar(e, id) {
  return ok(e, { tipo: 'PLANEJAR', cartaId: id });
}

/** Planeja (se preciso) e inicia com a equipe dada. */
function iniciar(e, id, equipe) {
  if (E.carta(e, id).coluna === 'backlog') e = planejar(e, id);
  return ok(e, { tipo: 'INICIAR', cartaId: id, equipe: equipe });
}

function revisar(e, id, revisor) {
  return ok(e, { tipo: 'REVISAR', cartaId: id, revisorId: revisor });
}

/** Encerra a rodada (resolvendo decisão, se houver) e mostra o resumo. */
function encerrar(e, escolha) {
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  if (e.fase === 'decisao') e = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: escolha });
  return e;
}

/** Encerra, avança e confirma o próximo evento (se houver). */
function proximaRodada(e, escolhaFim, escolhaEvento) {
  e = encerrar(e, escolhaFim);
  assert.equal(e.fase, 'resumo');
  e = ok(e, { tipo: 'AVANCAR' });
  if (e.fase === 'evento') e = confirmar(e, escolhaEvento);
  return e;
}

function recursos(e) {
  return E.recursos(e);
}

function col(e, id) {
  return E.carta(e, id).coluna;
}

/** Força o caixa para um valor (lançamento de teste no livro-caixa). */
function forcarCaixa(e, valor) {
  const atual = recursos(e).dinheiro;
  e.livro.push({ rodada: e.rodada, recurso: 'dinheiro', valor: valor - atual, tipo: 'teste', descricao: 'ajuste de teste' });
  return e;
}

module.exports = {
  OG, E, assert, NEUTRO,
  novo, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, recursos, col, forcarCaixa,
};
