/* Eventos: cada carta, efeitos únicos e regras do baralho. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, recursos, col } = h;

function comEventoNaRodada2(ev, missao) {
  // Rodada 1 neutra, evento testado na rodada 2.
  return novo(missao || 'farroupilha', ['ev_viral', ev, 'ev_viral', 'ev_viral']);
}

test('baralho: 4 eventos sem repetição, ≥1 positivo, ≤1 severo e nunca severo na rodada 1', () => {
  for (let s = 1; s <= 3000; s++) {
    const e = OG.motor.criarPartida('farroupilha', s);
    const b = e.baralho;
    assert.equal(b.length, 4);
    assert.equal(new Set(b).size, 4, 'repetido na semente ' + s);
    assert.ok(b.some((id) => OG.dados.eventosPorId[id].tipo === 'positivo'), 'sem positivo na semente ' + s);
    const severos = b.filter((id) => OG.eventos.SEVEROS.includes(id));
    assert.ok(severos.length <= 1, 'dois severos na semente ' + s);
    assert.ok(!OG.eventos.SEVEROS.includes(b[0]), 'severo na rodada 1 na semente ' + s);
  }
});

test('baralho: todos os 20 eventos aparecem em alguma partida', () => {
  const vistos = new Set();
  for (let s = 1; s <= 500; s++) OG.motor.criarPartida('junina', s).baralho.forEach((id) => vistos.add(id));
  assert.equal(vistos.size, 20);
});

test('evento só é aplicado uma vez (confirmar de novo falha)', () => {
  let e = novo('farroupilha', ['ev_patrocinio', 'ev_viral', 'ev_viral', 'ev_viral']);
  e = confirmar(e);
  assert.equal(recursos(e).dinheiro, 650);
  falha(e, { tipo: 'CONFIRMAR_EVENTO' }, /Não há evento/);
  assert.equal(e.livro.filter((l) => l.descricao === 'Patrocínio da Concolores').length, 1);
});

test('Reunião com a Diretora: R$ 30 agora e um projeto parado no fim da rodada (o jogador escolhe)', () => {
  let e = confirmar(comEventoNaRodada2('ev_reuniao'));
  e = proximaRodada(e);
  assert.equal(recursos(e).dinheiro, 500 - 30);
  e = iniciar(e, 'mateada', ['antune']);
  e = iniciar(e, 'pilcha', ['agatha']);
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  assert.equal(e.fase, 'decisao');
  const dec = OG.eventos.decisaoFimRodada(e);
  assert.deepEqual(dec.opcoes.map((o) => o.id), ['parar:mateada', 'parar:pilcha']);
  falha(e, { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' }, /Escolha/);
  falha(e, { tipo: 'PLANEJAR', cartaId: 'cuca' }, /decida/);
  e = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'parar:pilcha' });
  assert.equal(col(e, 'mateada'), 'revisao');
  assert.equal(col(e, 'pilcha'), 'andamento');
  assert.equal(E.carta(e, 'pilcha').progresso, 0);
});

test('decisão de fim de rodada pode ser cancelada para voltar ao quadro, sem efeito colateral', () => {
  let e = confirmar(comEventoNaRodada2('ev_reuniao'));
  e = proximaRodada(e);
  e = iniciar(e, 'mateada', ['antune']);
  e = iniciar(e, 'pilcha', ['agatha']);
  const antes = JSON.stringify(e);
  const aberta = ok(e, { tipo: 'ENCERRAR_RODADA' });
  assert.equal(aberta.fase, 'decisao');
  const voltou = ok(aberta, { tipo: 'CANCELAR_ENCERRAMENTO' });
  assert.equal(voltou.fase, 'planejamento');
  assert.equal(JSON.stringify(voltou), antes);
  falha(voltou, { tipo: 'CANCELAR_ENCERRAMENTO' }, /Não há encerramento/);
});

test('Reunião sem projeto em andamento: só a despesa', () => {
  let e = confirmar(comEventoNaRodada2('ev_reuniao'));
  e = proximaRodada(e);
  e = encerrar(e);
  assert.equal(e.fase, 'resumo');
});

test('Fornecedor: pagar R$ 50 mantém o projeto; não pagar devolve para A FAZER sem cobrar de novo', () => {
  let base = confirmar(comEventoNaRodada2('ev_fornecedor'));
  base = proximaRodada(base);
  base = iniciar(base, 'cuca', ['jv', 'wesley']); // 🚚 fornecedor, custo 70-20 = 50
  base = iniciar(base, 'pilcha', ['antune']); // sem fornecedor
  const caixa = recursos(base).dinheiro;
  let e = ok(base, { tipo: 'ENCERRAR_RODADA' });
  assert.equal(e.fase, 'decisao');
  const pago = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' });
  assert.equal(recursos(pago).dinheiro, caixa - 50);
  assert.equal(col(pago, 'cuca'), 'revisao');

  const voltou = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'voltar:cuca' });
  assert.equal(recursos(voltou).dinheiro, caixa);
  assert.equal(col(voltou, 'cuca'), 'afazer');
  assert.equal(E.carta(voltou, 'cuca').progresso, 0);
  assert.deepEqual(E.carta(voltou, 'cuca').equipe, []);
  assert.equal(col(voltou, 'pilcha'), 'revisao');
  // Recomeçar não cobra o custo de novo e não consome desconto.
  let r = ok(voltou, { tipo: 'AVANCAR' });
  r = confirmar(r);
  r = ok(r, { tipo: 'INICIAR', cartaId: 'cuca', equipe: ['jv', 'wliam'] });
  assert.equal(recursos(r).dinheiro, caixa);
  // Projeto já pago não pode voltar para o backlog.
  falha(voltou, { tipo: 'DESPLANEJAR', cartaId: 'cuca' });
});

test('Fornecedor: sem caixa, a opção de pagar fica desabilitada; sem projeto com fornecedor, nada acontece', () => {
  let e = confirmar(comEventoNaRodada2('ev_fornecedor'));
  e = proximaRodada(e);
  e = iniciar(e, 'cuca', ['jv', 'wesley']);
  h.forcarCaixa(e, 20);
  const dec = OG.eventos.decisaoFimRodada(e);
  assert.equal(dec.opcoes.find((o) => o.id === 'pagar').habilitado, false);
  // Só uma opção possível -> aplicada automaticamente.
  const fim = encerrar(e);
  assert.equal(col(fim, 'cuca'), 'afazer');

  let semAlvo = confirmar(comEventoNaRodada2('ev_fornecedor'));
  semAlvo = proximaRodada(semAlvo);
  semAlvo = iniciar(semAlvo, 'pilcha', ['antune']);
  assert.equal(OG.eventos.decisaoFimRodada(semAlvo), null);
});

test('Acabou o Chimarrão: só um card entra em EM ANDAMENTO na rodada; revisões liberadas', () => {
  let e = confirmar(comEventoNaRodada2('ev_chimarrao'));
  e = iniciar(e, 'mateada', ['antune']);
  e = proximaRodada(e);
  e = iniciar(e, 'pilcha', ['agatha']);
  e = planejar(e, 'deco_farroupilha');
  falha(e, { tipo: 'INICIAR', cartaId: 'deco_farroupilha', equipe: ['luize'] }, /Chimarrão.*Concurso de Pilcha/);
  e = revisar(e, 'mateada', 'sumindo');
  e = proximaRodada(e);
  e = iniciar(e, 'deco_farroupilha', ['luize']); // rodada seguinte, liberado
});

test('Semana de Provas: só UM card se move (pode avançar duas etapas); revisar conta', () => {
  let e = confirmar(comEventoNaRodada2('ev_provas'));
  e = iniciar(e, 'mateada', ['antune']);
  e = proximaRodada(e);
  e = planejar(e, 'pilcha');
  e = ok(e, { tipo: 'INICIAR', cartaId: 'pilcha', equipe: ['agatha'] }); // mesmo card: ok
  falha(e, { tipo: 'PLANEJAR', cartaId: 'cuca' }, /Semana de Provas.*Concurso de Pilcha/);
  falha(e, { tipo: 'REVISAR', cartaId: 'mateada', revisorId: 'sumindo' }, /Semana de Provas/);
  // Outra linha do tempo: revisar primeiro bloqueia o resto.
  let outra = confirmar(comEventoNaRodada2('ev_provas'));
  outra = iniciar(outra, 'mateada', ['antune']);
  outra = proximaRodada(outra);
  outra = revisar(outra, 'mateada', 'sumindo');
  falha(outra, { tipo: 'PLANEJAR', cartaId: 'pilcha' }, /Semana de Provas/);
});

test('Impressora do T11 Pifou: Divulgação não anda no quadro nem ganha progresso', () => {
  let e = confirmar(comEventoNaRodada2('ev_impressora', 'junina'));
  e = iniciar(e, 'correio', ['patrick']); // divulgação
  e = proximaRodada(e);
  // Correio está em REVISÃO e não pode ser concluído nesta rodada.
  falha(e, { tipo: 'REVISAR', cartaId: 'correio', revisorId: 'sumindo' }, /Impressora/);
  assert.match(OG.kanban.avaliarMovimento(e, 'correio', 'concluido').motivo, /Impressora/);
  // Outros cards seguem normais.
  e = iniciar(e, 'pescaria', ['wliam']);
  e = proximaRodada(e);
  assert.equal(col(e, 'pescaria'), 'revisao');
  e = revisar(e, 'correio', 'sumindo'); // rodada seguinte, liberado
});

test('Impressora: card de Divulgação em andamento fica parado no fim da rodada', () => {
  let e = novo('junina', ['ev_impressora', 'ev_viral', 'ev_viral', 'ev_viral']);
  e = confirmar(e);
  e = planejar(e, 'pescaria');
  falha(e, { tipo: 'PLANEJAR', cartaId: 'correio' }, /Impressora/);
  // Força um card de divulgação em andamento (como se tivesse começado antes)
  let f = novo('junina', ['ev_viral', 'ev_viral', 'ev_viral', 'ev_viral']);
  f = confirmar(f);
  f = iniciar(f, 'correio', ['patrick']);
  f.eventoAtual.id = 'ev_impressora';
  f = encerrar(f);
  assert.equal(col(f, 'correio'), 'andamento');
  assert.ok(f.resumo.linhas.some((l) => /Impressora/.test(l.texto)));
});

test('A Quadra Continua em Reforma: só projetos com quadra param; xadrez e truco seguem', () => {
  let e = confirmar(comEventoNaRodada2('ev_quadra', 'liga'));
  e = iniciar(e, 'futsal', ['deyverson', 'costit']); // quadra
  e = iniciar(e, 'xadrez', ['sumindo']); // mesas, sem quadra
  e = proximaRodada(e);
  falha(e, { tipo: 'REVISAR', cartaId: 'futsal', revisorId: 'antune' }, /quadra/);
  e = revisar(e, 'xadrez', 'antune');
  e = planejar(e, 'truco');
  falha(e, { tipo: 'PLANEJAR', cartaId: 'volei' }, /quadra/);
  e = ok(e, { tipo: 'INICIAR', cartaId: 'truco', equipe: ['luize'] });
});

test('Divulgação Deu Ruim, Divulgação Viral e Professor mexem só no que dizem', () => {
  let e = confirmar(novo('farroupilha', ['ev_post', 'ev_viral', 'ev_professor', 'ev_viral']));
  assert.deepEqual(recursos(e), { dinheiro: 500, prestigio: 15, tradicao: 20 });
  e = proximaRodada(e);
  assert.deepEqual(recursos(e), { dinheiro: 500, prestigio: 25, tradicao: 20 });
  e = proximaRodada(e);
  assert.deepEqual(recursos(e), { dinheiro: 550, prestigio: 30, tradicao: 20 });
});

test('Mutirão: +1 de progresso uma vez; se completar, vai para REVISÃO e libera a vaga', () => {
  let e = confirmar(comEventoNaRodada2('ev_mutirao'));
  e = iniciar(e, 'tche_musica', ['antune', 'giulie']);
  e = proximaRodada(e);
  assert.equal(OG.kanban.mutiraoDisponivel(e), true);
  falha(e, { tipo: 'USAR_MUTIRAO', cartaId: 'pilcha' }, /EM ANDAMENTO/);
  e = ok(e, { tipo: 'USAR_MUTIRAO', cartaId: 'tche_musica' });
  assert.equal(col(e, 'tche_musica'), 'revisao');
  assert.equal(E.statusPessoa(e, 'antune').codigo, 'livre');
  falha(e, { tipo: 'USAR_MUTIRAO', cartaId: 'tche_musica' }, /Não há Mutirão/);
  // Revisão na mesma rodada é permitida (o card já está em REVISÃO).
  e = revisar(e, 'tche_musica', 'sumindo');
  assert.equal(col(e, 'tche_musica'), 'concluido');
});

test('Mutirão não usado expira no fim da rodada', () => {
  let e = confirmar(comEventoNaRodada2('ev_mutirao'));
  e = proximaRodada(e);
  e = encerrar(e);
  assert.ok(e.resumo.linhas.some((l) => /Mutirão/.test(l.texto)));
  e = ok(e, { tipo: 'AVANCAR' });
  e = confirmar(e);
  assert.equal(OG.kanban.mutiraoDisponivel(e), false);
});

test('Impressões de Última Hora: pagar R$ 40 ou recusar e perder 5 Prestígio', () => {
  const e = novo('farroupilha', ['ev_impressoes', 'ev_viral', 'ev_viral', 'ev_viral']);
  const pagou = confirmar(e, 'pagar');
  assert.deepEqual(recursos(pagou), { dinheiro: 460, prestigio: 20, tradicao: 20 });
  const recusou = confirmar(e, 'recusar');
  assert.deepEqual(recursos(recusou), { dinheiro: 500, prestigio: 15, tradicao: 20 });
  falha(e, { tipo: 'CONFIRMAR_EVENTO', escolha: 'outra' }, /Escolha/);
});

test('Aluguel de Equipamento: pagar R$ 60 uma vez ou todos os projetos com equipamento param', () => {
  let e = confirmar(novo('halloween', ['ev_viral', 'ev_equipamento', 'ev_viral', 'ev_viral']));
  e = proximaRodada(e);
  e = iniciar(e, 'casa_terror', ['luize', 'maicon']); // equipamento
  e = iniciar(e, 'cinema_terror', ['antune']); // equipamento
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  const caixa = recursos(e).dinheiro;
  const pago = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' });
  assert.equal(recursos(pago).dinheiro, caixa - 60);
  assert.equal(col(pago, 'cinema_terror'), 'revisao');
  const parou = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'parar' });
  assert.equal(col(parou, 'cinema_terror'), 'andamento');
  assert.equal(E.carta(parou, 'casa_terror').progresso, 0);
});

test('Faltaram Mesas: pagar R$ 50 ou um projeto com mesas perde a rodada', () => {
  let e = confirmar(novo('junina', ['ev_viral', 'ev_mesas', 'ev_viral', 'ev_viral']));
  e = proximaRodada(e);
  e = iniciar(e, 'barraca', ['jv', 'wliam']); // mesas
  e = iniciar(e, 'pescaria', ['wesley']); // mesas
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  const dec = OG.eventos.decisaoFimRodada(e);
  assert.deepEqual(dec.opcoes.map((o) => o.id), ['pagar', 'parar:barraca', 'parar:pescaria']);
  const r = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'parar:barraca' });
  assert.equal(col(r, 'barraca'), 'andamento');
  assert.equal(col(r, 'pescaria'), 'revisao');
});

test('Transporte e Limpeza Extra: despesas registradas no histórico financeiro', () => {
  let e = confirmar(novo('farroupilha', ['ev_transporte', 'ev_limpeza', 'ev_viral', 'ev_viral']));
  e = proximaRodada(e);
  const despesas = e.livro.filter((l) => l.tipo === 'despesa').map((l) => [l.descricao, l.valor]);
  assert.deepEqual(despesas, [['Transporte', -40], ['Limpeza Extra', -30]]);
});

test('Doação e Material ficam guardados até o próximo início, mesmo atravessando rodadas', () => {
  let e = confirmar(novo('farroupilha', ['ev_material', 'ev_viral', 'ev_viral', 'ev_viral']));
  e = proximaRodada(e);
  assert.equal(e.descontosPendentes.length, 1);
  e = iniciar(e, 'pilcha', ['antune']);
  assert.equal(E.carta(e, 'pilcha').custoPago, 60 - 10 - 40);
});

test('evento negativo não trava a partida: sempre dá para encerrar a rodada', () => {
  ['ev_reuniao', 'ev_influenza', 'ev_fornecedor', 'ev_chimarrao', 'ev_provas', 'ev_impressora', 'ev_quadra', 'ev_post',
    'ev_impressoes', 'ev_equipamento', 'ev_mesas', 'ev_transporte', 'ev_limpeza'].forEach((ev) => {
    let e = novo('farroupilha', [ev, ev === 'ev_viral' ? 'ev_post' : 'ev_viral', 'ev_viral', 'ev_viral']);
    h.forcarCaixa(e, 0); // pior caso: sem dinheiro
    const opcoes = OG.eventos.opcoesEvento(e).filter((o) => o.habilitado);
    assert.ok(opcoes.length >= 1, ev + ' sem opção habilitada');
    e = confirmar(e, opcoes[opcoes.length - 1].id);
    e = ok(e, { tipo: 'ENCERRAR_RODADA' });
    assert.ok(['resumo', 'decisao'].includes(e.fase), ev);
  });
});
