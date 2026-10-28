/* Funções de apoio para os testes do núcleo. */
'use strict';
const assert = require('node:assert/strict');
const { carregarJogo } = require('./carregar-jogo.js');

const OG = carregarJogo();
const E = OG.estado;

/**
 * Cria partida com baralho escolhido (sem as regras de composição — é teste).
 * opcoes: { missaoId, duracao, semente, caixaApertado, baralho }
 * O baralho é repetido até cobrir todas as rodadas. Padrão: só "Divulgação Viral"
 * (+10 Prestígio por rodada), para não mexer no dinheiro.
 */
function novo(opcoes) {
  const o = Object.assign({ missaoId: 'farroupilha', duracao: 4, semente: 1 }, opcoes || {});
  const e = OG.motor.criarPartida({ missaoId: o.missaoId, duracao: o.duracao, semente: o.semente, caixaApertado: o.caixaApertado });
  const base = o.baralho || ['ev_viral'];
  e.baralho = Array.from({ length: o.duracao }, function (_, i) { return base[i % base.length]; });
  e.historico = e.historico.filter(function (h) { return h.tipo !== 'evento'; });
  OG.eventos.revelarEvento(e);
  return e;
}

/** Id do (primeiro) card com este projeto no quadro. */
function id(e, projetoId) {
  const c = e.cartas.find(function (x) { return x.projetoId === projetoId; });
  assert.ok(c, 'não há card de ' + projetoId + ' no quadro');
  return c.id;
}

function carta(e, projetoId) {
  return E.carta(e, id(e, projetoId));
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

function planejar(e, projetoId, coord) {
  return ok(e, { tipo: 'PLANEJAR', cartaId: id(e, projetoId), responsavel: coord });
}

/** Planeja (se preciso) e inicia com o coordenador e a equipe dados. */
function iniciar(e, projetoId, coord, equipe) {
  if (carta(e, projetoId).coluna === 'backlog') e = planejar(e, projetoId, coord);
  return ok(e, { tipo: 'INICIAR', cartaId: id(e, projetoId), equipe: equipe });
}

function revisar(e, projetoId, revisor) {
  return ok(e, { tipo: 'REVISAR', cartaId: id(e, projetoId), revisorId: revisor });
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

function col(e, projetoId) {
  return carta(e, projetoId).coluna;
}

/** Força o caixa para um valor (lançamento de teste no livro-caixa). */
function forcarCaixa(e, valor) {
  const atual = recursos(e).dinheiro;
  e.livro.push({ rodada: e.rodada, recurso: 'dinheiro', valor: valor - atual, tipo: 'teste', descricao: 'ajuste de teste' });
  return e;
}

/** Valida o estado como se tivesse sido salvo e carregado. */
function valido(e) {
  const v = OG.persistencia.validarEstado(JSON.parse(JSON.stringify(e)));
  assert.ok(v.ok, 'estado inválido: ' + v.motivo);
}

module.exports = {
  OG, E, assert,
  novo, id, carta, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada,
  recursos, col, forcarCaixa, valido,
};
