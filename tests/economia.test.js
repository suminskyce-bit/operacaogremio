/* Economia: custos, retornos, descontos, despesas e caixa nunca negativo. */
'use strict';
const test = require('node:test');
const h = require('./ajudantes.js');
const { OG, E, assert, novo, ok, falha, confirmar, planejar, iniciar, revisar, encerrar, proximaRodada, recursos, forcarCaixa } = h;

const SEM_EVENTO = ['ev_viral', 'ev_viral', 'ev_viral', 'ev_viral'];

test('custo é debitado UMA vez, ao entrar em EM ANDAMENTO', () => {
  let e = confirmar(novo('farroupilha', SEM_EVENTO));
  e = planejar(e, 'pilcha');
  assert.equal(recursos(e).dinheiro, 500);
  e = ok(e, { tipo: 'INICIAR', cartaId: 'pilcha', equipe: ['wesley'] }); // não especialista
  assert.equal(recursos(e).dinheiro, 440);
  assert.equal(E.carta(e, 'pilcha').custoPago, 60);
  // Atravessar rodadas não cobra de novo.
  e = proximaRodada(e);
  assert.equal(recursos(e).dinheiro, 440);
  assert.equal(e.livro.filter((l) => l.tipo === 'custo').length, 1);
});

test('retorno, prestígio e tradição são creditados UMA vez, na conclusão', () => {
  let e = confirmar(novo('farroupilha', SEM_EVENTO));
  e = iniciar(e, 'pilcha', ['wesley']);
  e = proximaRodada(e);
  const antes = recursos(e);
  e = revisar(e, 'pilcha', 'sumindo');
  const depois = recursos(e);
  assert.equal(depois.dinheiro - antes.dinheiro, 140);
  assert.equal(depois.prestigio - antes.prestigio, 5);
  assert.equal(depois.tradicao - antes.tradicao, 15);
  // Tentar concluir de novo falha (já está em CONCLUÍDO).
  falha(e, { tipo: 'REVISAR', cartaId: 'pilcha', revisorId: 'antune' });
  assert.equal(e.livro.filter((l) => l.tipo === 'retorno').length, 1);
  assert.equal(E.carta(e, 'pilcha').recompensado, true);
});

test('receita não é lucro: o histórico mostra o lucro do projeto', () => {
  let e = confirmar(novo('farroupilha', SEM_EVENTO));
  e = iniciar(e, 'mateada', ['wesley']); // custo 40, sem especialista
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'sumindo');
  const linha = e.historico.find((x) => /CONCLUÍDO/.test(x.texto));
  assert.match(linha.texto, /Retorno R\$ 80,00/);
  assert.match(linha.texto, /lucro do projeto R\$ 40,00/);
  const fin = OG.pontuacao.resumoFinanceiro(e);
  assert.equal(fin.receitaProjetos, 80);
  assert.equal(fin.investido, 40);
  assert.equal(fin.lucroProjetosConcluidos, 40);
});

test('especialista dá R$ 10 de desconto por pessoa; coringa vale para tudo', () => {
  const e = confirmar(novo('farroupilha', SEM_EVENTO));
  const cuca = E.carta(e, 'cuca'); // logística, custo 70
  assert.equal(OG.financas.calcularCusto(e, cuca, ['wesley', 'wliam']).final, 50);
  assert.equal(OG.financas.calcularCusto(e, cuca, ['wesley', 'antune']).final, 60);
  assert.equal(OG.financas.calcularCusto(e, cuca, ['sumindo', 'jv']).final, 50); // Sumindo é coringa
  assert.equal(OG.financas.calcularCusto(e, cuca, ['agatha', 'antune']).final, 70);
  // Dexter: técnico, vale para Estrutura E para projetos com equipamento
  assert.equal(OG.financas.calcularCusto(e, E.carta(e, 'tche_musica'), ['dexter', 'giulie']).final, 80);
});

test('Doação do Sindicato: 50% no próximo projeto, aplicado antes da cobrança e uma única vez', () => {
  let e = confirmar(novo('farroupilha', ['ev_sindicato', 'ev_viral', 'ev_viral', 'ev_viral']));
  assert.equal(e.descontosPendentes.length, 1);
  e = iniciar(e, 'tche_musica', ['wesley', 'maicon']); // 100 -> 50, sem especialista
  assert.equal(recursos(e).dinheiro, 450);
  assert.equal(e.descontosPendentes.length, 0);
  e = iniciar(e, 'mateada', ['patrick']); // não é especialista em Cultura: custo cheio
  assert.equal(recursos(e).dinheiro, 410);
});

test('Material Encontrado: −R$ 40 no próximo projeto, e o custo nunca fica negativo', () => {
  let e = confirmar(novo('farroupilha', ['ev_material', 'ev_viral', 'ev_viral', 'ev_viral']));
  const custo = OG.financas.calcularCusto(e, E.carta(e, 'mateada'), ['antune']); // 40 - 10 - 40
  assert.equal(custo.final, 0);
  e = iniciar(e, 'mateada', ['antune']);
  assert.equal(recursos(e).dinheiro, 500);
  assert.equal(E.carta(e, 'mateada').custoPago, 0);
  assert.equal(e.descontosPendentes.length, 0);
  assert.equal(e.livro.filter((l) => l.tipo === 'custo').length, 0);
});

