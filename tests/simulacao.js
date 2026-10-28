/*
 * Simulação de balanceamento: joga muitas partidas, em todas as durações, com perfis
 * diferentes de jogador, e mostra o que acontece com pontos, missões, pessoas e caixa.
 *   node tests/simulacao.js          (40 partidas por duração e perfil; 10 nas de 26 rodadas)
 *   node tests/simulacao.js 200      (mais partidas)
 */
'use strict';
const { carregarJogo } = require('./carregar-jogo.js');
const { criarPoliticas, jogarPartida, forcarBaralho } = require('./politicas.js');

const OG = carregarJogo();
const E = OG.estado;
const pol = criarPoliticas(OG);
const N = Number(process.argv[2]) || 40;
const DURACOES = OG.regras.DURACOES.map(function (d) { return d.rodadas; });

function partidas(duracao) {
  return duracao >= 26 ? Math.max(6, Math.round(N / 4)) : N;
}

function config(duracao, s, extra) {
  return Object.assign({ missaoId: OG.dados.missoes[s % OG.dados.missoes.length].id, duracao: duracao, semente: s * 7919 }, extra || {});
}

function percentil(lista, p) {
  const ord = lista.slice().sort(function (a, b) { return a - b; });
  return ord[Math.min(ord.length - 1, Math.floor((p / 100) * ord.length))];
}

function media(lista) {
  return lista.reduce(function (a, b) { return a + b; }, 0) / (lista.length || 1);
}

function rodar(duracao, politica, extra, ajustar) {
  const n = partidas(duracao);
  const st = {
    aprov: [], pontos: [], entregues: [], atrasados: [], vencidos: [], missoes: 0, missoesTot: 0,
    pessoas: [], coord: [], ocupacao: [], menorCaixa: Infinity, caixaFinal: [], parado: [], classes: {},
    composicao: { dinheiro: 0, prestigio: 0, tradicao: 0, projetos: 0 }, foraDaArea: 0, inicios: 0, ms: 0,
    porPessoa: {},
  };
  for (let s = 1; s <= n; s++) {
    const t0 = Date.now();
    const r = jogarPartida(OG, config(duracao, s, extra), politica, { ajustar: ajustar });
    st.ms += Date.now() - t0;
    const e = r.estado;
    const p = OG.pontuacao.calcular(e);
    st.aprov.push(p.aproveitamento);
    st.pontos.push(p.total);
    st.entregues.push(p.entregues);
    st.atrasados.push(p.atrasados);
    st.vencidos.push(e.arquivo.length);
    st.missoes += p.missoesCumpridas;
    st.missoesTot += e.agenda.length;
    st.pessoas.push(r.trabalharam.size);
    st.coord.push(Array.from(r.trabalharam).filter(function (id) { return E.ehCoordenador(id); }).length);
    st.ocupacao.push(r.ocupacao);
    st.menorCaixa = Math.min(st.menorCaixa, r.menorCaixa);
    st.caixaFinal.push(E.recursos(e).dinheiro);
    st.parado.push(OG.pontuacao.resumoFinanceiro(e).investimentoParado);
    st.classes[p.classificacao] = (st.classes[p.classificacao] || 0) + 1;
    p.itens.forEach(function (i) { st.composicao[i.id] += i.pontos; });
    e.cartas.forEach(function (c) {
      if (c.iniciadoNaRodada === null) return;
      st.inicios++;
      if (!E.naArea(c.responsavel, E.projetoDaCarta(c))) st.foraDaArea++;
    });
    Object.keys(r.rodadasTrabalhadas).forEach(function (id) {
      st.porPessoa[id] = (st.porPessoa[id] || 0) + r.rodadasTrabalhadas[id] / duracao;
    });
  }
  st.n = n;
  return st;
}

function col(v, w) { return String(v).padStart(w); }

