/* Persistência: salvar, carregar, validar e reiniciar. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, confirmar, iniciar, proximaRodada } = h;

function armazenamentoFalso() {
  const dados = {};
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    _dados: dados,
  };
}

function partidaNoMeio() {
  let e = confirmar(novo('farroupilha', ['ev_viral', 'ev_reuniao', 'ev_professor', 'ev_patrocinio']));
  e = iniciar(e, 'mateada', ['antune']);
  e = iniciar(e, 'tche_musica', ['dexter', 'giulie']);
  e = proximaRodada(e);
  return e;
}

test('salvar e carregar devolve exatamente a mesma partida', () => {
  const a = armazenamentoFalso();
  const e = partidaNoMeio();
  assert.equal(OG.persistencia.salvar(e, a), true);
  const r = OG.persistencia.carregar(a);
  assert.equal(r.problema, null);
  assert.deepEqual(r.estado, e);
});

test('recarregar no meio de uma decisão de fim de rodada mantém a decisão pendente', () => {
  const a = armazenamentoFalso();
  let e = partidaNoMeio();
  e = iniciar(e, 'pilcha', ['agatha']);
  e = h.ok(e, { tipo: 'ENCERRAR_RODADA' });
  assert.equal(e.fase, 'decisao');
  OG.persistencia.salvar(e, a);
  const r = OG.persistencia.carregar(a);
  assert.equal(r.estado.fase, 'decisao');
  assert.ok(OG.eventos.decisaoFimRodada(r.estado));
});

test('o sorteio continua o mesmo depois de recarregar (influenza não é sorteada de novo)', () => {
  const a = armazenamentoFalso();
  const e = novo('farroupilha', ['ev_influenza', 'ev_viral', 'ev_professor', 'ev_patrocinio'], 99);
  OG.persistencia.salvar(e, a);
  const r = OG.persistencia.carregar(a);
  assert.equal(r.estado.eventoAtual.alvo, e.eventoAtual.alvo);
});

test('JSON quebrado é descartado sem derrubar o jogo', () => {
  const a = armazenamentoFalso();
  a.setItem(OG.persistencia.CHAVE, '{isso não é json');
  const r = OG.persistencia.carregar(a);
  assert.equal(r.estado, null);
  assert.equal(r.problema, 'corrompido');
  assert.equal(a.getItem(OG.persistencia.CHAVE), null);
});

test('armazenamento vazio ou indisponível', () => {
  assert.equal(OG.persistencia.carregar(armazenamentoFalso()).problema, 'vazio');
  const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cheio'); }, removeItem: () => {} };
  assert.equal(OG.persistencia.carregar(quebrado).problema, 'indisponivel');
  assert.equal(OG.persistencia.salvar(partidaNoMeio(), quebrado), false);
});

test('estados adulterados são recusados pela validação', () => {
  const adulterar = [
    ['caixa negativo', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: -10000, tipo: 'x', descricao: 'x' })],
    ['3 em andamento', (e) => { const c = E.carta(e, 'pilcha'); c.coluna = 'andamento'; c.custoPago = 60; c.equipe = ['agatha']; E.carta(e, 'cuca').coluna = 'andamento'; E.carta(e, 'cuca').custoPago = 0; }],
    ['pessoa em dois projetos', (e) => { const c = E.carta(e, 'pilcha'); c.coluna = 'andamento'; c.custoPago = 60; c.equipe = ['dexter']; }],
    ['concluído sem recompensa', (e) => { const c = E.carta(e, 'mateada'); c.coluna = 'concluido'; c.progresso = 1; c.revisor = 'sumindo'; }],
    ['recompensa dupla', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: 80, tipo: 'retorno', descricao: 'Concluído: Mateada' })],
    ['missão desconhecida', (e) => { e.missaoId = 'festa_secreta'; }],
    ['card de outra missão', (e) => { e.cartas[0].projetoId = 'barraca'; e.cartas[0].id = 'barraca'; }],
    ['rodada 9', (e) => { e.rodada = 9; }],
    ['fase inventada', (e) => { e.fase = 'trapaça'; }],
    ['revisão sem execução', (e) => { const c = E.carta(e, 'pilcha'); c.coluna = 'revisao'; c.custoPago = 60; c.progresso = 0; }],
    ['andamento sem pagar', (e) => { E.carta(e, 'tche_musica').custoPago = null; }],
    ['caixa inicial trocado', (e) => { e.livro[0].valor = 5000; }],
    ['versão antiga', (e) => { e.versao = 0; }],
    ['evento repetido no baralho', (e) => { e.baralho[2] = e.baralho[0]; }],
    ['temporário que não é temporário', (e) => { e.temporarios.push({ pessoaId: 'antune', ateRodada: 3 }); }],
    ['revisor voluntário', (e) => { e.revisoresDaRodada.push('wesley'); }],
  ];
  adulterar.forEach(([nome, fn]) => {
    const e = JSON.parse(JSON.stringify(partidaNoMeio()));
    fn(e);
    const v = OG.persistencia.validarEstado(e);
    assert.equal(v.ok, false, 'deveria recusar: ' + nome);
    const a = armazenamentoFalso();
    a.setItem(OG.persistencia.CHAVE, JSON.stringify(e));
    assert.equal(OG.persistencia.carregar(a).estado, null, 'carregar deveria descartar: ' + nome);
  });
  assert.equal(OG.persistencia.validarEstado(null).ok, false);
  assert.equal(OG.persistencia.validarEstado('texto').ok, false);
});

test('reiniciar: a partida nova não herda nada da anterior', () => {
  const a = armazenamentoFalso();
  const velha = partidaNoMeio();
  OG.persistencia.salvar(velha, a);
  const nova = OG.motor.criarPartida('farroupilha', 4242);
  OG.persistencia.salvar(nova, a);
  const r = OG.persistencia.carregar(a).estado;
  assert.equal(r.rodada, 1);
  assert.ok(r.cartas.every((c) => c.coluna === 'backlog'));
  assert.deepEqual(h.recursos(r), { dinheiro: 500, prestigio: 20, tradicao: 20 });
  assert.equal(r.livro.length, 3);
  assert.equal(r.temporarios.length + r.doentes.length + r.descontosPendentes.length + r.revisoresDaRodada.length, 0);
  OG.persistencia.apagar(a);
  assert.equal(OG.persistencia.carregar(a).problema, 'vazio');
});