test('descontos acumulados: 50% primeiro, depois especialistas e o desconto fixo', () => {
  let e = confirmar(novo('farroupilha', ['ev_sindicato', 'ev_material', 'ev_viral', 'ev_viral']));
  e = proximaRodada(e, undefined); // confirma Material na rodada 2 sem iniciar nada na 1
  assert.equal(e.descontosPendentes.length, 2);
  const c = OG.financas.calcularCusto(e, E.carta(e, 'tche_musica'), ['antune', 'giulie']);
  // 100 -> 50 (50%) -> 30 (2 especialistas) -> 0 (−40, piso zero)
  assert.deepEqual(c.itens.map((i) => i.valor), [-50, -10, -10, -40]);
  assert.equal(c.final, 0);
});

test('sem caixa suficiente o projeto não começa, e o motivo é explicado', () => {
  let e = confirmar(novo('farroupilha', SEM_EVENTO));
  forcarCaixa(e, 30);
  e = planejar(e, 'pilcha'); // 60 (50 com especialista)
  falha(e, { tipo: 'INICIAR', cartaId: 'pilcha', equipe: ['antune'] }, /Caixa insuficiente/);
  assert.match(OG.kanban.avaliarMovimento(e, 'pilcha', 'andamento').motivo, /Caixa insuficiente/);
  forcarCaixa(e, 50);
  // Com especialista custa 50: dá. Sem especialista custa 60: não dá.
  falha(e, { tipo: 'INICIAR', cartaId: 'pilcha', equipe: ['wesley'] }, /com essa equipe/);
  e = ok(e, { tipo: 'INICIAR', cartaId: 'pilcha', equipe: ['antune'] });
  assert.equal(recursos(e).dinheiro, 0);
});

test('despesa obrigatória sem caixa: paga o que tem e o resto vira −Prestígio (nunca caixa negativo)', () => {
  let e = novo('farroupilha', ['ev_transporte', 'ev_viral', 'ev_viral', 'ev_viral']);
  forcarCaixa(e, 15);
  const op = OG.eventos.opcoesEvento(e);
  assert.match(op[0].rotulo, /faltam R\$ 25,00/);
  e = confirmar(e);
  assert.equal(recursos(e).dinheiro, 0);
  assert.equal(recursos(e).prestigio, 20 - 3); // 25 faltando -> 3 pontos (arredonda pra cima)
});

test('despesa opcional não pode ser paga sem caixa; a alternativa continua disponível', () => {
  let e = novo('farroupilha', ['ev_impressoes', 'ev_viral', 'ev_viral', 'ev_viral']);
  forcarCaixa(e, 30);
  const op = OG.eventos.opcoesEvento(e);
  assert.equal(op.find((o) => o.id === 'pagar').habilitado, false);
  falha(e, { tipo: 'CONFIRMAR_EVENTO', escolha: 'pagar' }, /insuficiente/i);
  e = confirmar(e, 'recusar');
  assert.equal(recursos(e).prestigio, 15);
  assert.equal(recursos(e).dinheiro, 30);
});

test('prestígio e tradição nunca ficam negativos', () => {
  let e = novo('farroupilha', ['ev_post', 'ev_viral', 'ev_viral', 'ev_viral']);
  e.livro.push({ rodada: 1, recurso: 'prestigio', valor: -18, tipo: 'teste', descricao: 'teste' });
  e = confirmar(e);
  assert.equal(recursos(e).prestigio, 0);
});

test('recompensa da missão: aplicada uma única vez ao atingir o objetivo', () => {
  let e = confirmar(novo('farroupilha', SEM_EVENTO));
  e = iniciar(e, 'mateada', ['antune']);
  e = iniciar(e, 'pilcha', ['agatha']);
  e = proximaRodada(e);
  e = revisar(e, 'mateada', 'sumindo');
  e = revisar(e, 'pilcha', 'luize');
  e = iniciar(e, 'deco_farroupilha', ['maicon']);
  e = iniciar(e, 'camp_concolor', ['deyverson', 'costit']);
  e = proximaRodada(e);
  e = revisar(e, 'deco_farroupilha', 'sumindo');
  assert.equal(e.missaoCumprida, false);
  const antes = recursos(e);
  e = revisar(e, 'camp_concolor', 'luize');
  assert.equal(e.missaoCumprida, true);
  const depois = recursos(e);
  assert.equal(depois.dinheiro - antes.dinheiro, 150 + 100); // retorno + recompensa
  assert.equal(depois.tradicao - antes.tradicao, 0 + 10);
  // Quinto projeto não paga a recompensa de novo.
  e = iniciar(e, 'cuca', ['jv', 'wesley']);
  e = proximaRodada(e);
  e = revisar(e, 'cuca', 'sumindo');
  assert.equal(e.livro.filter((l) => l.tipo === 'recompensa').length, 2); // dinheiro + tradição
});

test('valores exibidos = estado real: recursos são a soma do livro-caixa', () => {
  let e = confirmar(novo('junina', ['ev_patrocinio', 'ev_transporte', 'ev_viral', 'ev_post']));
  e = iniciar(e, 'barraca', ['jv', 'wliam']);
  e = proximaRodada(e);
  e = revisar(e, 'barraca', 'sumindo');
  const soma = { dinheiro: 0, prestigio: 0, tradicao: 0 };
  e.livro.forEach((l) => { soma[l.recurso] += l.valor; });
  assert.deepEqual(recursos(e), soma);
  assert.equal(soma.dinheiro, 500 + 150 - 80 - 40 + 230);
});

test('modo caixa apertado começa com R$ 200', () => {
  const e = OG.motor.criarPartida('farroupilha', 9, { caixaApertado: true });
  assert.equal(recursos(e).dinheiro, 200);
  assert.equal(e.caixaApertado, true);
  assert.ok(OG.pontuacao.metaDaMissao('farroupilha', 200) < OG.pontuacao.metaDaMissao('farroupilha', 500));
});
