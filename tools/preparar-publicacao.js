/*
 * Monta a pasta `public/` com o site pronto para publicar (Vercel, Netlify etc.):
 *   index.html, css/, js/ e assets/ — sem testes, ferramentas nem package.json.
 *
 *   npm run build                 -> public/
 *   node tools/preparar-publicacao.js outra-pasta
 *
 * Depois de copiar, confere se todo arquivo citado pelo site existe na pasta gerada
 * (scripts, folha de estilo, fontes do CSS e fotos dos personagens). Se faltar algo,
 * o build falha com a lista do que faltou, em vez de publicar um site quebrado.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..');
const DESTINO = path.resolve(RAIZ, process.argv[2] || 'public');
const ITENS = ['index.html', 'css', 'js', 'assets'];

function copiar(origem, destino) {
  const info = fs.statSync(origem);
  if (info.isDirectory()) {
    fs.mkdirSync(destino, { recursive: true });
    fs.readdirSync(origem).forEach(function (nome) {
      copiar(path.join(origem, nome), path.join(destino, nome));
    });
  } else {
    fs.copyFileSync(origem, destino);
  }
}

function referenciasDoSite(pasta) {
  const refs = [];
  const html = fs.readFileSync(path.join(pasta, 'index.html'), 'utf8');
  for (const m of html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)) {
    if (!/^(data:|https?:|#)/.test(m[1])) refs.push(m[1]);
  }
  const css = fs.readFileSync(path.join(pasta, 'css', 'estilo.css'), 'utf8');
  for (const m of css.matchAll(/url\('([^']+)'\)/g)) {
    if (!/^data:/.test(m[1])) refs.push(path.posix.join('css', m[1]));
  }
  // Fotos dos personagens (ignorando comentários, que trazem exemplos de caminho).
  const personagens = fs.readFileSync(path.join(pasta, 'js', 'dados', 'personagens.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  for (const m of personagens.matchAll(/foto:\s*'([^']+)'/g)) refs.push(m[1]);
  return refs.map(function (r) { return path.posix.normalize(r); });
}

/** Nunca apaga a raiz do projeto (nem pastas acima dela) nem uma pasta que não seja um build anterior. */
function destinoSeguro(destino) {
  if (destino === RAIZ || RAIZ.startsWith(destino + path.sep)) return false;
  if (!fs.existsSync(destino)) return true;
  const conteudo = fs.readdirSync(destino);
  return conteudo.length === 0 || conteudo.indexOf('index.html') !== -1;
}

function preparar() {
  if (!destinoSeguro(DESTINO)) {
    throw new Error('A pasta ' + DESTINO + ' já existe e não parece um build anterior. Escolha outra pasta.');
  }
  fs.rmSync(DESTINO, { recursive: true, force: true });
  fs.mkdirSync(DESTINO, { recursive: true });
  ITENS.forEach(function (item) {
    const origem = path.join(RAIZ, item);
    if (!fs.existsSync(origem)) throw new Error('Arquivo do site não encontrado: ' + item);
    copiar(origem, path.join(DESTINO, item));
  });

  const refs = referenciasDoSite(DESTINO);
  const faltando = refs.filter(function (r) { return !fs.existsSync(path.join(DESTINO, r)); });
  if (faltando.length) {
    throw new Error('O site cita arquivos que não existem:\n  - ' + faltando.join('\n  - '));
  }

  let arquivos = 0;
  let bytes = 0;
  (function contar(p) {
    fs.readdirSync(p, { withFileTypes: true }).forEach(function (d) {
      const c = path.join(p, d.name);
      if (d.isDirectory()) contar(c);
      else { arquivos++; bytes += fs.statSync(c).size; }
    });
  })(DESTINO);
  console.log('Site pronto em ' + path.relative(RAIZ, DESTINO) + '/ (' + arquivos + ' arquivos, ' +
    Math.round(bytes / 1024) + ' KB). ' + refs.length + ' referências conferidas.');
}

try {
  preparar();
} catch (erro) {
  console.error('Falha ao preparar a publicação: ' + erro.message);
  process.exit(1);
}
