/*
 * Gera dist/operacao-gremio-mesquita.html: o jogo inteiro num arquivo só
 * (CSS, scripts, fontes e imagens embutidos). Bom para mandar por e-mail/WhatsApp
 * ou abrir em qualquer computador sem a pasta do projeto.
 *
 *   npm run arquivo-unico
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const DESTINO = path.join(RAIZ, 'dist', 'operacao-gremio-mesquita.html');

function ler(rel) {
  return fs.readFileSync(path.join(RAIZ, rel));
}

function dataUri(rel) {
  const ext = path.extname(rel).toLowerCase();
  const tipo = { '.png': 'image/png', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' }[ext];
  if (!tipo) throw new Error('Tipo não suportado para embutir: ' + rel);
  return 'data:' + tipo + ';base64,' + ler(rel).toString('base64');
}

let html = ler('index.html').toString('utf8');

// CSS: embute o arquivo e as fontes referenciadas por ele.
html = html.replace(/<link rel="stylesheet" href="([^"]+)">/, function (_, href) {
  let css = ler(href).toString('utf8');
  const pastaCss = path.dirname(href);
  css = css.replace(/url\('([^']+)'\)/g, function (m, url) {
    if (url.startsWith('data:')) return m;
    return "url('" + dataUri(path.join(pastaCss, url)) + "')";
  });
  return '<style>\n' + css + '\n</style>';
});

// Scripts: embute na mesma ordem. Fotos dos personagens viram data URI.
html = html.replace(/<script src="([^"]+)"><\/script>/g, function (_, src) {
  let js = ler(src).toString('utf8');
  js = js.replace(/'(assets\/personagens\/[^']+\.png)'/g, function (m, rel) {
    return fs.existsSync(path.join(RAIZ, rel)) ? "'" + dataUri(rel) + "'" : 'null';
  });
  // Evita que "</script>" dentro do código feche a tag antes da hora.
  js = js.replace(/<\/script/gi, '<\\/script');
  return '<script>\n' + js + '\n</script>';
});

fs.mkdirSync(path.dirname(DESTINO), { recursive: true });
fs.writeFileSync(DESTINO, html);
const kb = Math.round(fs.statSync(DESTINO).size / 1024);
console.log('Gerado: ' + path.relative(RAIZ, DESTINO) + ' (' + kb + ' KB)');
