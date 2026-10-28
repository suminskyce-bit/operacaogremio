/* Persistência: salvar, carregar, validar (inclusive estados adulterados) e reiniciar. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, id, carta, ok, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada } = h;

function armazenamentoFalso() {
  const dados = {};
  return {
    getItem: (k) => (k in dados ? dados[k] : null),
    setItem: (k, v) => { dados[k] = String(v); },
    removeItem: (k) => { delete dados[k]; },
    _dados: dados,
  };
}

/**
 * Rodada 2 de uma partida com um pouco de tudo: card concluído, card em andamento com
 * Patrício (temporário) na equipe, card em A FAZER, desconto pendente e pedidos no Backlog.
 */
function partidaNoMeio() {
  let e = confirmar(novo({ baralho: ['ev_patricio', 'ev_material', 'ev_viral', 'ev_viral'] }));
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'tche_musica', 'sumindo', ['patricio', 'dexter']); // 1 + 2 + 2 = 5; 2 rodadas
  e = planejar(e, 'cuca', 'jv');
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'luize');
  return e;
}

const copia = (e) => JSON.parse(JSON.stringify(e));

test('a partida de teste é válida e tem de tudo um pouco', () => {
  const e = partidaNoMeio();
  h.valido(e);
  assert.equal(carta(e, 'mateada').coluna, 'concluido');
  assert.equal(carta(e, 'tche_musica').coluna, 'andamento');
  assert.equal(carta(e, 'cuca').coluna, 'afazer');
  assert.equal(e.temporarios.length, 1);
  assert.equal(e.descontosPendentes.length, 1);
  assert.ok(e.cartas.some((c) => c.origem === 'pedido'));
});

test('salvar e carregar devolve exatamente a mesma partida', () => {
  const a = armazenamentoFalso();
  const e = partidaNoMeio();
  assert.equal(OG.persistencia.salvar(e, a), true);
  const r = OG.persistencia.carregar(a);
  assert.equal(r.problema, null);
  assert.deepEqual(r.estado, e);
});

test('salvar e carregar em cada passo de uma partida inteira (com eventos de verdade) não muda nada', () => {
  [4, 8].forEach((duracao) => {
    const a = armazenamentoFalso();
    let e = OG.motor.criarPartida({ missaoId: 'halloween', duracao: duracao, semente: 2024 + duracao });
    let passos = 0;
    while (e.fase !== 'fim') {
      e = ok(e, OG.planejador.decidir(e));
      assert.equal(OG.persistencia.salvar(e, a), true);
      const r = OG.persistencia.carregar(a);
      assert.equal(r.problema, null, 'passo ' + passos + ' (' + e.fase + '): ' + r.motivo);
      assert.deepEqual(r.estado, e);
      passos++;
    }
    assert.ok(passos > 20);
  });
});

test('recarregar no meio de uma decisão de fim de rodada mantém a decisão pendente', () => {
  const a = armazenamentoFalso();
  let e = confirmar(novo({ baralho: ['ev_viral', 'ev_reuniao', 'ev_viral', 'ev_viral'] }));
  e = proximaRodada(e);
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'pilcha', 'sumindo', ['patrick', 'monica', 'wiky']);
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  assert.equal(e.fase, 'decisao');
  OG.persistencia.salvar(e, a);
  const r = OG.persistencia.carregar(a);
  assert.equal(r.estado.fase, 'decisao');
  assert.ok(OG.eventos.decisaoFimRodada(r.estado));
});

test('o sorteio continua o mesmo depois de recarregar (a influenza não é sorteada de novo)', () => {
  const a = armazenamentoFalso();
  const e = novo({ baralho: ['ev_influenza', 'ev_viral'], semente: 99 });
  OG.persistencia.salvar(e, a);
  const r = OG.persistencia.carregar(a);
  assert.equal(r.estado.eventoAtual.alvo, e.eventoAtual.alvo);
  assert.equal(r.estado.rng, e.rng);
});

