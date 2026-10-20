/*
 * Publicação (Vercel e afins): o build precisa gerar `public/` com o site completo.
 * Regressão do erro "STATIC_BUILD_NO_OUT_DIR: No Output Directory named public".
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const RAIZ = path.resolve(__dirname, '..');
const SCRIPT = path.join(RAIZ, 'tools', 'preparar-publicacao.js');

function pastaTemporaria(prefixo) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefixo));
}

function copiarRecursivo(origem, destino) {
  if (fs.statSync(origem).isDirectory()) {
    fs.mkdirSync(destino, { recursive: true });
    fs.readdirSync(origem).forEach((n) => copiarRecursivo(path.join(origem, n), path.join(destino, n)));
  } else {
    fs.copyFileSync(origem, destino);
  }
}

test('vercel.json e package.json combinam: build gera "public" e o preset é "Other"', () => {
  const vercel = JSON.parse(fs.readFileSync(path.join(RAIZ, 'vercel.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, 'package.json'), 'utf8'));
  assert.equal(vercel.outputDirectory, 'public');
  assert.equal(vercel.buildCommand, 'npm run build');
  assert.equal(vercel.framework, null);
  assert.match(pkg.scripts.build, /preparar-publicacao\.js/);
  assert.equal(pkg.engines, undefined, 'engines ">=18" gera aviso de atualização automática no Vercel');
  assert.equal(pkg.dependencies, undefined, 'o jogo não tem dependências');
});

test('o build gera um site completo, só com os arquivos do site', () => {
  const destino = pastaTemporaria('og-public-');
  try {
    execFileSync(process.execPath, [SCRIPT, destino], { stdio: 'pipe' });
    assert.deepEqual(fs.readdirSync(destino).sort(), ['assets', 'css', 'index.html', 'js']);
    const html = fs.readFileSync(path.join(destino, 'index.html'), 'utf8');
    const scripts = Array.from(html.matchAll(/<script src="([^"]+)"/g)).map((m) => m[1]);
    assert.ok(scripts.length >= 20, 'scripts no index.html: ' + scripts.length);
    scripts.concat(['css/estilo.css']).forEach((s) => assert.ok(fs.existsSync(path.join(destino, s)), 'faltou ' + s));
    [
      'assets/fontes/archivo-variavel.woff2',
      'assets/fontes/archivo-variavel-italico.woff2',
      'assets/personagens/sumindo.png',
      'assets/personagens/antune.png',
      'assets/personagens/luize.png',
      'assets/personagens/ryani.png',
    ].forEach((a) => assert.ok(fs.statSync(path.join(destino, a)).size > 1000, 'faltou ' + a));
    ['tests', 'tools', 'package.json', 'vercel.json', 'README.md', 'dist'].forEach((x) => {
      assert.ok(!fs.existsSync(path.join(destino, x)), x + ' não deveria ser publicado');
    });
    // Rodar de novo por cima de um build anterior funciona (Vercel e "npm run preview" fazem isso).
    execFileSync(process.execPath, [SCRIPT, destino], { stdio: 'pipe' });
    assert.ok(fs.existsSync(path.join(destino, 'index.html')));
  } finally {
    fs.rmSync(destino, { recursive: true, force: true });
  }
});

test('o build recusa apagar uma pasta que não é um build anterior', () => {
  const pasta = pastaTemporaria('og-alheia-');
  fs.writeFileSync(path.join(pasta, 'importante.txt'), 'não apague');
  try {
    const r = spawnSync(process.execPath, [SCRIPT, pasta], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /não parece um build anterior/);
    assert.ok(fs.existsSync(path.join(pasta, 'importante.txt')));
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test('o build falha (em vez de publicar site quebrado) se faltar um arquivo citado', () => {
  const projeto = pastaTemporaria('og-projeto-');
  try {
    ['index.html', 'css', 'js', 'assets', 'tools'].forEach((i) => copiarRecursivo(path.join(RAIZ, i), path.join(projeto, i)));
    fs.rmSync(path.join(projeto, 'assets', 'personagens', 'ryani.png'));
    const r = spawnSync(process.execPath, [path.join(projeto, 'tools', 'preparar-publicacao.js')], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /ryani\.png/);
  } finally {
    fs.rmSync(projeto, { recursive: true, force: true });
  }
});
