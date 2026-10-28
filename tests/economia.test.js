/* Economia: custos, retornos, descontos, despesas, atraso e caixa nunca negativo. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, id, carta, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, recursos, forcarCaixa } = h;

test('custo é debitado UMA vez, ao entrar em EM ANDAMENTO', () => {
  let e = confirmar(novo());
  e = planejar(e, 'pilcha', 'antune');
  assert.equal(recursos(e).dinheiro, 500);
  e = ok(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['wesley', 'patrick', 'maicon'] }); // nenhum especialista
  assert.equal(recursos(e).dinheiro, 440);
  assert.equal(carta(e, 'pilcha').custoPago, 60);
  e = proximaRodada(e);
  assert.equal(recursos(e).dinheiro, 440);
  assert.equal(e.livro.filter((l) => l.tipo === 'custo').length, 1);
});

test('retorno, prestígio e tradição são creditados UMA vez, na conclusão', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'pilcha', 'antune', ['wesley', 'patrick', 'maicon']);
  e = proximaRodada(e);
  const antes = recursos(e);
  e = revisar(e, 'pilcha', 'sumindo');
  const depois = recursos(e);
  assert.equal(depois.dinheiro - antes.dinheiro, 140);
  assert.equal(depois.prestigio - antes.prestigio, 5);
  assert.equal(depois.tradicao - antes.tradicao, 15);
  falha(e, { tipo: 'REVISAR', cartaId: id(e, 'pilcha'), revisorId: 'luize' });
  assert.equal(e.livro.filter((l) => l.tipo === 'retorno').length, 1);
  assert.equal(carta(e, 'pilcha').recompensado, true);
  assert.equal(carta(e, 'pilcha').retornoRecebido, 140);
});

test('receita não é lucro: o histórico e o resumo mostram o lucro do projeto', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['wesley', 'patrick', 'maicon']); // custo 40, sem especialista
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'sumindo');
  const linha = e.historico.find((x) => /CONCLUÍDO/.test(x.texto));
  assert.match(linha.texto, /Retorno R\$\s80,00/);
  assert.match(linha.texto, /lucro do projeto R\$\s40,00/);
  const fin = OG.pontuacao.resumoFinanceiro(e);
  assert.equal(fin.receitaProjetos, 80);
  assert.equal(fin.investido, 40);
  assert.equal(fin.lucroProjetosConcluidos, 40);
});

test('voluntário especialista dá R$ 10 de desconto (Dexter também com equipamento); coordenador não', () => {
  const e = confirmar(novo());
  const custo = (proj, coord, equipe) => {
    const c = Object.assign({}, carta(e, proj), { responsavel: coord });
    return OG.financas.calcularCusto(e, c, equipe).final;
  };
  assert.equal(custo('cuca', 'jv', ['wesley', 'wliam']), 50);
  assert.equal(custo('cuca', 'jv', ['wesley', 'patrick', 'maicon']), 60);
  assert.equal(custo('cuca', 'jv', ['agatha', 'patrick', 'maicon', 'monica']), 70);
  assert.equal(custo('tche_musica', 'antune', ['dexter', 'giulie']), 80);
  assert.equal(custo('mateada', 'antune', ['agatha', 'giulie']), 20);
});

test('Doação do Sindicato: 50% no próximo projeto, aplicado antes da cobrança e uma única vez', () => {
  let e = confirmar(novo({ baralho: ['ev_sindicato', 'ev_viral'] }));
  assert.equal(e.descontosPendentes.length, 1);
  e = iniciar(e, 'tche_musica', 'antune', ['wesley', 'maicon', 'patrick', 'monica']); // 100 -> 50, sem especialista
  assert.equal(recursos(e).dinheiro, 450);
  assert.equal(e.descontosPendentes.length, 0);
  e = iniciar(e, 'mateada', 'sumindo', ['wiky', 'potter', 'costit']); // custo cheio
  assert.equal(recursos(e).dinheiro, 410);
});

test('Material Encontrado: −R$ 40 no próximo projeto, e o custo nunca fica negativo', () => {
  let e = confirmar(novo({ baralho: ['ev_material', 'ev_viral'] }));
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']); // 40 − 20 − 40 → 0
  assert.equal(recursos(e).dinheiro, 500);
  assert.equal(carta(e, 'mateada').custoPago, 0);
  assert.equal(e.descontosPendentes.length, 0);
  assert.equal(e.livro.filter((l) => l.tipo === 'custo').length, 0);
});

test('descontos acumulados: 50% primeiro, depois especialistas e o desconto fixo', () => {
  let e = confirmar(novo({ baralho: ['ev_sindicato', 'ev_material', 'ev_viral', 'ev_viral'] }));
  e = proximaRodada(e);
  assert.equal(e.descontosPendentes.length, 2);
  const c = Object.assign({}, carta(e, 'tche_musica'), { responsavel: 'antune' });
  const custo = OG.financas.calcularCusto(e, c, ['agatha', 'giulie']);
  assert.deepEqual(custo.itens.map((i) => i.valor), [-50, -10, -10, -40]);
  assert.equal(custo.final, 0);
});

test('sem caixa suficiente o projeto não começa, e o motivo é explicado', () => {
  let e = confirmar(novo());
  forcarCaixa(e, 30);
  e = planejar(e, 'pilcha', 'antune'); // 60; com 2 especialistas, 40
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['agatha', 'giulie'] }, /custa pelo menos R\$\s40,00 e o caixa tem R\$\s30,00/);
  assert.match(OG.kanban.avaliarMovimento(e, id(e, 'pilcha'), 'andamento').motivo, /Caixa insuficiente/);
  forcarCaixa(e, 50);
  falha(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['wesley', 'patrick', 'maicon'] }, /com essa equipe o projeto custa R\$\s60,00/);
  e = ok(e, { tipo: 'INICIAR', cartaId: id(e, 'pilcha'), equipe: ['agatha', 'giulie'] });
  assert.equal(recursos(e).dinheiro, 10);
});

test('despesa obrigatória sem caixa: paga o que tem e o resto vira −Prestígio (nunca caixa negativo)', () => {
  let e = novo({ baralho: ['ev_transporte', 'ev_viral'] });
  forcarCaixa(e, 15);
  const op = OG.eventos.opcoesEvento(e);
  assert.match(op[0].rotulo, /faltam R\$\s25,00/);
  e = confirmar(e);
  assert.equal(recursos(e).dinheiro, 0);
  assert.equal(recursos(e).prestigio, 20 - 3); // 25 faltando -> 3 pontos (arredonda para cima)
});

test('despesa opcional não pode ser paga sem caixa; a alternativa continua disponível', () => {
  let e = novo({ baralho: ['ev_impressoes', 'ev_viral'] });
  forcarCaixa(e, 30);
  const op = OG.eventos.opcoesEvento(e);
  assert.equal(op.find((o) => o.id === 'pagar').habilitado, false);
  falha(e, { tipo: 'CONFIRMAR_EVENTO', escolha: 'pagar' }, /insuficiente/i);
  e = confirmar(e, 'recusar');
  assert.equal(recursos(e).prestigio, 15);
  assert.equal(recursos(e).dinheiro, 30);
});

test('prestígio e tradição nunca ficam negativos', () => {
  let e = novo({ baralho: ['ev_post', 'ev_viral'] });
  e.livro.push({ rodada: 1, recurso: 'prestigio', valor: -18, tipo: 'teste', descricao: 'teste' });
  e = confirmar(e);
  assert.equal(recursos(e).prestigio, 0);
});

test('recompensa da missão: aplicada uma única vez, quando o 4º projeto é concluído no prazo', () => {
  let e = confirmar(novo());
  e = iniciar(e, 'mateada', 'antune', ['agatha', 'giulie']);
  e = iniciar(e, 'deco_farroupilha', 'luize', ['dexter', 'maicon']);
  e = iniciar(e, 'cuca', 'jv', ['wesley', 'wliam']);
  e = iniciar(e, 'camp_concolor', 'sumindo', ['deyverson', 'costit']);
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'sumindo');
  e = revisar(e, 'deco_farroupilha', 'antune');
  e = revisar(e, 'cuca', 'luize');
  assert.equal(e.agenda[0].cumprida, false);
  const antes = recursos(e);
  e = revisar(e, 'camp_concolor', 'jv');
  assert.equal(e.agenda[0].cumprida, true);
  assert.equal(e.agenda[0].cumpridaNaRodada, 2);
  const depois = recursos(e);
  assert.equal(depois.dinheiro - antes.dinheiro, 150 + 100); // retorno + recompensa
  assert.equal(depois.tradicao - antes.tradicao, 0 + 10);
  // Quinto projeto não paga a recompensa de novo.
  e = iniciar(e, 'pilcha', 'antune', ['agatha', 'giulie']);
  e = proximaRodada(e);
  e = revisar(e, 'pilcha', 'sumindo');
  assert.equal(e.livro.filter((l) => l.tipo === 'recompensa').length, 2); // dinheiro + tradição
  h.valido(e);
});

test('entrega depois do prazo: metade do retorno, sem prestígio nem tradição, e não conta para a missão', () => {
  // 8 rodadas: a Farroupilha vence na rodada 4.
  let e = confirmar(novo({ duracao: 8 }));
  e = proximaRodada(e); // rodada 2
  e = iniciar(e, 'tche_musica', 'luize', ['agatha', 'giulie']); // fora da área: 3 rodadas (2, 3 e 4)
  assert.equal(carta(e, 'tche_musica').tempoTotal, 3);
  assert.equal(E.farolDoPrazo(e, carta(e, 'tche_musica')), 'atrasado', 'já começa sem dar tempo');
  e = proximaRodada(e);
  e = proximaRodada(e);
  e = encerrar(e); // fim da rodada 4: termina a execução, e o prazo acaba
  assert.equal(carta(e, 'tche_musica').coluna, 'revisao');
  assert.ok(e.resumo.linhas.some((l) => /Tchê Música passou do prazo/.test(l.texto)));
  assert.ok(e.agenda[0].perdida);
  e = ok(e, { tipo: 'AVANCAR' });
  e = confirmar(e); // rodada 5
  const antes = recursos(e);
  e = revisar(e, 'tche_musica', 'sumindo');
  const depois = recursos(e);
  assert.equal(depois.dinheiro - antes.dinheiro, 125);
  assert.equal(depois.prestigio, antes.prestigio);
  assert.equal(depois.tradicao, antes.tradicao);
  assert.equal(carta(e, 'tche_musica').noPrazo, false);
  assert.equal(E.progressoMissao(e, 'farroupilha'), 0);
  assert.ok(e.historico.some((x) => x.tipo === 'atraso' && /metade do retorno/.test(x.texto)));
  assert.equal(OG.pontuacao.resumoFinanceiro(e).perdaPorAtraso, 125);
  h.valido(e);
});

test('valores exibidos = estado real: recursos são a soma do livro-caixa', () => {
  let e = confirmar(novo({ missaoId: 'junina', baralho: ['ev_patrocinio', 'ev_transporte', 'ev_viral', 'ev_post'] }));
  e = iniciar(e, 'barraca', 'jv', ['wesley', 'wliam']);
  e = proximaRodada(e);
  e = revisar(e, 'barraca', 'sumindo');
  const soma = { dinheiro: 0, prestigio: 0, tradicao: 0 };
  e.livro.forEach((l) => { soma[l.recurso] += l.valor; });
  assert.deepEqual(recursos(e), soma);
  assert.equal(soma.dinheiro, 500 + 150 - 80 - 40 + 230);
});

test('modo caixa apertado começa com R$ 200', () => {
  const e = OG.motor.criarPartida({ missaoId: 'farroupilha', duracao: 4, semente: 9, caixaApertado: true });
  assert.equal(recursos(e).dinheiro, 200);
  assert.equal(e.config.caixaApertado, true);
  h.valido(e);
});
