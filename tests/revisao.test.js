/* Revisão: outro coordenador confere, 1 por rodada, e quem para no meio de um projeto atrasa o próprio. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, id, carta, ok, falha, confirmar, iniciar, revisar, encerrar, proximaRodada, col } = h;

test('ninguém revisa o próprio projeto, e voluntário não revisa', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'mateada'), revisorId: 'antune' }, /Antune tocou este projeto: ninguém revisa o próprio trabalho/);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'mateada'), revisorId: 'agatha' }, /Só coordenadores/);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'mateada'), revisorId: 'ninguem' }, /Escolha um coordenador/);
  e = revisar(e, 'mateada', 'luize');
  assert.equal(carta(e, 'mateada').revisor, 'luize');
});

test('cada coordenador revisa no máximo 1 projeto por rodada', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'pilcha', 'sumindo', ['wesley', 'patrick', 'maicon']);
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'ryani');
  assert.ok(E.revisouNestaRodada(e, 'ryani'));
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'pilcha'), revisorId: 'ryani' }, /Ryani já revisou um projeto nesta rodada/);
  e = revisar(e, 'pilcha', 'jv');
  // Na rodada seguinte, Ryani pode revisar de novo.
  e = proximaRodada(e);
  assert.equal(E.revisouNestaRodada(e, 'ryani'), false);
});

test('quem para no meio de um projeto para revisar deixa o próprio projeto parado na rodada', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'tche_musica', 'antune', ['agatha', 'giulie']); // 2 rodadas
  e = iniciar(e, 'mateada', 'sumindo', ['patrick', 'monica', 'wiky']); // 1 rodada
  e = proximaRodada(e);
  assert.equal(col(e, 'mateada'), 'revisao');
  // Antune está no meio da Tchê Música (começou na rodada 1).
  assert.equal(E.projetoParadoSeRevisar(e, 'antune').projetoId, 'tche_musica');
  e = revisar(e, 'mateada', 'antune');
  assert.ok(e.historico.some((x) => /Antune parou para revisar: Tchê Música não avança nesta rodada/.test(x.texto)));
  e = encerrar(e);
  assert.equal(carta(e, 'tche_musica').progresso, 1, 'não podia avançar');
  assert.ok(e.resumo.linhas.some((l) => /Tchê Música ficou parado: Antune parou para revisar/.test(l.texto)));
  e = ok(e, { tipo: 'AVANCAR' });
  e = confirmar(e);
  e = encerrar(e);
  assert.equal(col(e, 'tche_musica'), 'revisao', 'voltou a andar na rodada seguinte');
});

test('quem estava livre no começo da rodada revisa sem custo, mesmo começando um projeto depois (ou antes)', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'pilcha', 'sumindo', ['patrick', 'monica', 'wiky']);
  e = proximaRodada(e);
  // Luize começa um projeto nesta rodada e depois revisa: não para nada.
  e = iniciar(e, 'deco_farroupilha', 'luize', ['dexter', 'maicon']);
  assert.equal(E.projetoParadoSeRevisar(e, 'luize'), null);
  e = revisar(e, 'mateada', 'luize');
  // JV revisa primeiro e começa depois: também sem custo.
  e = revisar(e, 'pilcha', 'jv');
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  e = encerrar(e);
  assert.equal(col(e, 'deco_farroupilha'), 'revisao');
  assert.equal(col(e, 'cuca'), 'revisao');
});

test('coordenador doente não revisa', () => {
  let e = confirmar(novo({ baralho: ['ev_viral', 'ev_influenza'] }));
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = encerrar(e);
  e = ok(e, { tipo: 'AVANCAR' });
  assert.equal(e.eventoAtual.id, 'ev_influenza');
  e.eventoAtual.alvo = 'jv'; // força o sorteio para o teste
  e = confirmar(e);
  assert.equal(E.statusPessoa(e, 'jv').codigo, 'doente');
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'mateada'), revisorId: 'jv' }, /JV está com influenza/);
  revisar(e, 'mateada', 'sumindo');
});

test('sem nenhum coordenador que possa revisar, a revisão é recusada com explicação', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  e.revisoresDaRodada = ['sumindo', 'luize', 'ryani', 'jv'];
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'mateada'), revisorId: 'jv' }, /Nenhum coordenador pode revisar agora/);
  assert.equal(OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'concluido').ok, false);
});
