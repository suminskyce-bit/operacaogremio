/* Kanban: fluxo, responsável, limites por coordenador e movimentos inválidos. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, id, carta, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, col } = h;

test('partida nova: 8 cards no BACKLOG, recursos iniciais e evento da rodada 1 esperando', () => {
  const e = OG.motor.criarPartida({ missaoId: 'farroupilha', duracao: 4, semente: 123 });
  assert.equal(e.cartas.length, 8);
  assert.ok(e.cartas.every((c) => c.coluna === 'backlog' && c.custoPago === null && c.progresso === 0));
  assert.deepEqual(h.recursos(e), { dinheiro: 500, prestigio: 20, tradicao: 20 });
  assert.equal(e.rodada, 1);
  assert.equal(e.fase, 'evento');
  assert.equal(e.eventoAtual.id, e.baralho[0]);
  assert.equal(e.baralho.length, 4);
});

test('nada se move antes de confirmar o evento da rodada', () => {
  const e = novo();
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'mateada'), responsavel: 'antune' }, /evento/);
  falha(e, { tipo: 'ENCERRAR_RODADA' }, /evento/);
});

test('planejar exige um coordenador responsável; voluntário não pode ser responsável', () => {
  const e = confirmar(novo());
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'mateada') }, /coordenador responsável/);
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'mateada'), responsavel: 'agatha' }, /Só coordenadores/);
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'mateada'), responsavel: 'ninguem' }, /coordenador responsável/);
  const depois = planejar(e, 'mateada', 'antune');
  assert.equal(col(depois, 'mateada'), 'afazer');
  assert.equal(carta(depois, 'mateada').responsavel, 'antune');
  assert.equal(h.recursos(depois).dinheiro, 500, 'planejar não custa nada');
});

test('cada coordenador tem no máximo 2 cards em A FAZER', () => {
  let e = confirmar(novo());
  e = planejar(e, 'mateada', 'antune');
  e = planejar(e, 'pilcha', 'antune');
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'tche_musica'), responsavel: 'antune' }, /Antune já tem 2 projetos em A FAZER/);
  e = planejar(e, 'tche_musica', 'sumindo');
  assert.equal(E.filaDe(e, 'antune').length, 2);
});

test('trocar o responsável em A FAZER e devolver ao BACKLOG', () => {
  let e = confirmar(novo());
  e = planejar(e, 'mateada', 'ryani');
  e = ok(e, { tipo: 'TROCAR_RESPONSAVEL', cartaId: id(e, 'mateada'), responsavel: 'antune' });
  assert.equal(carta(e, 'mateada').responsavel, 'antune');
  falha(e, { tipo: 'TROCAR_RESPONSAVEL', cartaId: id(e, 'mateada'), responsavel: 'antune' }, /já é o responsável/);
  falha(e, { tipo: 'TROCAR_RESPONSAVEL', cartaId: id(e, 'pilcha'), responsavel: 'antune' }, /Só dá para trocar/);
  e = ok(e, { tipo: 'DESPLANEJAR', cartaId: id(e, 'mateada') });
  assert.equal(col(e, 'mateada'), 'backlog');
  assert.equal(carta(e, 'mateada').responsavel, null);
});

test('não dá para iniciar direto do BACKLOG', () => {
  const e = confirmar(novo());
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'mateada'), equipe: ['agatha', 'giulie'] }, /Primeiro planeje/);
  assert.match(OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'andamento').motivo, /planeje/i);
  assert.deepEqual(OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'afazer'), { ok: true, acao: 'planejar' });
});

test('o coordenador trabalha no projeto e toca um projeto por vez', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  assert.equal(E.statusPessoa(e, 'antune').codigo, 'tocando');
  e = planejar(e, 'pilcha', 'antune');
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['wesley', 'patrick', 'maicon'] }, /Antune já está tocando Mateada do Mesquita/);
  // Outro coordenador pode tocar a Pilcha.
  e = ok(e, { tipo: 'TROCAR_RESPONSAVEL', cartaId: id(e, 'pilcha'), responsavel: 'sumindo' });
  e = ok(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['wesley', 'patrick', 'maicon'] });
  assert.equal(E.cartaLideradaPor(e, 'sumindo').projetoId, 'pilcha');
});

test('com os 5 coordenadores dá para ter 5 projetos em andamento ao mesmo tempo', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  e = iniciar(e, 'deco_farroupilha', 'luize', ['dexter', 'maicon']);
  e = iniciar(e, 'camp_concolor', 'sumindo', ['deyverson', 'costit']);
  e = iniciar(e, 'pilcha', 'ryani', ['patrick', 'monica', 'wiky']);
  assert.equal(E.cartasNaColuna(e, 'andamento').length, 5);
  assert.equal(E.coordenadoresLivres(e).length, 0);
  // Sobrou só o Potter: não dá força para mais nada, e não há coordenador livre.
  assert.deepEqual(E.voluntariosLivres(e).map((p) => p.id), ['potter']);
  h.valido(e);
});

test('força: equipe fraca é recusada, equipe com gente sobrando também', () => {
  let e = confirmar(novo());
  e = planejar(e, 'cuca', 'jv'); // logística, 2 trabalhadores: força 5
  assert.equal(E.forcaNecessaria(E.projeto('cuca')), 5);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley'] }, /Força insuficiente: com JV a equipe soma 3/);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['agatha', 'patrick', 'maicon'] }, /soma 4 e Dia da Cuca precisa de 5/);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley', 'wliam', 'patrick'] }, /Equipe maior que o necessário: dá para tirar Patrick e/);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley', 'wesley'] }, /duas vezes/);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley', 'antune'] }, /Antune é coordenador/);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley', 'fantasma'] }, /desconhecida/);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca') }, /equipe/);
  ok(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley', 'wliam'] });
  ok(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley', 'patrick', 'maicon'] });
  ok(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['agatha', 'patrick', 'maicon', 'monica'] });
});

test('falta gente: com os voluntários ocupados o projeto não começa, e o motivo é explicado', () => {
  let e = confirmar(novo());
  // Sem pensar em especialistas: 4 projetos gastam 12 voluntários.
  e = iniciar(e, 'mateada', 'antune', ['patrick', 'monica', 'wiky']);
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'potter', 'maicon']);
  e = iniciar(e, 'deco_farroupilha', 'luize', ['dexter', 'costit']);
  e = iniciar(e, 'camp_concolor', 'ryani', ['deyverson', 'wliam', 'giulie']);
  e = planejar(e, 'tche_musica', 'sumindo'); // força 5: Sumindo 1 + Agatha 2 = 3
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'tche_musica'), equipe: ['agatha'] },
    /Falta gente: este projeto precisa de força 5 e, com Sumindo e os voluntários livres, só dá 3/);
  assert.match(OG.kanban.avaliarMovimento(e, id(e, 'tche_musica'), 'andamento').motivo, /Falta gente/);
});

test('área do coordenador: fora da área o projeto leva +1 rodada; Sumindo nunca está fora', () => {
  let e = confirmar(novo());
  assert.equal(E.tempoComCoordenador(E.projeto('mateada'), 'antune'), 1);
  assert.equal(E.tempoComCoordenador(E.projeto('mateada'), 'ryani'), 2);
  assert.equal(E.tempoComCoordenador(E.projeto('tche_musica'), 'luize'), 3);
  assert.equal(E.tempoComCoordenador(E.projeto('camp_concolor'), 'sumindo'), 1);
  OG.dados.projetos.forEach((p) => assert.equal(E.tempoComCoordenador(p, 'sumindo'), p.tempo));
  e = iniciar(e, 'mateada', 'ryani', ['agatha', 'giulie']);
  assert.equal(carta(e, 'mateada').tempoTotal, 2);
  e = proximaRodada(e);
  assert.equal(col(e, 'mateada'), 'andamento');
  assert.equal(carta(e, 'mateada').progresso, 1);
  e = proximaRodada(e);
  assert.equal(col(e, 'mateada'), 'revisao');
});

test('a execução não pode ser pulada: EM ANDAMENTO -> REVISÃO só no fim da rodada', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  const av = OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'revisao');
  assert.equal(av.ok, false);
  assert.match(av.motivo, /não pode ser pulada/);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'mateada'), revisorId: 'sumindo' }, /execução/);
  assert.equal(OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'concluido').ok, false);
});

test('cards iniciados não voltam por ação do jogador', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  assert.match(OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'afazer').motivo, /não voltam/);
  assert.match(OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'backlog').motivo, /não voltam/);
  falha(e, { tipo: 'DESPLANEJAR', cartaId: id(e, 'mateada') });
  falha(e, { tipo: 'TROCAR_RESPONSAVEL', cartaId: id(e, 'mateada'), responsavel: 'sumindo' }, /Depois de iniciado/);
});

test('tempo 1: uma rodada de execução, revisão por outro coordenador e CONCLUÍDO', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  assert.equal(col(e, 'mateada'), 'revisao');
  assert.equal(carta(e, 'mateada').progresso, 1);
  assert.equal(E.statusPessoa(e, 'antune').codigo, 'livre', 'o coordenador fica livre quando a execução termina');
  assert.equal(E.statusPessoa(e, 'agatha').codigo, 'livre', 'a equipe é liberada');
  assert.deepEqual(carta(e, 'mateada').equipeFinal, ['agatha', 'giulie']);
  e = revisar(e, 'mateada', 'sumindo');
  assert.equal(col(e, 'mateada'), 'concluido');
  assert.match(OG.kanban.avaliarMovimento(e, id(e, 'mateada'), 'revisao').motivo, /concluídos não mudam/);
});

test('tempo 2: precisa de duas rodadas de execução', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'tche_musica', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  assert.equal(col(e, 'tche_musica'), 'andamento');
  assert.equal(carta(e, 'tche_musica').progresso, 1);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'tche_musica'), revisorId: 'sumindo' });
  e = proximaRodada(e);
  assert.equal(col(e, 'tche_musica'), 'revisao');
  e = revisar(e, 'tche_musica', 'sumindo');
  assert.equal(col(e, 'tche_musica'), 'concluido');
});

test('ordem dos cards: o card movido vai para o fim da coluna de destino', () => {
  let e = confirmar(novo());
  e = planejar(e, 'pilcha', 'antune');
  e = planejar(e, 'mateada', 'sumindo');
  assert.deepEqual(E.cartasNaColuna(e, 'afazer').map((c) => c.projetoId), ['pilcha', 'mateada']);
});

test('ação "atrasada" de outra rodada é recusada', () => {
  let e = confirmar(novo());
  e = proximaRodada(e);
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'mateada'), responsavel: 'antune', rodada: 1 }, /rodada 1/);
  ok(e, { tipo: 'PLANEJAR', cartaId: id(e, 'mateada'), responsavel: 'antune', rodada: 2 });
});

test('ação desconhecida ou malformada não quebra nada', () => {
  const e = confirmar(novo());
  falha(e, { tipo: 'TRAPACEAR' }, /desconhecida/);
  assert.equal(OG.motor.aplicar(e, null).ok, false);
  assert.equal(OG.motor.aplicar(e, {}).ok, false);
  falha(e, { tipo: 'PLANEJAR', cartaId: 'nao_existe', responsavel: 'antune' }, /não encontrado/);
});

test('fim de partida: depois da última rodada nenhuma ação de jogo é aceita', () => {
  let e = confirmar(novo());
  for (let r = 1; r <= 3; r++) e = proximaRodada(e);
  assert.equal(e.rodada, 4);
  e = encerrar(e);
  e = ok(e, { tipo: 'AVANCAR' });
  assert.equal(e.fase, 'fim');
  assert.equal(e.rodada, 4);
  falha(e, { tipo: 'ENCERRAR_RODADA' });
  falha(e, { tipo: 'AVANCAR' });
  h.valido(e);
});
