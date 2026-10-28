/* Eventos: baralho para N rodadas, cada carta, efeitos únicos. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, id, carta, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, recursos, col } = h;

function comEventoNaRodada2(ev, missaoId) {
  // Rodada 1 neutra, evento testado na rodada 2.
  return novo({ missaoId: missaoId || 'farroupilha', baralho: ['ev_viral', ev, 'ev_viral', 'ev_viral'] });
}

const tipo = (id) => OG.dados.eventosPorId[id].tipo;

test('baralho: um evento por rodada em todas as durações, com as regras de composição', () => {
  [4, 8, 10, 26].forEach((n) => {
    for (let s = 1; s <= 400; s++) {
      const b = OG.motor.criarPartida({ missaoId: 'farroupilha', duracao: n, semente: s }).baralho;
      assert.equal(b.length, n);
      b.forEach((ev, i) => {
        assert.ok(OG.dados.eventos.some((x) => x.id === ev), 'evento desconhecido');
        if (i > 0) assert.notEqual(ev, b[i - 1], 'repetido em rodadas seguidas (semente ' + s + ')');
      });
      assert.ok(!OG.eventos.SEVEROS.includes(b[0]), 'severo na rodada 1 (semente ' + s + ')');
      for (let ini = 0; ini < n; ini += 4) {
        const bloco = b.slice(ini, ini + 4);
        assert.ok(bloco.some((x) => tipo(x) === 'positivo'), 'bloco sem positivo (n=' + n + ', semente ' + s + ')');
        assert.ok(bloco.filter((x) => OG.eventos.SEVEROS.includes(x)).length <= 1, 'dois severos no bloco (semente ' + s + ')');
      }
      if (n <= 20) assert.ok(new Set(b).size >= n - 1, 'muita repetição em ' + n + ' rodadas (semente ' + s + ')');
      else assert.ok(new Set(b).size >= 18, 'partida longa deveria usar quase o baralho todo (semente ' + s + ')');
    }
  });
});

test('baralho: todos os 20 eventos aparecem nas partidas', () => {
  const vistos = new Set();
  for (let s = 1; s <= 300; s++) OG.motor.criarPartida({ missaoId: 'junina', duracao: 4, semente: s }).baralho.forEach((id) => vistos.add(id));
  assert.equal(vistos.size, 20);
});

test('evento só é aplicado uma vez (confirmar de novo falha)', () => {
  let e = novo({ baralho: ['ev_patrocinio', 'ev_viral'] });
  e = confirmar(e);
  assert.equal(recursos(e).dinheiro, 650);
  falha(e, { tipo: 'CONFIRMAR_EVENTO' }, /Não há evento/);
  assert.equal(e.livro.filter((l) => l.descricao === 'Patrocínio da Concolores').length, 1);
});

test('Reunião com a Diretora: R$ 30 agora e um projeto parado no fim da rodada (o jogador escolhe)', () => {
  let e = confirmar(comEventoNaRodada2('ev_reuniao'));
  e = proximaRodada(e);
  assert.equal(recursos(e).dinheiro, 500 - 30);
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'pilcha', 'sumindo', ['patrick', 'monica', 'wiky']);
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  assert.equal(e.fase, 'decisao');
  const dec = OG.eventos.decisaoFimRodada(e);
  assert.deepEqual(dec.opcoes.map((o) => o.id), ['parar:' + id(e, 'mateada'), 'parar:' + id(e, 'pilcha')]);
  falha(e, { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' }, /Escolha/);
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'cuca'), responsavel: 'jv' }, /decida/);
  e = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'parar:' + id(e, 'pilcha') });
  assert.equal(col(e, 'mateada'), 'revisao');
  assert.equal(col(e, 'pilcha'), 'andamento');
  assert.equal(carta(e, 'pilcha').progresso, 0);
});

test('decisão de fim de rodada pode ser cancelada para voltar ao quadro, sem efeito colateral', () => {
  let e = confirmar(comEventoNaRodada2('ev_reuniao'));
  e = proximaRodada(e);
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'pilcha', 'sumindo', ['patrick', 'monica', 'wiky']);
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

test('Fornecedor: pagar R$ 50 mantém o projeto; não pagar devolve para A FAZER com o mesmo responsável, sem cobrar de novo', () => {
  let base = confirmar(comEventoNaRodada2('ev_fornecedor'));
  base = proximaRodada(base);
  base = iniciar(base, 'cuca', 'jv', ['wesley', 'wliam']); // fornecedor, custo 70 − 20 = 50
  base = iniciar(base, 'pilcha', 'sumindo', ['patrick', 'monica', 'wiky']); // sem fornecedor
  const caixa = recursos(base).dinheiro;
  const e = ok(base, { tipo: 'ENCERRAR_RODADA' });
  assert.equal(e.fase, 'decisao');
  const pago = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' });
  assert.equal(recursos(pago).dinheiro, caixa - 50);
  assert.equal(col(pago, 'cuca'), 'revisao');

  const voltou = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'voltar:' + id(e, 'cuca') });
  const c = carta(voltou, 'cuca');
  assert.equal(recursos(voltou).dinheiro, caixa);
  assert.equal(c.coluna, 'afazer');
  assert.equal(c.responsavel, 'jv');
  assert.equal(c.progresso, 0);
  assert.equal(c.tempoTotal, null);
  assert.deepEqual(c.equipe, []);
  assert.equal(col(voltou, 'pilcha'), 'revisao');
  h.valido(voltou);
  let r = ok(voltou, { tipo: 'AVANCAR' });
  r = confirmar(r);
  // Projeto já pago não pode voltar para o backlog (o dinheiro sumiria da conta).
  falha(r, { tipo: 'DESPLANEJAR', cartaId: id(r, 'cuca') }, /já foi pago/);
  // Recomeçar não cobra o custo de novo.
  r = ok(r, { tipo: 'INICIAR', cartaId: id(r, 'cuca'), equipe: ['wesley', 'wliam'] });
  assert.equal(recursos(r).dinheiro, caixa);
  assert.ok(r.historico.some((x) => /foi retomado com JV/.test(x.texto)));
  assert.equal(r.livro.filter((l) => l.tipo === 'custo' && /Dia da Cuca/.test(l.descricao)).length, 1);
  h.valido(r);
});

test('Fornecedor: sem caixa, a opção de pagar fica desabilitada; sem projeto com fornecedor, nada acontece', () => {
  let e = confirmar(comEventoNaRodada2('ev_fornecedor'));
  e = proximaRodada(e);
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  h.forcarCaixa(e, 20);
  const dec = OG.eventos.decisaoFimRodada(e);
  assert.equal(dec.opcoes.find((o) => o.id === 'pagar').habilitado, false);
  const fim = encerrar(e); // só um caminho possível: aplicado direto
  assert.equal(col(fim, 'cuca'), 'afazer');

  let semAlvo = confirmar(comEventoNaRodada2('ev_fornecedor'));
  semAlvo = proximaRodada(semAlvo);
  semAlvo = iniciar(semAlvo, 'pilcha', 'antune', ['agatha', 'giulie']);
  assert.equal(OG.eventos.decisaoFimRodada(semAlvo), null);
});

test('Acabou o Chimarrão: só 2 projetos começam na rodada; revisões continuam liberadas', () => {
  let e = confirmar(comEventoNaRodada2('ev_chimarrao'));
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  e = iniciar(e, 'pilcha', 'sumindo', ['patrick', 'monica', 'wiky']);
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  e = planejar(e, 'deco_farroupilha', 'luize');
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'deco_farroupilha'), equipe: ['dexter', 'maicon'] },
    /Chimarrão: só 2 projetos podem começar nesta rodada, e já começaram “Concurso de Pilcha” e “Dia da Cuca”/);
  e = revisar(e, 'mateada', 'ryani');
  e = proximaRodada(e);
  iniciar(e, 'deco_farroupilha', 'luize', ['dexter', 'maicon']); // rodada seguinte, liberado
});

test('Semana de Provas: só 2 cards se movem (cada um pode avançar mais de uma etapa); revisar conta', () => {
  let e = confirmar(comEventoNaRodada2('ev_provas'));
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  e = iniciar(e, 'pilcha', 'sumindo', ['patrick', 'monica', 'wiky']); // planejar + iniciar: 1 card
  e = planejar(e, 'cuca', 'jv'); // 2º card
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'deco_farroupilha'), responsavel: 'luize' },
    /Semana de Provas: só 2 cards podem ser movimentados nesta rodada, e já foram “Concurso de Pilcha” e “Dia da Cuca”/);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'mateada'), revisorId: 'ryani' }, /Semana de Provas/);
  e = ok(e, { tipo: 'INICIAR', cartaId: id(e, 'cuca'), equipe: ['wesley', 'wliam'] }); // mesmo card: ok
  // Outra linha do tempo: revisar primeiro também conta.
  let outra = confirmar(comEventoNaRodada2('ev_provas'));
  outra = iniciar(outra, 'mateada', 'antune', ['agatha', 'giulie']);
  outra = proximaRodada(outra);
  outra = revisar(outra, 'mateada', 'ryani');
  outra = planejar(outra, 'pilcha', 'sumindo');
  falha(outra, { tipo: 'PLANEJAR', cartaId: id(outra, 'cuca'), responsavel: 'jv' }, /Semana de Provas/);
});

test('Impressora do T11 Pifou: Divulgação não anda no quadro nem ganha progresso', () => {
  let e = confirmar(comEventoNaRodada2('ev_impressora', 'junina'));
  e = iniciar(e, 'correio', 'ryani', ['patrick', 'monica']); // divulgação
  e = proximaRodada(e);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'correio'), revisorId: 'sumindo' }, /Impressora/);
  assert.match(OG.kanban.avaliarMovimento(e, id(e, 'correio'), 'concluido').motivo, /Impressora/);
  e = iniciar(e, 'pescaria', 'jv', ['wesley', 'wliam']);
  e = proximaRodada(e);
  assert.equal(col(e, 'pescaria'), 'revisao');
  revisar(e, 'correio', 'sumindo'); // rodada seguinte, liberado
});

test('Impressora: card de Divulgação em andamento fica parado no fim da rodada', () => {
  let e = confirmar(novo({ missaoId: 'junina', baralho: ['ev_impressora', 'ev_viral'] }));
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'correio'), responsavel: 'ryani' }, /Impressora/);
  let f = confirmar(novo({ missaoId: 'junina' }));
  f = iniciar(f, 'correio', 'ryani', ['patrick', 'monica']);
  f.eventoAtual.id = 'ev_impressora'; // como se tivesse começado antes do evento
  f = encerrar(f);
  assert.equal(col(f, 'correio'), 'andamento');
  assert.ok(f.resumo.linhas.some((l) => /Impressora/.test(l.texto)));
});

test('A Quadra Continua em Reforma: só projetos com quadra param; xadrez e truco seguem', () => {
  let e = confirmar(comEventoNaRodada2('ev_quadra', 'liga'));
  e = iniciar(e, 'futsal', 'sumindo', ['deyverson', 'costit']); // quadra
  e = iniciar(e, 'xadrez', 'antune', ['wesley', 'patrick', 'maicon']); // mesas, sem quadra (fora da área: 2 rodadas)
  e = proximaRodada(e);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'futsal'), revisorId: 'luize' }, /quadra/);
  falha(e, { tipo: 'PLANEJAR', cartaId: id(e, 'volei'), responsavel: 'sumindo' }, /quadra/);
  e = iniciar(e, 'truco', 'sumindo', ['wiky', 'potter', 'monica']);
  e = encerrar(e);
  assert.equal(col(e, 'futsal'), 'revisao');
  assert.equal(col(e, 'xadrez'), 'revisao');
  assert.equal(col(e, 'truco'), 'revisao');
});

test('Divulgação Deu Ruim, Divulgação Viral e Professor mexem só no que dizem', () => {
  let e = confirmar(novo({ baralho: ['ev_post', 'ev_viral', 'ev_professor', 'ev_viral'] }));
  assert.deepEqual(recursos(e), { dinheiro: 500, prestigio: 15, tradicao: 20 });
  e = proximaRodada(e);
  assert.deepEqual(recursos(e), { dinheiro: 500, prestigio: 25, tradicao: 20 });
  e = proximaRodada(e);
  assert.deepEqual(recursos(e), { dinheiro: 550, prestigio: 30, tradicao: 20 });
});

test('Mutirão: +1 de execução uma vez; se completar, vai para REVISÃO e libera o coordenador', () => {
  let e = confirmar(comEventoNaRodada2('ev_mutirao'));
  e = iniciar(e, 'tche_musica', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  assert.equal(OG.kanban.mutiraoDisponivel(e), true);
  falha(e, { tipo: 'USAR_MUTIRAO', cartaId: id(e, 'pilcha') }, /EM ANDAMENTO/);
  e = ok(e, { tipo: 'USAR_MUTIRAO', cartaId: id(e, 'tche_musica') });
  assert.equal(col(e, 'tche_musica'), 'revisao');
  assert.equal(E.statusPessoa(e, 'antune').codigo, 'livre');
  falha(e, { tipo: 'USAR_MUTIRAO', cartaId: id(e, 'tche_musica') }, /Não há Mutirão/);
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
  const e = novo({ baralho: ['ev_impressoes', 'ev_viral'] });
  const pagou = confirmar(e, 'pagar');
  assert.deepEqual(recursos(pagou), { dinheiro: 460, prestigio: 20, tradicao: 20 });
  const recusou = confirmar(e, 'recusar');
  assert.deepEqual(recursos(recusou), { dinheiro: 500, prestigio: 15, tradicao: 20 });
  falha(e, { tipo: 'CONFIRMAR_EVENTO', escolha: 'outra' }, /Escolha/);
});

test('Aluguel de Equipamento: pagar R$ 60 uma vez ou todos os projetos com equipamento param', () => {
  let e = confirmar(novo({ missaoId: 'halloween', baralho: ['ev_viral', 'ev_equipamento', 'ev_viral', 'ev_viral'] }));
  e = proximaRodada(e);
  e = iniciar(e, 'casa_terror', 'luize', ['dexter', 'maicon']); // equipamento
  e = iniciar(e, 'cinema_terror', 'antune', ['agatha', 'giulie']); // equipamento
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  const caixa = recursos(e).dinheiro;
  const pago = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'pagar' });
  assert.equal(recursos(pago).dinheiro, caixa - 60);
  assert.equal(col(pago, 'cinema_terror'), 'revisao');
  const parou = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'parar' });
  assert.equal(col(parou, 'cinema_terror'), 'andamento');
  assert.equal(carta(parou, 'casa_terror').progresso, 0);
});

test('Faltaram Mesas: pagar R$ 50 ou um projeto com mesas perde a rodada', () => {
  let e = confirmar(novo({ missaoId: 'junina', baralho: ['ev_viral', 'ev_mesas', 'ev_viral', 'ev_viral'] }));
  e = proximaRodada(e);
  e = iniciar(e, 'barraca', 'jv', ['wesley', 'wliam']); // mesas
  e = iniciar(e, 'pescaria', 'sumindo', ['patrick', 'monica', 'maicon']); // mesas
  e = ok(e, { tipo: 'ENCERRAR_RODADA' });
  const dec = OG.eventos.decisaoFimRodada(e);
  assert.deepEqual(dec.opcoes.map((o) => o.id), ['pagar', 'parar:' + id(e, 'barraca'), 'parar:' + id(e, 'pescaria')]);
  const r = ok(e, { tipo: 'RESOLVER_DECISAO', escolha: 'parar:' + id(e, 'barraca') });
  assert.equal(col(r, 'barraca'), 'andamento');
  assert.equal(col(r, 'pescaria'), 'revisao');
});

test('Transporte e Limpeza Extra: despesas registradas no histórico financeiro', () => {
  let e = confirmar(novo({ baralho: ['ev_transporte', 'ev_limpeza', 'ev_viral', 'ev_viral'] }));
  e = proximaRodada(e);
  const despesas = e.livro.filter((l) => l.tipo === 'despesa').map((l) => [l.descricao, l.valor]);
  assert.deepEqual(despesas, [['Transporte', -40], ['Limpeza Extra', -30]]);
});

test('Doação e Material ficam guardados até o próximo início, mesmo atravessando rodadas', () => {
  let e = confirmar(novo({ baralho: ['ev_material', 'ev_viral'] }));
  e = proximaRodada(e);
  assert.equal(e.descontosPendentes.length, 1);
  e = iniciar(e, 'pilcha', 'antune', ['wesley', 'patrick', 'maicon']);
  assert.equal(carta(e, 'pilcha').custoPago, 60 - 40);
});

test('Patrício Ajudou repetido numa partida longa renova a estadia (sem duplicar)', () => {
  let e = confirmar(novo({ duracao: 8, baralho: ['ev_patricio', 'ev_patricio', 'ev_viral'] }));
  assert.deepEqual(e.temporarios, [{ pessoaId: 'patricio', ateRodada: 2 }]);
  e = proximaRodada(e);
  assert.deepEqual(e.temporarios, [{ pessoaId: 'patricio', ateRodada: 3 }]);
  h.valido(e);
});

test('evento negativo não trava a partida: sempre dá para encerrar a rodada', () => {
  ['ev_reuniao', 'ev_influenza', 'ev_fornecedor', 'ev_chimarrao', 'ev_provas', 'ev_impressora', 'ev_quadra', 'ev_post',
    'ev_impressoes', 'ev_equipamento', 'ev_mesas', 'ev_transporte', 'ev_limpeza'].forEach((ev) => {
    let e = novo({ baralho: [ev, 'ev_viral'] });
    h.forcarCaixa(e, 0); // pior caso: sem dinheiro
    const opcoes = OG.eventos.opcoesEvento(e).filter((o) => o.habilitado);
    assert.ok(opcoes.length >= 1, ev + ' sem opção habilitada');
    e = confirmar(e, opcoes[opcoes.length - 1].id);
    e = ok(e, { tipo: 'ENCERRAR_RODADA' });
    assert.ok(['resumo', 'decisao'].includes(e.fase), ev);
  });
});
