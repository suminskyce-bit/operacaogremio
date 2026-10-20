/*
 * Servidor local simples, sem dependências: `npm start` e abra http://localhost:5173
 * (O jogo também abre com duplo clique no index.html ou pelo Live Server do VS Code.)
 *
 * `npm run preview` gera public/ e serve essa pasta, exatamente como o Vercel publica.
 */
'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.resolve(__dirname, '..', process.argv[2] || '.');
const PORTA = Number(process.env.PORT) || 5173;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const servidor = http.createServer(function (req, res) {
  let caminho = decodeURIComponent((req.url || '/').split('?')[0]);
  if (caminho.endsWith('/')) caminho += 'index.html';
  const arquivo = path.normalize(path.join(RAIZ, caminho));
  if (!arquivo.startsWith(RAIZ + path.sep) && arquivo !== RAIZ) {
    res.writeHead(403);
    res.end('Proibido');
    return;
  }
  fs.readFile(arquivo, function (erro, dados) {
    if (erro) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Não encontrado: ' + caminho);
      return;
    }
    res.writeHead(200, {
      'Content-Type': TIPOS[path.extname(arquivo).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    res.end(dados);
  });
});

if (!fs.existsSync(path.join(RAIZ, 'index.html'))) {
  console.error('Não achei index.html em ' + RAIZ + '. Rode "npm run build" antes de servir a pasta public/.');
  process.exit(1);
}

servidor.listen(PORTA, function () {
  console.log('Operação Grêmio — Mesquita rodando em http://localhost:' + PORTA + ' (pasta: ' + RAIZ + ')');
  console.log('Ctrl+C para parar.');
});
