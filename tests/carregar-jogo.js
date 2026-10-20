/*
 * Carrega os arquivos do núcleo e dos dados no Node, na mesma ordem do index.html.
 * (Os arquivos da interface ficam de fora: eles precisam do navegador.)
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RAIZ = path.resolve(__dirname, '..');

function scriptsDoIndex() {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  return Array.from(html.matchAll(/<script\s+src="([^"]+)"/g)).map(function (m) { return m[1]; });
}

function arquivosDoNucleo() {
  return scriptsDoIndex().filter(function (src) {
    return src.indexOf('js/nucleo/') === 0 || src.indexOf('js/dados/') === 0;
  });
}

function carregarJogo() {
  if (globalThis.OG && globalThis.OG.motor) return globalThis.OG;
  arquivosDoNucleo().forEach(function (arquivo) {
    const codigo = fs.readFileSync(path.join(RAIZ, arquivo), 'utf8');
    vm.runInThisContext(codigo, { filename: arquivo });
  });
  return globalThis.OG;
}

module.exports = { carregarJogo, scriptsDoIndex, arquivosDoNucleo, RAIZ };
