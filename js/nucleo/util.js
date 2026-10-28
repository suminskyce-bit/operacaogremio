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

  /**
   * Sorteio separado, derivado da semente da partida. A agenda e os pedidos usam um
   * sorteio próprio, que não depende das ações do jogador nem dos eventos: assim a
   * mesma semente sempre gera a mesma agenda (e o planejador pode jogar "a mesma partida").
   */
  function criarSorteio(semente, sal) {
    let h = ((Number(semente) >>> 0) ^ Math.imul((sal >>> 0) || 0x9e3779b9, 0x85ebca6b)) >>> 0;
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
    h = (h ^ (h >>> 16)) >>> 0;
    return { rng: h || 1 };
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

  /** Versão curta para os cards: sem centavos quando o valor é inteiro (R$ 40). */
  function formatarDinheiroCurto(valor) {
    if (Math.round(valor) !== valor) return formatarDinheiro(valor);
    const inteiro = Math.abs(valor).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return (valor < 0 ? '−' : '') + 'R$' + NBSP + inteiro;
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

  /** Alternativas em português: ["a","b","c"] -> "a, b ou c" */
  function listaPtOu(itens) {
    if (itens.length <= 1) return itens.join('');
    return itens.slice(0, -1).join(', ') + ' ou ' + itens[itens.length - 1];
  }

  function plural(n, singular, pluralTexto) {
    return n === 1 ? singular : pluralTexto;
  }

  OG.util = {
    aleatorio,
    inteiroAleatorio,
    embaralhar,
    criarSorteio,
    clonar,
    formatarDinheiro,
    formatarDinheiroCurto,
    formatarDinheiroComSinal,
    formatarPontos,
    listaPt,
    listaPtOu,
    plural,
    NBSP,
  };
})(globalThis);
