/*
 * Simulação de balanceamento: joga muitas partidas com perfis diferentes de jogador.
 *   node tests/simulacao.js            (300 partidas por missão e perfil)
 *   node tests/simulacao.js 1000       (mais partidas)
 */
'use strict';
const { carregarJogo } = require('./carregar-jogo.js');
const { criarPoliticas, jogarPartida, forcarBaralho } = require('./politicas.js');

const OG = carregarJogo();
const politicas = criarPoliticas(OG);
const N = Number(process.argv[2]) || 300;

function percentil(lista, p) {
  const ord = lista.slice().sort(function (a, b) { return a - b; });
  return ord[Math.min(ord.length - 1, Math.floor((p / 100) * ord.length))];
}

function estatisticas(missaoId, politica, ajustar) {
  const pontos = [];
  const aproveit = [];
  const classes = {};
  let missoes = 0;
  let concluidos = 0;
  let menorCaixa = Infinity;
  let parado = 0;
  for (let s = 1; s <= N; s++) {
    const r = jogarPartida(OG, missaoId, s * 7919, politica, ajustar);
    const p = OG.pontuacao.calcular(r.estado);
    pontos.push(p.total);
    aproveit.push(p.aproveitamento);
    classes[p.classificacao] = (classes[p.classificacao] || 0) + 1;
    if (p.missaoCumprida) missoes++;
    concluidos += p.concluidos;
    menorCaixa = Math.min(menorCaixa, r.menorCaixa);
    parado += OG.pontuacao.resumoFinanceiro(r.estado).investimentoParado;
  }
  return {
    media: pontos.reduce(function (a, b) { return a + b; }, 0) / N,
    p10: percentil(pontos, 10),
    p50: percentil(pontos, 50),
    p90: percentil(pontos, 90),
    min: Math.min.apply(null, pontos),
    max: Math.max.apply(null, pontos),
    missao: missoes / N,
    concluidos: concluidos / N,
    menorCaixa: menorCaixa,
    parado: parado / N,
    classes: classes,
    aprov50: percentil(aproveit, 50),
    aprov90: percentil(aproveit, 90),
  };
}

function linha(cols, larguras) {
  return cols.map(function (c, i) { return String(c).padEnd(larguras[i]); }).join(' ');
}

const L = [13, 11, 7, 6, 6, 6, 6, 6, 9, 9, 10, 10, 8, 8];
console.log('Simulação: ' + N + ' partidas por missão e perfil\n');
console.log(linha(['missão', 'perfil', 'média', 'p10', 'p50', 'p90', 'min', 'max', 'missão%', 'concl.', 'menorCx', 'invParado', 'apr50%', 'apr90%'], L));

const perfis = ['bom', 'prestigio', 'gastador', 'economico', 'descuidado', 'parado'];
const geral = {};
OG.dados.missoes.forEach(function (m) {
  console.log('-- ' + m.nome + ' (meta ' + OG.pontuacao.metaDaMissao(m.id) + ' pontos, objetivo ' + m.objetivo + ')');
  perfis.forEach(function (nome) {
    const st = estatisticas(m.id, politicas[nome]);
    geral[nome] = geral[nome] || [];
    geral[nome].push(st);
    console.log(linha([
      m.id, nome, st.media.toFixed(1), st.p10, st.p50, st.p90, st.min, st.max,
      (st.missao * 100).toFixed(0) + '%', st.concluidos.toFixed(2), st.menorCaixa, st.parado.toFixed(0), st.aprov50, st.aprov90,
    ], L));
  });
  console.log('');
});

console.log('\nClassificações por perfil (todas as missões):');
perfis.forEach(function (nome) {
  const soma = {};
  geral[nome].forEach(function (st) {
    Object.keys(st.classes).forEach(function (k) { soma[k] = (soma[k] || 0) + st.classes[k]; });
  });
  const total = N * OG.dados.missoes.length;
  const partes = OG.regras.CLASSIFICACOES.map(function (c) {
    return c.nome + ' ' + (((soma[c.nome] || 0) / total) * 100).toFixed(0) + '%';
  });
  console.log('  ' + nome.padEnd(11) + partes.join(' | '));
});

// Cenários extremos de eventos
const negativos = OG.dados.eventos.filter(function (e) { return e.tipo !== 'positivo'; }).map(function (e) { return e.id; });
const positivos = OG.dados.eventos.filter(function (e) { return e.tipo === 'positivo'; }).map(function (e) { return e.id; });
function baralhoDe(lista) {
  return function (estado) {
    const ids = OG.util.embaralhar(estado, lista).slice(0, 4);
    return forcarBaralho(OG, estado, ids);
  };
}
console.log('\nCenários extremos (perfil "bom"):');
['azarado: só eventos negativos/despesas', 'sortudo: só eventos positivos'].forEach(function (rotulo, i) {
  const ajuste = baralhoDe(i === 0 ? negativos : positivos);
  const missoes = OG.dados.missoes.map(function (m) { return estatisticas(m.id, politicas.bom, ajuste); });
  const media = missoes.reduce(function (s, st) { return s + st.media; }, 0) / missoes.length;
  const taxa = missoes.reduce(function (s, st) { return s + st.missao; }, 0) / missoes.length;
  const pior = missoes.reduce(function (a, st, j) { return st.missao < a.v ? { v: st.missao, id: OG.dados.missoes[j].id } : a; }, { v: 2 });
  const menorCaixa = Math.min.apply(null, missoes.map(function (st) { return st.menorCaixa; }));
  console.log('  ' + rotulo.padEnd(40) + ' média ' + media.toFixed(1) + ' | missão cumprida ' + (taxa * 100).toFixed(0) +
    '% | pior missão ' + pior.id + ' ' + (pior.v * 100).toFixed(0) + '% | menor caixa ' + menorCaixa);
});

// Eventos individuais: impacto médio na pontuação do perfil "bom"
console.log('\nImpacto de cada evento (perfil "bom", evento forçado em cada rodada permitida):');
function baralhoComEvento(ev, rodada) {
  return function (estado) {
    const base = OG.util.embaralhar(estado, OG.dados.eventos.map(function (e) { return e.id; })
      .filter(function (id) { return id !== ev; })).slice(0, 4);
    base[rodada] = ev;
    return forcarBaralho(OG, estado, base);
  };
}
OG.dados.eventos.forEach(function (ev) {
  let soma = 0;
  let missoes = 0;
  let n = 0;
  for (let rodada = 0; rodada < 4; rodada++) {
    if (rodada === 0 && OG.eventos.SEVEROS.indexOf(ev.id) !== -1) continue; // regra do baralho
    OG.dados.missoes.forEach(function (m) {
      for (let s = 1; s <= Math.max(10, Math.floor(N / 30)); s++) {
        const r = jogarPartida(OG, m.id, s * 104729 + rodada, politicas.bom, baralhoComEvento(ev.id, rodada));
        const p = OG.pontuacao.calcular(r.estado);
        soma += p.total;
        if (p.missaoCumprida) missoes++;
        n++;
      }
    });
  }
  console.log('  ' + ev.nome.padEnd(36) + ' média ' + (soma / n).toFixed(1) + ' | missão ' + ((missoes / n) * 100).toFixed(0) + '%');
});