test('regressão: card planejado e vencido na mesma rodada não invalida a partida salva no resumo', () => {
  const a = armazenamentoFalso();
  let e = confirmar(novo());
  for (let r = 1; r <= 3; r++) e = proximaRodada(e);
  e = planejar(e, 'pilcha', 'antune'); // rodada 4: prazo 4, vence no fim da rodada
  e = encerrar(e);
  assert.ok(!e.cartas.some((c) => c.projetoId === 'pilcha'));
  assert.ok(e.arquivo.some((x) => x.projetoId === 'pilcha' && x.coluna === 'afazer' && x.responsavel === 'antune'));
  OG.persistencia.salvar(e, a);
  const r = OG.persistencia.carregar(a);
  assert.equal(r.problema, null, r.motivo);
  assert.equal(r.estado.fase, 'resumo');
});

test('JSON quebrado é descartado sem derrubar o jogo', () => {
  const a = armazenamentoFalso();
  a.setItem(OG.persistencia.CHAVE, '{isso não é json');
  const r = OG.persistencia.carregar(a);
  assert.equal(r.estado, null);
  assert.equal(r.problema, 'corrompido');
  assert.equal(a.getItem(OG.persistencia.CHAVE), null);
});

test('partida salva pela versão 1.0 é reconhecida como antiga e descartada', () => {
  const a = armazenamentoFalso();
  a.setItem(OG.persistencia.CHAVE, JSON.stringify({ versao: 1, missaoId: 'farroupilha', rodada: 2, cartas: [] }));
  const r = OG.persistencia.carregar(a);
  assert.equal(r.estado, null);
  assert.equal(r.problema, 'antigo');
  assert.equal(a.getItem(OG.persistencia.CHAVE), null);
});

test('armazenamento vazio ou indisponível', () => {
  assert.equal(OG.persistencia.carregar(armazenamentoFalso()).problema, 'vazio');
  const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('cheio'); }, removeItem: () => {} };
  assert.equal(OG.persistencia.carregar(quebrado).problema, 'indisponivel');
  assert.equal(OG.persistencia.salvar(partidaNoMeio(), quebrado), false);
});

