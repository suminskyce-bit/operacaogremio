/* Pessoas: força de trabalho, ocupação, doença e temporário. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, id, carta, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada } = h;

test('força: coordenador soma 1, voluntário 1, especialista 2 (Dexter também com equipamento, Patrício em tudo)', () => {
  const mateada = E.projeto('mateada'); // cultura, fornecedor
  const som = E.projeto('som_festa'); // estrutura, equipamento
  const tche = E.projeto('tche_musica'); // cultura, equipamento
  assert.equal(E.forcaVoluntario('agatha', mateada), 2);
  assert.equal(E.forcaVoluntario('wesley', mateada), 1);
  assert.equal(E.forcaVoluntario('dexter', tche), 2, 'Dexter é técnico: projetos com equipamento');
  assert.equal(E.forcaVoluntario('dexter', mateada), 1);
  assert.equal(E.forcaVoluntario('patricio', mateada), 2);
  assert.equal(E.forcaVoluntario('antune', mateada), 0, 'coordenador não entra como voluntário');
  assert.equal(E.forcaDaEquipe(som, true, ['dexter', 'maicon']), 5);
  assert.equal(E.forcaNecessaria(mateada), 4);
  assert.equal(E.forcaNecessaria(tche), 5);
  assert.deepEqual(E.voluntariosSobrando(mateada, ['agatha', 'giulie']), []);
  // 1 + 2 + 1 + 1 = 5 de 4: Wesley OU Maicon pode sair (Agatha não: sem ela fica 3).
  assert.deepEqual(E.voluntariosSobrando(mateada, ['agatha', 'wesley', 'maicon']), ['wesley', 'maicon']);
  // 1 + 2 + 2 + 1 = 6 de 4: qualquer um sai sozinho.
  assert.deepEqual(E.voluntariosSobrando(mateada, ['agatha', 'giulie', 'wesley']), ['agatha', 'giulie', 'wesley']);
});

test('equipe com sobra: a mensagem diz que basta tirar um (com "ou"), não todos', () => {
  let e = confirmar(novo());
  e = planejar(e, 'mateada', 'antune');
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'mateada'), equipe: ['agatha', 'wesley', 'maicon'] },
    /dá para tirar Wesley ou Maicon e a força continua suficiente/);
});

test('especialistas economizam gente: sem eles o mesmo projeto precisa de mais pessoas', () => {
  let e = confirmar(novo());
  const comEspecialistas = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  const semEspecialistas = iniciar(e, 'cuca', 'jv', ['agatha', 'patrick', 'maicon', 'monica']);
  assert.equal(E.voluntariosLivres(comEspecialistas).length, 10);
  assert.equal(E.voluntariosLivres(semEspecialistas).length, 8);
});

test('pessoa ocupada não entra em outra equipe; coordenador não entra em equipe de ninguém', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = planejar(e, 'pilcha', 'sumindo');
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['agatha', 'wesley'] }, /Agatha Cross não está disponível: na equipe de mateada do mesquita/i);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['luize', 'wesley', 'patrick'] }, /Luize é coordenador/);
  assert.equal(E.statusPessoa(e, 'agatha').codigo, 'ocupado');
  assert.equal(E.statusPessoa(e, 'agatha').cartaId, id(e, 'mateada'));
  assert.equal(E.statusPessoa(e, 'antune').codigo, 'tocando');
});

test('influenza: a pessoa sorteada estava livre, fica indisponível e volta na rodada seguinte', () => {
  let e = novo({ baralho: ['ev_influenza', 'ev_viral'], semente: 77 });
  const doente = e.eventoAtual.alvo;
  assert.ok(doente);
  e = confirmar(e);
  assert.equal(E.statusPessoa(e, doente).codigo, 'doente');
  assert.ok(!E.pessoasLivres(e).some((p) => p.id === doente));
  e = encerrar(e);
  assert.ok(e.resumo.linhas.some((l) => /se recuperou da influenza/.test(l.texto)));
  e = ok(e, { tipo: 'AVANCAR' });
  assert.equal(E.statusPessoa(e, doente).codigo, 'livre');
});

test('influenza num coordenador: ele não começa projeto nesta rodada', () => {
  let e = novo({ baralho: ['ev_influenza', 'ev_viral'] });
  e.eventoAtual.alvo = 'antune';
  e = confirmar(e);
  e = planejar(e, 'mateada', 'antune'); // planejar pode
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'mateada'), equipe: ['agatha', 'giulie'] }, /Antune está com influenza/);
  e = proximaRodada(e);
  ok(e, { tipo: 'INICIAR', cartaId: id(e, 'mateada'), equipe: ['agatha', 'giulie'] });
});

test('influenza sorteia sempre alguém livre (nunca quem está em projeto), de forma determinística', () => {
  const a = novo({ baralho: ['ev_influenza'], semente: 5 });
  const b = novo({ baralho: ['ev_influenza'], semente: 5 });
  assert.equal(a.eventoAtual.alvo, b.eventoAtual.alvo);
  for (let s = 1; s <= 40; s++) {
    let e = confirmar(novo({ baralho: ['ev_viral', 'ev_influenza'], semente: s }));
    e = iniciar(e, 'tche_musica', 'antune', ['agatha', 'giulie']);
    e = encerrar(e);
    e = ok(e, { tipo: 'AVANCAR' });
    assert.ok(!['antune', 'agatha', 'giulie', 'patricio'].includes(e.eventoAtual.alvo), 'semente ' + s);
  }
});

test('Patrício não está disponível sem o evento', () => {
  let e = confirmar(novo());
  e = planejar(e, 'mateada', 'antune');
  assert.equal(E.statusPessoa(e, 'patricio').codigo, 'ausente');
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'mateada'), equipe: ['patricio', 'agatha'] }, /Patrício não está disponível/);
});

test('Patrício Ajudou: temporário por 2 rodadas, coringa (soma 2 em tudo), e vai embora na hora certa', () => {
  let e = confirmar(novo({ baralho: ['ev_patricio', 'ev_viral', 'ev_viral', 'ev_viral'] }));
  assert.equal(E.statusPessoa(e, 'patricio').codigo, 'livre');
  assert.equal(E.rodadasRestantes(e, 'patricio'), 2);
  e = iniciar(e, 'camp_concolor', 'sumindo', ['patricio', 'deyverson']); // 1 + 2 + 2 = 5
  e = proximaRodada(e); // rodada 2: última dele
  assert.equal(E.rodadasRestantes(e, 'patricio'), 1);
  // No limite da estadia: não entra em projeto de 2 rodadas...
  e = planejar(e, 'tche_musica', 'antune');
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'tche_musica'), equipe: ['patricio', 'agatha'] }, /Patrício só fica mais 1 rodada/);
  // ...nem num de 1 rodada tocado fora da área (vira 2).
  e = planejar(e, 'pilcha', 'luize');
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['patricio', 'giulie'] }, /Patrício só fica mais 1 rodada/);
  e = ok(e, { tipo: 'TROCAR_RESPONSAVEL', cartaId: id(e, 'pilcha'), responsavel: 'sumindo' });
  e = ok(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['patricio', 'giulie'] });
  e = proximaRodada(e); // rodada 3: ele já foi
  assert.equal(E.statusPessoa(e, 'patricio').codigo, 'ausente');
  assert.equal(e.temporarios.length, 0);
  assert.equal(carta(e, 'pilcha').coluna, 'revisao');
  h.valido(e);
});

test('temporário que vai embora com projeto parado deixa a equipe fraca; completar a equipe resolve', () => {
  let e = confirmar(novo({ baralho: ['ev_patricio', 'ev_reuniao', 'ev_viral', 'ev_viral'] }));
  e = iniciar(e, 'tche_musica', 'antune', ['patricio', 'agatha']); // 2 rodadas; Patrício fica 2: ok
  e = proximaRodada(e); // rodada 2: Reunião (R$ 30)
  assert.equal(e.eventoAtual.id, 'ev_reuniao');
  e = encerrar(e); // só a Tchê Música em andamento: parada automática
  assert.equal(e.fase, 'resumo');
  assert.equal(carta(e, 'tche_musica').progresso, 1);
  assert.ok(e.resumo.linhas.some((l) => /Patrício foi embora e saiu da equipe de Tchê Música. Complete a equipe/.test(l.texto)));
  e = ok(e, { tipo: 'AVANCAR' });
  e = confirmar(e);
  assert.deepEqual(carta(e, 'tche_musica').equipe, ['agatha']);
  // Sem completar, não avança.
  const semCompletar = encerrar(e);
  assert.equal(carta(semCompletar, 'tche_musica').progresso, 1);
  assert.ok(semCompletar.resumo.linhas.some((l) => /a equipe tem força 3 de 5/.test(l.texto)));
  // Completando, avança.
  falha(e, { tipo: 'COMPLETAR_EQUIPE', cartaId: id(e, 'tche_musica'), pessoaId: 'sumindo' }, /Sumindo é coordenador/);
  e = ok(e, { tipo: 'COMPLETAR_EQUIPE', cartaId: id(e, 'tche_musica'), pessoaId: 'giulie' });
  falha(e, { tipo: 'COMPLETAR_EQUIPE', cartaId: id(e, 'tche_musica'), pessoaId: 'wesley' }, /já tem a força necessária/);
  e = encerrar(e);
  assert.equal(carta(e, 'tche_musica').coluna, 'revisao');
  h.valido(e);
});