function imprimirLinha(nome, st) {
  const totalPontos = Object.values(st.composicao).reduce(function (a, b) { return a + b; }, 0) || 1;
  console.log(
    '  ' + nome.padEnd(14) +
    col(media(st.aprov).toFixed(0) + '%', 6) + col(percentil(st.aprov, 10) + '%', 6) + col(percentil(st.aprov, 90) + '%', 6) +
    col(media(st.entregues).toFixed(1), 7) + col(media(st.atrasados).toFixed(1), 6) + col(media(st.vencidos).toFixed(1), 6) +
    col(((100 * st.missoes) / st.missoesTot).toFixed(0) + '%', 6) +
    col(media(st.pessoas).toFixed(1), 6) + col(media(st.coord).toFixed(1), 5) + col((100 * media(st.ocupacao)).toFixed(0) + '%', 6) +
    col(((100 * st.foraDaArea) / (st.inicios || 1)).toFixed(0) + '%', 6) +
    col(st.menorCaixa, 6) + col(media(st.caixaFinal).toFixed(0), 7) + col(media(st.parado).toFixed(0), 6) +
    col(((100 * st.composicao.dinheiro) / totalPontos).toFixed(0) + '%', 6) +
    col((st.ms / st.n).toFixed(0), 6)
  );
}

console.log('Simulação: ' + N + ' partidas por duração e perfil (partidas de 26 rodadas: ' + partidas(26) + ')');
console.log('aprov = aproveitamento (pontos conquistados ÷ meta do planejador sem imprevistos)');
console.log('pes/coo = pessoas/coordenadores que trabalharam pelo menos uma rodada (de 18 — 17 fixos + Patrício, que só vem com evento — e de 5)');
console.log('ocup = ocupação média no fim das rodadas | fora = projetos tocados fora da área do responsável');
console.log('$pts = parte da pontuação que veio do dinheiro | ms = tempo por partida\n');

const perfis = ['planejador', 'semPrioridade', 'coordAoAcaso', 'equipeAoAcaso', 'semPensar', 'gastador', 'economico', 'descuidado', 'parado'];
const cabecalho = '  ' + 'perfil'.padEnd(14) + col('aprov', 6) + col('p10', 6) + col('p90', 6) + col('entreg', 7) + col('atras', 6) +
  col('venc', 6) + col('miss', 6) + col('pes', 6) + col('coo', 5) + col('ocup', 6) + col('fora', 6) + col('minCx', 6) +
  col('cxFim', 7) + col('parad', 6) + col('$pts', 6) + col('ms', 6);

const planejadorPorDuracao = {};
DURACOES.forEach(function (d) {
  const info = OG.regrasUtil.duracao(d);
  console.log('== ' + d + ' rodadas (' + info.nome + ', ' + info.tempo + ', ' + info.missoes + ' ' + (info.missoes > 1 ? 'missões' : 'missão') + ')');
  console.log(cabecalho);
  perfis.forEach(function (nome) {
    const st = rodar(d, pol[nome]);
    if (nome === 'planejador') planejadorPorDuracao[d] = st;
    imprimirLinha(nome, st);
  });
  const metas = [];
  for (let s = 1; s <= partidas(d); s++) metas.push(OG.pontuacao.metaDaPartida(Object.assign({ caixaApertado: false }, config(d, s))).conquistado);
  console.log('  meta (pontos a conquistar): média ' + media(metas).toFixed(0) + ', de ' + Math.min.apply(null, metas) + ' a ' + Math.max.apply(null, metas));
  const cl = planejadorPorDuracao[d].classes;
  console.log('  classificações do planejador: ' + OG.regras.CLASSIFICACOES.map(function (c) {
    return c.nome + ' ' + (((cl[c.nome] || 0) / planejadorPorDuracao[d].n) * 100).toFixed(0) + '%';
  }).join(' | ') + '\n');
});