test('estados adulterados são recusados pela validação, cada um pelo motivo certo', () => {
  const tche = (e) => carta(e, 'tche_musica');
  const comCucaIniciada = (e) => iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  const casos = [
    ['caixa negativo', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: -10000, tipo: 'despesa', descricao: 'x' }), /recurso negativo/],
    ['coordenador tocando dois projetos', (e) => { e = comCucaIniciada(e); carta(e, 'cuca').responsavel = 'sumindo'; return e; }, /coordenador tocando dois projetos/],
    ['pessoa em duas equipes', (e) => { e = comCucaIniciada(e); carta(e, 'cuca').equipe = ['wesley', 'dexter']; return e; }, /pessoa em duas equipes: dexter/],
    ['coordenador na equipe', (e) => { tche(e).equipe.push('luize'); }, /coordenador ou pessoa desconhecida na equipe/],
    ['pessoa inventada na equipe', (e) => { tche(e).equipe.push('fulano'); }, /coordenador ou pessoa desconhecida na equipe/],
    ['concluído sem receber', (e) => {
      Object.assign(tche(e), { coluna: 'concluido', progresso: 2, equipe: [], revisor: 'luize', concluidoNaRodada: 2, noPrazo: true, retornoRecebido: 250, recompensado: true });
    }, /retorno pago errado/],
    ['retorno pago duas vezes', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: 80, tipo: 'retorno', descricao: 'Concluído: Mateada', cartaId: id(e, 'mateada') }), /retorno pago errado/],
    ['custo cobrado duas vezes', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: -20, tipo: 'custo', descricao: 'Início: Mateada', cartaId: id(e, 'mateada') }), /custo cobrado errado/],
    ['custo sem card', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: -20, tipo: 'custo', descricao: 'Início: ?' }), /lançamento de card desconhecido/],
    ['prestígio do projeto em dobro', (e) => e.livro.push({ rodada: 2, recurso: 'prestigio', valor: 5, tipo: 'pontos', descricao: 'x', cartaId: id(e, 'mateada') }), /pontos do projeto errados/],
    ['missão desconhecida', (e) => { e.config.missaoId = 'festa_secreta'; }, /missão desconhecida/],
    ['duração inválida', (e) => { e.config.duracao = 5; }, /duração inválida/],
    ['card trocado de projeto', (e) => { e.cartas.find((c) => c.coluna === 'backlog').projetoId = 'barraca'; }, /card adulterado/],
    ['prazo esticado', (e) => { e.cartas.find((c) => c.coluna === 'backlog').prazo += 5; }, /card adulterado/],
    ['card sumiu do quadro', (e) => { e.cartas = e.cartas.filter((c) => c.id !== e.cartas.find((x) => x.coluna === 'backlog').id); }, /card sumiu/],
    ['card inventado', (e) => { e.cartas.push(Object.assign({}, e.cartas[0], { id: 'c999' })); }, /card desconhecido/],
    ['card repetido', (e) => { e.cartas.push(Object.assign({}, e.cartas.find((c) => c.coluna === 'backlog'))); }, /card repetido/],
    ['card arquivado antes do prazo', (e) => {
      const c = e.cartas.find((x) => x.coluna === 'backlog');
      e.cartas = e.cartas.filter((x) => x !== c);
      e.arquivo.push({ id: c.id, projetoId: c.projetoId, origem: c.origem, missaoId: c.missaoId, chegada: c.chegada, prazo: c.prazo, coluna: 'backlog', responsavel: null, custoPago: null, rodada: 2, motivo: 'vencido' });
    }, /card vencido adulterado/],
    ['rodada além da duração', (e) => { e.rodada = 9; }, /rodada inválida/],
    ['fase inventada', (e) => { e.fase = 'trapaça'; }, /fase inválida/],
    ['revisão sem execução completa', (e) => { Object.assign(tche(e), { coluna: 'revisao', equipe: [] }); }, /revisão sem execução completa/],
    ['em andamento sem pagar', (e) => { tche(e).custoPago = null; }, /sem custo pago/],
    ['tempo do projeto encurtado', (e) => { tche(e).tempoTotal = 1; }, /tempo do projeto adulterado/],
    ['custo pago maior que o custo do card', (e) => { carta(e, 'mateada').custoPago = 1000; }, /custo pago inválido/],
    ['retorno adulterado', (e) => { carta(e, 'mateada').retornoRecebido = 800; }, /retorno adulterado/],
    ['revisor é o próprio responsável', (e) => { carta(e, 'mateada').revisor = 'antune'; }, /revisor inválido/],
    ['caixa inicial trocado', (e) => { e.livro[0].valor = 5000; }, /caixa inicial adulterado/],
    ['livro-caixa fora de ordem', (e) => { const x = e.livro.pop(); e.livro.splice(1, 0, x); }, /fora de ordem/],
    ['lançamento quebrado', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: 0.5, tipo: 'receita', descricao: 'x' }), /lançamento inválido/],
    ['lançamento no futuro', (e) => e.livro.push({ rodada: 4, recurso: 'prestigio', valor: 10, tipo: 'bonus', descricao: 'x' }), /lançamento inválido/],
    ['receita que o evento não explica', (e) => e.livro.push({ rodada: 2, recurso: 'dinheiro', valor: 150, tipo: 'receita', descricao: 'Patrocínio da Concolores' }), /não explica/],
    ['versão diferente', (e) => { e.versao = 3; }, /versão diferente/],
    ['evento fora de ordem', (e) => { e.baralho[1] = 'ev_patrocinio'; }, /evento fora de ordem/],
    ['baralho com evento inventado', (e) => { e.baralho[3] = 'ev_feriado'; }, /baralho inválido/],
    ['coordenador como temporário', (e) => { e.temporarios.push({ pessoaId: 'antune', ateRodada: 3 }); }, /temporários inválidos/],
    ['Patrício trabalhando sem estar no Grêmio', (e) => { e.temporarios = []; }, /temporário ausente trabalhando/],
    ['voluntário revisando', (e) => { e.revisoresDaRodada.push('wesley'); }, /revisores inválidos/],
    ['agenda adulterada', (e) => { e.agenda[0].data = 9; }, /agenda adulterada/],
    ['missão marcada como cumprida', (e) => { e.agenda[0].cumprida = true; e.agenda[0].cumpridaNaRodada = 2; }, /missão cumprida inconsistente/],
    ['card de A FAZER com equipe', (e) => { carta(e, 'cuca').equipe = ['wesley']; }, /A FAZER inconsistente/],
    ['ordem dos cards', (e) => { e.proximaOrdem = 0; }, /ordem dos cards/],
    ['desconto negativo', (e) => { e.descontosPendentes.push({ tipo: 'percentual', valor: -50, origem: 'x' }); }, /descontos inválidos/],
    ['mutirão de outra rodada', (e) => { e.mutirao = { rodada: 99, usado: false }; }, /mutirão inválido/],
  ];
  casos.forEach(([nome, adulterar, motivo]) => {
    let e = copia(partidaNoMeio());
    const devolvido = adulterar(e); // alguns casos precisam de um estado novo (ex.: iniciar outro card antes)
    if (devolvido && typeof devolvido === 'object' && !Array.isArray(devolvido)) e = devolvido;
    const v = OG.persistencia.validarEstado(copia(e));
    assert.equal(v.ok, false, 'deveria recusar: ' + nome);
    assert.match(v.motivo, motivo, nome + ' -> ' + v.motivo);
    const a = armazenamentoFalso();
    a.setItem(OG.persistencia.CHAVE, JSON.stringify(e));
    const r = OG.persistencia.carregar(a);
    assert.equal(r.estado, null, 'carregar deveria descartar: ' + nome);
    assert.equal(r.problema, 'corrompido', nome);
    assert.equal(a.getItem(OG.persistencia.CHAVE), null, 'o salvo ruim é apagado: ' + nome);
  });
  [null, 'texto', [], {}, { versao: 2 }].forEach((x) => assert.equal(OG.persistencia.validarEstado(x).ok, false, JSON.stringify(x)));
});

