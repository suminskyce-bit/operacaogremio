/* Funcionários: ocupação, revisão, doença, temporário. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada } = h;

const NEUTRO = ['ev_viral', 'ev_viral', 'ev_viral', 'ev_viral'];

test('pessoa ocupada não pode trabalhar em dois projetos ao mesmo tempo', () => {
  let e = confirmar(novo('farroupilha', NEUTRO));
  e = iniciar(e, 'mateada', ['antune']);
  e = planejar(e, 'pilcha');
  falha(e, { tipo: 'INICIAR', cartaId: 'pilcha', equipe: ['antune'] }, /Antune não está disponível: em mateada do mesquita/i);
  assert.equal(E.statusPessoa(e, 'antune').codigo, 'ocupado');
  assert.equal(E.statusPessoa(e, 'antune').cartaId, 'mateada');
});

test('só coordenador revisa; voluntário é recusado com explicação', () => {
  let e = confirmar(novo('farroupilha', NEUTRO));
  e = iniciar(e, 'mateada', ['agatha']);
  e = proximaRodada(e);
  falha(e, { tipo: 'REVISAR', cartaId: 'mateada', revisorId: 'agatha' }, /Só coordenadores/);
  falha(e, { tipo: 'REVISAR', cartaId: 'mateada', revisorId: 'ninguem' }, /coordenador/);
  ok(e, { tipo: 'REVISAR', cartaId: 'mateada', revisorId: 'ryani' });
});

test('coordenador ocupado em projeto não revisa; quem revisou fica ocupado até o fim da rodada', () => {
  let e = confirmar(novo('farroupilha', NEUTRO));
  e = iniciar(e, 'mateada', ['agatha']);
  e = iniciar(e, 'pilcha', ['giulie']);
  e = proximaRodada(e);
  e = iniciar(e, 'deco_farroupilha', ['luize']);
  falha(e, { tipo: 'REVISAR', cartaId: 'mateada', revisorId: 'luize' }, /não está disponível/);
  e = revisar(e, 'mateada', 'sumindo');
  assert.equal(E.statusPessoa(e, 'sumindo').codigo, 'revisando');
  falha(e, { tipo: 'REVISAR', cartaId: 'pilcha', revisorId: 'sumindo' }, /revisou/);
  // Revisor também não pode ser escalado para executar nesta rodada.
  e = planejar(e, 'camp_concolor');
  falha(e, { tipo: 'INICIAR', cartaId: 'camp_concolor', equipe: ['sumindo', 'deyverson'] }, /revisou/);
  // Na rodada seguinte, Sumindo volta.
  e = proximaRodada(e);
  assert.equal(E.statusPessoa(e, 'sumindo').codigo, 'livre');
});

test('sem coordenador livre não há revisão', () => {
  let e = confirmar(novo('junina', NEUTRO));
  e = iniciar(e, 'correio', ['patrick']);
  e = iniciar(e, 'pescaria', ['wliam']);
  e = proximaRodada(e);
  e = iniciar(e, 'barraca', ['jv', 'luize']);
  e = iniciar(e, 'som_festa', ['ryani']);
  e = revisar(e, 'correio', 'sumindo');
  e = revisar(e, 'pescaria', 'antune');
  // Rodada 2: Sumindo e Antune revisaram; JV, Luize e Ryani estão em projetos.
  assert.equal(E.coordenadoresLivres(e).length, 0);
});

test('influenza: a pessoa sorteada estava livre, não pode ser escalada e volta na rodada seguinte', () => {
  let e = novo('farroupilha', ['ev_influenza', 'ev_viral', 'ev_viral', 'ev_viral'], 77);
  const doente = e.eventoAtual.alvo;
  assert.ok(doente);
  e = confirmar(e);
  assert.equal(E.statusPessoa(e, doente).codigo, 'doente');
  e = planejar(e, 'mateada');
  falha(e, { tipo: 'INICIAR', cartaId: 'mateada', equipe: [doente] }, /influenza/);
  assert.ok(!E.coordenadoresLivres(e).some((p) => p.id === doente), 'doente também não revisa');
  e = encerrar(e);
  assert.ok(e.resumo.linhas.some((l) => /se recuperou da influenza/.test(l.texto)));
  e = ok(e, { tipo: 'AVANCAR' });
  assert.equal(E.statusPessoa(e, doente).codigo, 'livre');
});

test('influenza sorteia sempre alguém livre, de forma determinística pela semente', () => {
  const a = novo('farroupilha', ['ev_influenza', 'ev_viral', 'ev_viral', 'ev_viral'], 5);
  const b = novo('farroupilha', ['ev_influenza', 'ev_viral', 'ev_viral', 'ev_viral'], 5);
  assert.equal(a.eventoAtual.alvo, b.eventoAtual.alvo);
  // Com gente ocupada, o sorteado nunca é quem está em projeto.
  for (let s = 1; s <= 40; s++) {
    let e = confirmar(novo('farroupilha', ['ev_viral', 'ev_influenza', 'ev_viral', 'ev_viral'], s));
    e = iniciar(e, 'tche_musica', ['antune', 'giulie']);
    e = encerrar(e);
    e = ok(e, { tipo: 'AVANCAR' });
    assert.ok(!['antune', 'giulie'].includes(e.eventoAtual.alvo), 'semente ' + s);
    assert.ok(e.eventoAtual.alvo !== 'patricio');
  }
});

test('Patrício não está disponível sem o evento', () => {
  let e = confirmar(novo('farroupilha', NEUTRO));
  e = planejar(e, 'mateada');
  assert.equal(E.statusPessoa(e, 'patricio').codigo, 'ausente');
  falha(e, { tipo: 'INICIAR', cartaId: 'mateada', equipe: ['patricio'] }, /não está disponível/);
});

test('Patrício Ajudou: temporário por 2 rodadas, coringa, e vai embora na hora certa', () => {
  let e = confirmar(novo('farroupilha', ['ev_patricio', 'ev_viral', 'ev_viral', 'ev_viral']));
  assert.equal(E.statusPessoa(e, 'patricio').codigo, 'livre');
  assert.equal(E.rodadasRestantes(e, 'patricio'), 2);
  // Coringa: desconto em qualquer categoria.
  assert.equal(OG.financas.calcularCusto(e, E.carta(e, 'camp_concolor'), ['patricio', 'wesley']).final, 50);
  e = iniciar(e, 'mateada', ['patricio']);
  e = proximaRodada(e); // rodada 2: última dele
  assert.equal(E.rodadasRestantes(e, 'patricio'), 1);
  assert.equal(E.statusPessoa(e, 'patricio').codigo, 'livre');
  // No limite da duração: não pode entrar num projeto de 2 rodadas.
  e = planejar(e, 'tche_musica');
  falha(e, { tipo: 'INICIAR', cartaId: 'tche_musica', equipe: ['patricio', 'antune'] }, /só fica mais 1 rodada/);
  // Mas pode num de 1 rodada.
  e = iniciar(e, 'pilcha', ['patricio']);
  e = proximaRodada(e); // rodada 3: ele já foi
  assert.equal(E.statusPessoa(e, 'patricio').codigo, 'ausente');
  assert.equal(e.temporarios.length, 0);
  assert.equal(E.carta(e, 'pilcha').coluna, 'revisao');
});

test('temporário que vai embora com projeto parado deixa a equipe incompleta; completar a equipe resolve', () => {
  let e = confirmar(novo('farroupilha', ['ev_patricio', 'ev_reuniao', 'ev_viral', 'ev_viral']));
  e = iniciar(e, 'tche_musica', ['patricio', 'antune']); // 2 rodadas, Patrício fica 2: ok
  e = proximaRodada(e); // rodada 2: Reunião (R$ 30) — confirma
  assert.equal(e.eventoAtual.id, 'ev_reuniao');
  // Fim da rodada 2: só Tchê Música em andamento -> parada automática.
  e = encerrar(e);
  assert.equal(e.fase, 'resumo');
  assert.equal(E.carta(e, 'tche_musica').progresso, 1);
  assert.ok(e.resumo.linhas.some((l) => /Patrício foi embora e deixou Tchê Música com a equipe incompleta/.test(l.texto)));
  e = ok(e, { tipo: 'AVANCAR' });
  e = confirmar(e);
  assert.deepEqual(E.carta(e, 'tche_musica').equipe, ['antune']);
  // Sem completar, não avança no fim da rodada 3.
  const semCompletar = encerrar(e);
  assert.equal(E.carta(semCompletar, 'tche_musica').progresso, 1);
  assert.ok(semCompletar.resumo.linhas.some((l) => /falta gente/.test(l.texto)));
  // Completando, avança.
  e = ok(e, { tipo: 'COMPLETAR_EQUIPE', cartaId: 'tche_musica', pessoaId: 'giulie' });
  falha(e, { tipo: 'COMPLETAR_EQUIPE', cartaId: 'tche_musica', pessoaId: 'agatha' }, /completa/);
  e = encerrar(e);
  assert.equal(E.carta(e, 'tche_musica').coluna, 'revisao');
});