console.log('Rodadas trabalhadas por pessoa (planejador, % das rodadas):');
DURACOES.forEach(function (d) {
  const st = planejadorPorDuracao[d];
  const partes = E.todasPessoas().map(function (p) {
    return p.nome.split(' ')[0] + ' ' + (((st.porPessoa[p.id] || 0) / st.n) * 100).toFixed(0);
  });
  console.log('  ' + String(d).padStart(2) + ' rodadas: ' + partes.join(' · '));
});

console.log('\nCaixa apertado (R$ ' + OG.regras.CAIXA_APERTADO + '), planejador:');
DURACOES.forEach(function (d) {
  const st = rodar(d, pol.planejador, { caixaApertado: true });
  console.log('  ' + String(d).padStart(2) + ' rodadas: aproveitamento ' + media(st.aprov).toFixed(0) + '% | missões ' +
    ((100 * st.missoes) / st.missoesTot).toFixed(0) + '% | menor caixa ' + st.menorCaixa + ' | entregues ' + media(st.entregues).toFixed(1));
});

// Abrindo com cada missão (partida rápida): nenhuma missão pode ser impossível.
console.log('\nPartida rápida, abrindo com cada missão (planejador com imprevistos):');
OG.dados.missoes.forEach(function (m) {
  let cumpridas = 0;
  const aprov = [];
  for (let s = 1; s <= N; s++) {
    const r = jogarPartida(OG, { missaoId: m.id, duracao: 4, semente: s * 104729 }, pol.planejador);
    const p = OG.pontuacao.calcular(r.estado);
    if (p.missoesCumpridas) cumpridas++;
    aprov.push(p.aproveitamento);
  }
  console.log('  ' + m.nome.padEnd(22) + ' missão cumprida ' + col(((100 * cumpridas) / N).toFixed(0) + '%', 5) +
    ' | aproveitamento médio ' + media(aprov).toFixed(0) + '% (p10 ' + percentil(aprov, 10) + '%)');
});

// Cenários extremos de eventos (planejador).
const negativos = OG.dados.eventos.filter(function (e) { return e.tipo !== 'positivo'; }).map(function (e) { return e.id; });
const positivos = OG.dados.eventos.filter(function (e) { return e.tipo === 'positivo'; }).map(function (e) { return e.id; });
function baralhoDe(lista) {
  return function (estado) { return forcarBaralho(OG, estado, OG.util.embaralhar(estado, lista)); };
}
console.log('\nCenários extremos (planejador): só eventos negativos e despesas / só positivos');
[4, 8].forEach(function (d) {
  ['azarado', 'sortudo'].forEach(function (rotulo, i) {
    const st = rodar(d, pol.planejador, null, baralhoDe(i === 0 ? negativos : positivos));
    console.log('  ' + String(d).padStart(2) + ' rodadas, ' + rotulo.padEnd(8) + ' aproveitamento ' + media(st.aprov).toFixed(0) +
      '% (p10 ' + percentil(st.aprov, 10) + '%) | missões ' + ((100 * st.missoes) / st.missoesTot).toFixed(0) + '% | menor caixa ' + st.menorCaixa);
  });
});

// Impacto de cada evento numa partida rápida: o evento forçado na rodada 2.
console.log('\nImpacto de cada evento na partida rápida (forçado na rodada 2; resto do baralho neutro):');
OG.dados.eventos.forEach(function (ev) {
  const aprov = [];
  let missoes = 0;
  for (let s = 1; s <= N; s++) {
    const r = jogarPartida(OG, config(4, s), pol.planejador, {
      ajustar: function (estado) {
        return forcarBaralho(OG, estado, ['ev_tranquila', ev.id, 'ev_tranquila', 'ev_tranquila']);
      },
    });
    const p = OG.pontuacao.calcular(r.estado);
    aprov.push(p.aproveitamento);
    missoes += p.missoesCumpridas;
  }
  console.log('  ' + ev.nome.padEnd(36) + ' aproveitamento ' + col(media(aprov).toFixed(0) + '%', 5) + ' | missão ' + ((100 * missoes) / N).toFixed(0) + '%');
});