test('efeito de evento aplicado duas vezes é recusado', () => {
  const e = copia(confirmar(novo({ baralho: ['ev_patrocinio', 'ev_viral'] })));
  h.valido(e);
  e.livro.push(Object.assign({}, e.livro.find((l) => l.tipo === 'receita')));
  const v = OG.persistencia.validarEstado(e);
  assert.equal(v.ok, false);
  assert.match(v.motivo, /efeito de evento repetido na rodada 1/);
});

test('reiniciar: a partida nova não herda nada da anterior', () => {
  const a = armazenamentoFalso();
  OG.persistencia.salvar(partidaNoMeio(), a);
  const nova = OG.motor.criarPartida({ missaoId: 'farroupilha', duracao: 8, semente: 4242 });
  OG.persistencia.salvar(nova, a);
  const r = OG.persistencia.carregar(a).estado;
  assert.equal(r.rodada, 1);
  assert.equal(r.config.duracao, 8);
  assert.ok(r.cartas.every((c) => c.coluna === 'backlog' && c.chegada === 1));
  assert.deepEqual(h.recursos(r), { dinheiro: 500, prestigio: 20, tradicao: 20 });
  assert.equal(r.livro.length, 3);
  assert.equal(r.arquivo.length, 0);
  assert.equal(r.temporarios.length + r.doentes.length + r.descontosPendentes.length + r.revisoresDaRodada.length, 0);
  OG.persistencia.apagar(a);
  assert.equal(OG.persistencia.carregar(a).problema, 'vazio');
});
