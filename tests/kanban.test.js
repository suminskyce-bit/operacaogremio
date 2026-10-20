/* Kanban: fluxo, limites e movimentos inválidos. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, col } = h;

test('partida nova: 6 cards no BACKLOG, recursos iniciais e evento da rodada 1 esperando', () => {
  const e = OG.motor.criarPartida('farroupilha', 123);
  assert.equal(e.cartas.length, 6);
  assert.ok(e.cartas.every((c) => c.coluna === 'backlog' && c.custoPago === null && c.progresso === 0));
  assert.deepEqual(h.recursos(e), { dinheiro: 500, prestigio: 20, tradicao: 20 });
  assert.equal(e.rodada, 1);
  assert.equal(e.fase, 'evento');
  assert.equal(e.eventoAtual.id, e.baralho[0]);
});

test('nada se move antes de confirmar o evento da rodada', () => {
  const e = novo();
  falha(e, { tipo: 'PLANEJAR', cartaId: 'mateada' }, /evento/);
  falha(e, { tipo: 'ENCERRAR_RODADA' }, /evento/);
});

test('BACKLOG <-> A FAZER funciona e não custa nada', () => {
  let e = confirmar(novo());
  e = planejar(e, 'mateada');
  assert.equal(col(e, 'mateada'), 'afazer');
  e = ok(e, { tipo: 'DESPLANEJAR', cartaId: 'mateada' });
  assert.equal(col(e, 'mateada'), 'backlog');
  assert.equal(h.recursos(e).dinheiro, 550); // 500 + 50 do professor (evento da rodada 1)
});

test('não dá para iniciar direto do BACKLOG', () => {
  const e = confirmar(novo());
  falha(e, { tipo: 'INICIAR', cartaId: 'mateada', equipe: ['antune'] }, /A FAZER/);
  assert.match(OG.kanban.avaliarMovimento(e, 'mateada', 'andamento').motivo, /planeje/i);
});

test('limite de 2 projetos EM ANDAMENTO: o terceiro é recusado com motivo', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', ['antune']);
  e = iniciar(e, 'pilcha', ['agatha']);
  e = planejar(e, 'deco_farroupilha');
  falha(e, { tipo: 'INICIAR', cartaId: 'deco_farroupilha', equipe: ['luize'] }, /Limite atingido/);
  assert.equal(OG.kanban.avaliarMovimento(e, 'deco_farroupilha', 'andamento').ok, false);
});

test('iniciar exige a quantidade exata de pessoas e pessoas distintas', () => {
  let e = confirmar(novo());
  e = planejar(e, 'cuca'); // precisa de 2
  falha(e, { tipo: 'INICIAR', cartaId: 'cuca', equipe: ['jv'] }, /exatamente 2/);
  falha(e, { tipo: 'INICIAR', cartaId: 'cuca', equipe: ['jv', 'jv'] }, /duas vezes/);
  falha(e, { tipo: 'INICIAR', cartaId: 'cuca', equipe: ['jv', 'wesley', 'wliam'] }, /exatamente 2/);
  falha(e, { tipo: 'INICIAR', cartaId: 'cuca', equipe: ['jv', 'fantasma'] }, /desconhecida/);
  falha(e, { tipo: 'INICIAR', cartaId: 'cuca' }, /equipe/);
  ok(e, { tipo: 'INICIAR', cartaId: 'cuca', equipe: ['jv', 'wesley'] });
});

test('a execução não pode ser pulada: EM ANDAMENTO -> REVISÃO só no fim da rodada', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', ['antune']);
  const av = OG.kanban.avaliarMovimento(e, 'mateada', 'revisao');
  assert.equal(av.ok, false);
  assert.match(av.motivo, /não pode ser pulada/);
  falha(e, { tipo: 'REVISAR', cartaId: 'mateada', revisorId: 'sumindo' }, /execução/);
  assert.equal(OG.kanban.avaliarMovimento(e, 'mateada', 'concluido').ok, false);
});

test('cards iniciados não voltam por ação do jogador', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', ['antune']);
  assert.match(OG.kanban.avaliarMovimento(e, 'mateada', 'afazer').motivo, /não voltam/);
  assert.match(OG.kanban.avaliarMovimento(e, 'mateada', 'backlog').motivo, /não voltam/);
  falha(e, { tipo: 'DESPLANEJAR', cartaId: 'mateada' });
});

test('tempo 1: uma rodada de execução, depois revisão por coordenador e CONCLUÍDO', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', ['agatha']);
  e = proximaRodada(e);
  assert.equal(col(e, 'mateada'), 'revisao');
  assert.equal(E.carta(e, 'mateada').progresso, 1);
  e = revisar(e, 'mateada', 'sumindo');
  assert.equal(col(e, 'mateada'), 'concluido');
  assert.match(OG.kanban.avaliarMovimento(e, 'mateada', 'revisao').motivo, /concluídos não mudam/);
});

test('tempo 2: precisa de duas rodadas de execução', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'tche_musica', ['antune', 'giulie']);
  e = proximaRodada(e);
  assert.equal(col(e, 'tche_musica'), 'andamento');
  assert.equal(E.carta(e, 'tche_musica').progresso, 1);
  falha(e, { tipo: 'REVISAR', cartaId: 'tche_musica', revisorId: 'sumindo' });
  e = proximaRodada(e);
  assert.equal(col(e, 'tche_musica'), 'revisao');
  e = revisar(e, 'tche_musica', 'sumindo');
  assert.equal(col(e, 'tche_musica'), 'concluido');
});

test('equipe é liberada quando a execução termina', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', ['agatha']);
  assert.equal(E.statusPessoa(e, 'agatha').codigo, 'ocupado');
  e = proximaRodada(e);
  assert.equal(E.statusPessoa(e, 'agatha').codigo, 'livre');
  assert.deepEqual(E.carta(e, 'mateada').equipeFinal, ['agatha']);
});

test('ordem dos cards: o card movido vai para o fim da coluna de destino', () => {
  let e = confirmar(novo());
  e = planejar(e, 'pilcha');
  e = planejar(e, 'mateada');
  assert.deepEqual(E.cartasNaColuna(e, 'afazer').map((c) => c.id), ['pilcha', 'mateada']);
});

test('ação "atrasada" de outra rodada é recusada', () => {
  let e = confirmar(novo());
  e = proximaRodada(e);
  falha(e, { tipo: 'PLANEJAR', cartaId: 'mateada', rodada: 1 }, /rodada 1/);
  ok(e, { tipo: 'PLANEJAR', cartaId: 'mateada', rodada: 2 });
});

test('ação desconhecida ou malformada não quebra nada', () => {
  const e = confirmar(novo());
  falha(e, { tipo: 'TRAPACEAR' }, /desconhecida/);
  assert.equal(OG.motor.aplicar(e, null).ok, false);
  assert.equal(OG.motor.aplicar(e, {}).ok, false);
  falha(e, { tipo: 'PLANEJAR', cartaId: 'nao_existe' }, /não encontrado/);
});

test('terminaATempo: avisa quando o projeto não conclui antes do fim da partida', () => {
  let e = confirmar(novo());
  assert.equal(E.terminaATempo(e, E.carta(e, 'tche_musica')), true); // rodada 1, tempo 2
  e = proximaRodada(proximaRodada(e)); // rodada 3
  assert.equal(E.terminaATempo(e, E.carta(e, 'tche_musica')), false);
  assert.equal(E.terminaATempo(e, E.carta(e, 'mateada')), true);
  e = proximaRodada(e); // rodada 4
  assert.equal(E.terminaATempo(e, E.carta(e, 'mateada')), false);
});

test('fim de partida: depois de 4 rodadas nenhuma ação de jogo é aceita', () => {
  let e = confirmar(novo());
  for (let r = 1; r <= 3; r++) e = proximaRodada(e);
  assert.equal(e.rodada, 4);
  e = encerrar(e);
  e = ok(e, { tipo: 'AVANCAR' });
  assert.equal(e.fase, 'fim');
  assert.equal(e.rodada, 4);
  falha(e, { tipo: 'PLANEJAR', cartaId: 'mateada' }, /acabou/);
  falha(e, { tipo: 'ENCERRAR_RODADA' });
  falha(e, { tipo: 'AVANCAR' });
});
