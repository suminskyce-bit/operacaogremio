/*
 * Operação Grêmio — Mesquita
 * util.js — utilidades sem regra de jogo: sorteio determinístico, clonagem e formatação.
 *
 * Todos os arquivos do jogo seguem o mesmo padrão: um bloco que pendura o próprio
 * módulo em `OG` (objeto global). Assim o jogo abre com duplo clique no index.html
 * (sem servidor) e os testes do Node carregam os mesmos arquivos.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  /**
   * Sorteio determinístico (mulberry32). O estado do sorteio fica salvo dentro do
   * estado da partida (`estado.rng`), então recarregar a página não muda os sorteios.
   */
  function aleatorio(estado) {
    const a = (estado.rng + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    estado.rng = a;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function inteiroAleatorio(estado, n) {
    return Math.floor(aleatorio(estado) * n);
  }

  function embaralhar(estado, lista) {
    const copia = lista.slice();
    for (let i = copia.length - 1; i > 0; i--) {
      const j = inteiroAleatorio(estado, i + 1);
      const tmp = copia[i];
      copia[i] = copia[j];
      copia[j] = tmp;
    }
    return copia;
  }

  /** O estado é 100% JSON, então a clonagem por JSON é suficiente e segura. */
  function clonar(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  const NBSP = ' ';

  /** 1234 -> "R$ 1.234,00" (com espaço que não quebra linha). */
  function formatarDinheiro(valor) {
    const negativo = valor < 0;
    const centavosTotais = Math.round(Math.abs(valor) * 100);
    const inteiro = Math.floor(centavosTotais / 100)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    const centavos = (centavosTotais % 100).toString().padStart(2, '0');
    return (negativo ? '−' : '') + 'R$' + NBSP + inteiro + ',' + centavos;
  }

  /** Valor com sinal, para históricos: +R$ 80,00 / −R$ 40,00 */
  function formatarDinheiroComSinal(valor) {
    if (valor > 0) return '+' + formatarDinheiro(valor);
    return formatarDinheiro(valor);
  }

  function formatarPontos(valor) {
    return (valor > 0 ? '+' : valor < 0 ? '−' : '') + Math.abs(valor);
  }

  /** Lista em português: ["a","b","c"] -> "a, b e c" */
  function listaPt(itens) {
    if (itens.length <= 1) return itens.join('');
    return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
  }

  function plural(n, singular, pluralTexto) {
    return n === 1 ? singular : pluralTexto;
  }

  OG.util = {
    aleatorio,
    inteiroAleatorio,
    embaralhar,
    clonar,
    formatarDinheiro,
    formatarDinheiroComSinal,
    formatarPontos,
    listaPt,
    plural,
    NBSP,
  };
})(globalThis);
