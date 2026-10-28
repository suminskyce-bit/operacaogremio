/*
 * Teste de ponta a ponta da interface, no navegador de verdade (Playwright + Chromium).
 * É opcional: precisa do Playwright instalado.
 *
 *   npm install --no-save playwright && npx playwright install chromium
 *   npm run test:e2e                 (inclui uma partida de 26 rodadas: alguns minutos)
 *   E2E_RAPIDO=1 npm run test:e2e    (pula a partida de 26 rodadas)
 *
 * O que ele faz: joga partidas completas clicando como um jogador (as escolhas vêm do
 * planejador do jogo, mas tudo passa pelos botões e janelas da tela), arrasta cards,
 * recarrega a página no meio da rodada, começa partida nova durante um evento, usa só o
 * teclado, confere celular, tablet e várias larguras. Em cada passo compara os números
 * da tela com o estado real do jogo e confere se o estado continua válido.
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');

function carregarPlaywright() {
  const caminhos = [process.env.PLAYWRIGHT_PATH, 'playwright'].filter(Boolean);
  for (const c of caminhos) {
    try { return require(c); } catch (e) { /* tenta o próximo */ }
  }
  console.error('Playwright não encontrado. Instale com: npm install --no-save playwright && npx playwright install chromium');
  process.exit(2);
}

const { chromium } = carregarPlaywright();
const { carregarJogo } = require('../carregar-jogo.js');
const OGN = carregarJogo();

/**
 * Semente em que a 1ª carta é uma boa notícia que não mexe em ninguém (os testes que
 * dependem de quem está livre na rodada 1 não podem cair numa influenza, por exemplo).
 * Procurada no próprio núcleo, para continuar valendo se o baralho mudar.
 */
function sementeTranquila(missaoId, duracao) {
  const boas = ['ev_viral', 'ev_patrocinio', 'ev_professor', 'ev_material', 'ev_sindicato'];
  for (let s = 1; s < 100000; s++) {
    if (boas.indexOf(OGN.motor.criarPartida({ missaoId: missaoId, duracao: duracao, semente: s }).baralho[0]) !== -1) return s;
  }
  throw new Error('nenhuma semente tranquila');
}
const URL_JOGO = process.env.JOGO_URL || 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
const PASTA_PRINTS = path.resolve(__dirname, 'prints');

let falhas = 0;
async function caso(nome, fn) {
  const t0 = Date.now();
  try {
    await fn();
    console.log('ok   ' + nome + ' (' + ((Date.now() - t0) / 1000).toFixed(1) + ' s)');
  } catch (erro) {
    falhas++;
    console.log('FALHOU ' + nome + '\n   ' + (erro && erro.stack ? erro.stack.split('\n').slice(0, 5).join('\n   ') : erro));
  }
}

/** semente (opcional): a próxima partida criada na página usa essa semente (partida reproduzível). */
async function novaPagina(browser, viewport, semente) {
  const contexto = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 } });
  if (semente) {
    await contexto.addInitScript((s) => {
      const original = crypto.getRandomValues.bind(crypto);
      let usada = false;
      crypto.getRandomValues = function (a) {
        if (!usada && a instanceof Uint32Array && a.length === 1) {
          usada = true;
          a[0] = s;
          return a;
        }
        return original(a);
      };
    }, semente);
  }
  const page = await contexto.newPage();
  page.errosConsole = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') page.errosConsole.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.errosConsole.push('pageerror: ' + e.message));
  await page.goto(URL_JOGO);
  return page;
}

/** Lê o estado real do jogo (núcleo) direto da página. */
function estadoReal(page) {
  return page.evaluate(() => {
    const app = window.OG.app.estadoAtual();
    if (!app.estado) return null;
    const r = window.OG.estado.recursos(app.estado);
    return {
      tela: app.tela,
      fase: app.estado.fase,
      rodada: app.estado.rodada,
      duracao: app.estado.config.duracao,
      caixa: window.OG.util.formatarDinheiro(r.dinheiro),
      prestigio: String(r.prestigio),
      tradicao: String(r.tradicao),
      colunas: app.estado.cartas.reduce((a, c) => { a[c.coluna] = (a[c.coluna] || 0) + 1; return a; }, {}),
      valido: window.OG.persistencia.validarEstado(JSON.parse(JSON.stringify(app.estado))).ok,
    };
  });
}

async function conferirHud(page) {
  const real = await estadoReal(page);
  if (!real || real.tela !== 'jogo') return;
  const hud = await page.evaluate(() => ({
    caixa: document.querySelector('.recurso-caixa dd').textContent,
    prestigio: document.querySelector('.recurso-prestigio dd').textContent,
    tradicao: document.querySelector('.recurso-tradicao dd').textContent,
    rodada: document.querySelector('.hud-rodada .numero').textContent,
    contagens: Array.from(document.querySelectorAll('.coluna')).reduce((a, col) => {
      a[col.dataset.coluna] = col.querySelectorAll('.card').length;
      return a;
    }, {}),
    coordenadores: document.querySelectorAll('.coordenacao .coord').length,
  }));
  assert.equal(hud.caixa, real.caixa, 'caixa na tela difere do estado');
  assert.equal(hud.prestigio, real.prestigio, 'prestígio na tela difere do estado');
  assert.equal(hud.tradicao, real.tradicao, 'tradição na tela difere do estado');
  assert.equal(hud.rodada, real.rodada + '/' + real.duracao, 'rodada na tela difere do estado');
  assert.equal(hud.coordenadores, 5, 'a faixa da coordenação mostra os 5 coordenadores');
  ['backlog', 'afazer', 'andamento', 'revisao', 'concluido'].forEach((c) => {
    assert.equal(hud.contagens[c], real.colunas[c] || 0, 'cards na coluna ' + c);
  });
  assert.ok(real.valido, 'estado ficou inválido');
}

async function visivel(page, seletor) {
  const el = await page.$(seletor);
  return !!el && (await el.isVisible());
}

async function clicarVisivel(page, seletor) {
  for (const b of await page.$$(seletor)) {
    if (await b.isVisible()) {
      await b.click();
      return true;
    }
  }
  return false;
}

async function comecar(page, duracao, missao) {
  await page.click('[data-acao="jogar"]');
  await page.waitForSelector('.tela-missoes');
  await page.click('label.opcao-duracao:has(input[value="' + duracao + '"])');
  await page.click('[data-missao="' + missao + '"]');
  await page.waitForSelector('.tela-jogo');
}

async function confirmarEvento(page) {
  await page.waitForSelector('.modal [data-acao="confirmar-evento"]');
  const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
  await botoes[botoes.length - 1].click();
}

async function marcarEquipe(page, equipe) {
  await page.waitForSelector('.modal [data-acao="confirmar-equipe"]');
  for (const id of await page.$$eval('.modal input[data-acao="alternar-pessoa"]:checked', (els) => els.map((e) => e.dataset.pessoa))) {
    await page.click('.modal input[data-pessoa="' + id + '"]', { force: true });
  }
  for (const id of equipe) await page.click('.modal input[data-pessoa="' + id + '"]', { force: true });
}

/**
 * Faz a próxima jogada pela interface. A escolha vem do planejador do jogo (ou da
 * política dada), mas a execução é toda por cliques nos botões e janelas.
 */
async function passo(page, politica) {
  const acao = await page.evaluate((pol) => {
    const app = window.OG.app.estadoAtual();
    if (!app.estado || app.tela === 'fim' || app.estado.fase === 'fim') return null;
    if (pol === 'parado') {
      const f = app.estado.fase;
      if (f === 'planejamento') return { tipo: 'ENCERRAR_RODADA' };
      if (f === 'evento') {
        const op = window.OG.eventos.opcoesEvento(app.estado).filter((o) => o.habilitado);
        return { tipo: 'CONFIRMAR_EVENTO', escolha: (op.find((o) => o.id === 'recusar') || op[0]).id };
      }
    }
    return window.OG.planejador.decidir(app.estado);
  }, politica || 'planejador');
  if (!acao) return false;
  switch (acao.tipo) {
    case 'CONFIRMAR_EVENTO':
      await page.click('.modal [data-acao="confirmar-evento"][data-escolha="' + acao.escolha + '"]');
      break;
    case 'RESOLVER_DECISAO':
      await page.click('.modal [data-acao="resolver-decisao"][data-escolha="' + acao.escolha + '"]');
      break;
    case 'AVANCAR':
      if (!(await clicarVisivel(page, '.modal [data-acao="avancar"]'))) await clicarVisivel(page, '[data-acao="avancar"]');
      break;
    case 'ENCERRAR_RODADA':
      await clicarVisivel(page, '[data-acao="encerrar-rodada"]');
      if (await visivel(page, '.modal [data-acao="confirmar-acao"]')) await page.click('.modal [data-acao="confirmar-acao"]');
      break;
    case 'PLANEJAR':
      await page.click('[data-acao="abrir-planejar"][data-carta="' + acao.cartaId + '"]');
      await page.click('.modal input[data-acao="escolher-responsavel"][data-pessoa="' + acao.responsavel + '"]', { force: true });
      await page.click('.modal [data-acao="confirmar-responsavel"]:not([data-seguir])');
      break;
    case 'INICIAR':
      await page.click('[data-acao="abrir-iniciar"][data-carta="' + acao.cartaId + '"]');
      await marcarEquipe(page, acao.equipe);
      await page.click('.modal [data-acao="confirmar-equipe"]');
      break;
    case 'REVISAR':
      await page.click('[data-acao="abrir-revisar"][data-carta="' + acao.cartaId + '"]');
      await page.click('.modal input[data-acao="escolher-revisor"][data-pessoa="' + acao.revisorId + '"]', { force: true });
      await page.click('.modal [data-acao="confirmar-revisao"]');
      break;
    case 'USAR_MUTIRAO':
      await page.click('[data-acao="mutirao"][data-carta="' + acao.cartaId + '"]');
      break;
    case 'COMPLETAR_EQUIPE':
      await page.click('[data-acao="abrir-completar"][data-carta="' + acao.cartaId + '"]');
      await marcarEquipe(page, [acao.pessoaId]);
      await page.click('.modal [data-acao="confirmar-equipe"]');
      break;
    default:
      throw new Error('Ação inesperada: ' + acao.tipo);
  }
  return true;
}

/** Joga até o fim. Confere o HUD a cada `cadaN` passos. Retorna o número de passos. */
async function jogarAteOFim(page, opcoes) {
  const o = opcoes || {};
  let n = 0;
  while (await passo(page, o.politica)) {
    n++;
    if (n % (o.cadaN || 1) === 0) await conferirHud(page);
    if (n > (o.limite || 600)) throw new Error('A partida não terminou em ' + n + ' passos');
  }
  return n;
}

async function conferirTelaFinal(page) {
  await page.waitForSelector('.tela-fim');
  const dados = await page.evaluate(() => {
    const app = window.OG.app.estadoAtual();
    const p = window.OG.pontuacao.calcular(app.estado);
    const linhas = Array.from(document.querySelectorAll('.tabela-pontos tr')).map((tr) => tr.lastElementChild.textContent.trim());
    return {
      p, linhas,
      carimbo: document.querySelector('.carimbo').textContent.trim(),
      missoes: document.querySelectorAll('.lista-missoes-fim li').length,
      pessoas: document.querySelectorAll('.gente-fim li').length,
    };
  });
  const valores = dados.linhas.slice(0, 4).map(Number);
  const total = Number(dados.linhas[4]);
  assert.equal(valores.reduce((a, b) => a + b, 0), total, 'linhas da pontuação não somam o total');
  assert.equal(total, dados.p.total);
  assert.equal(dados.carimbo, dados.p.classificacao);
  assert.equal(dados.missoes, dados.p.missoes.length);
  assert.equal(dados.pessoas, 18, 'a tela final mostra o trabalho das 18 pessoas');
  return dados.p;
}

async function semRolagemHorizontal(page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert.ok(r.sw <= r.w + 1, 'a página rola na horizontal: ' + r.sw + ' > ' + r.w);
}

(async () => {
  fs.mkdirSync(PASTA_PRINTS, { recursive: true });
  const browser = await chromium.launch();

  await caso('tela inicial abre sem erros e mostra os 5 coordenadores com suas áreas', async () => {
    const page = await novaPagina(browser);
    await page.waitForSelector('.tela-inicio');
    const nomes = await page.$$eval('.inicio-membro .nome', (els) => els.map((e) => e.textContent));
    assert.deepEqual(nomes, ['Sumindo', 'Antune', 'Luize', 'Ryani', 'JV']);
    const areas = await page.$$eval('.inicio-membro .area', (els) => els.map((e) => e.textContent));
    assert.equal(areas.length, 5);
    assert.match(areas[0], /nunca fica fora da área/);
    assert.ok(await visivel(page, '[data-acao="jogar"]'));
    await page.screenshot({ path: path.join(PASTA_PRINTS, '01-inicio.png') });
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('como jogar e configurações abrem e fecham (Esc devolve o foco)', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="como-jogar"]');
    await page.waitForSelector('.modal');
    assert.match(await page.textContent('.modal'), /coordenador responsável|responsável/);
    await page.keyboard.press('Escape');
    assert.equal(await page.$('.modal'), null);
    const foco = await page.evaluate(() => document.activeElement && document.activeElement.dataset.acao);
    assert.equal(foco, 'como-jogar');
    for (let i = 0; i < 5; i++) {
      await page.click('[data-acao="configuracoes"]');
      await page.waitForSelector('.modal');
      await page.click('.modal [data-acao="fechar-modal"]');
    }
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('antes do jogo: 4 opções de duração (4, 8, 10 e 26 rodadas) e a escolha fica salva', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="jogar"]');
    await page.waitForSelector('.tela-missoes');
    const opcoes = await page.$$eval('input[name="duracao"]', (els) => els.map((e) => Number(e.value)));
    assert.deepEqual(opcoes, [4, 8, 10, 26]);
    assert.equal(await page.$eval('input[name="duracao"]:checked', (e) => e.value), '4');
    await page.click('label.opcao-duracao:has(input[value="26"])');
    assert.equal(await page.$eval('input[name="duracao"]:checked', (e) => e.value), '26');
    await page.screenshot({ path: path.join(PASTA_PRINTS, '02-nova-partida.png'), fullPage: true });
    await page.reload();
    await page.click('[data-acao="jogar"]');
    assert.equal(await page.$eval('input[name="duracao"]:checked', (e) => e.value), '26');
    await page.click('[data-missao="cultural"]');
    await page.waitForSelector('.tela-jogo');
    const cfg = await page.evaluate(() => window.OG.app.estadoAtual().estado.config);
    assert.equal(cfg.duracao, 26);
    assert.equal(cfg.missaoId, 'cultural');
    assert.equal(await page.textContent('.hud-rodada .numero'), '1/26');
    // Configuração estragada no navegador é ignorada (volta ao padrão).
    await page.evaluate(() => localStorage.setItem('operacao-gremio-mesquita:config', '{"duracao":999,"caixaApertado":"sim"}'));
    await page.reload();
    await page.click('[data-acao="jogar"]');
    assert.equal(await page.$eval('input[name="duracao"]:checked', (e) => e.value), '4');
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  const partidas = [[4, 'farroupilha'], [4, 'halloween'], [8, 'liga'], [10, 'estudante']];
  if (!process.env.E2E_RAPIDO) partidas.push([26, 'gamer']);
  for (const [duracao, missao] of partidas) {
    await caso('partida completa pela interface: ' + duracao + ' rodadas, abrindo com ' + missao, async () => {
      const page = await novaPagina(browser, null, 1000 + duracao * 7 + missao.length);
      await comecar(page, duracao, missao);
      if (duracao === 4 && missao === 'farroupilha') await page.screenshot({ path: path.join(PASTA_PRINTS, '03-evento.png') });
      const passos = await jogarAteOFim(page, { cadaN: duracao >= 26 ? 5 : 1, limite: 60 * duracao });
      const p = await conferirTelaFinal(page);
      assert.ok(p.entregues >= 2 * duracao, duracao + '/' + missao + ': só ' + p.entregues + ' entregues no prazo');
      assert.ok(p.aproveitamento >= 70, duracao + '/' + missao + ': aproveitamento ' + p.aproveitamento + '%');
      if (duracao === 4 && missao === 'farroupilha') await page.screenshot({ path: path.join(PASTA_PRINTS, '09-fim.png'), fullPage: true });
      if (duracao === 26) await page.screenshot({ path: path.join(PASTA_PRINTS, '11-fim-26.png'), fullPage: true });
      assert.deepEqual(page.errosConsole, []);
      console.log('     ' + passos + ' passos, ' + p.total + ' pontos, ' + p.aproveitamento + '%, ' + p.classificacao + ', missões ' + p.missoesCumpridas + '/' + p.missoes.length);
      await page.context().close();
    });
  }

  await caso('partida sem fazer nada termina como "A DIREÇÃO QUER CONVERSAR"', async () => {
    const page = await novaPagina(browser);
    await comecar(page, 4, 'junina');
    await jogarAteOFim(page, { politica: 'parado' });
    const p = await conferirTelaFinal(page);
    assert.equal(p.classificacao, 'A DIREÇÃO QUER CONVERSAR');
    // Ninguém trabalhou: a tela final avisa.
    assert.match(await page.textContent('.tela-fim'), /sem trabalhar/);
    await page.context().close();
  });

  await caso('arrastar e soltar: inválido explica o motivo; Backlog -> A fazer pede o responsável; A fazer -> Em andamento pede a equipe', async () => {
    const page = await novaPagina(browser, null, sementeTranquila('farroupilha', 4));
    await comecar(page, 4, 'farroupilha');
    await confirmarEvento(page);
    const id = await page.evaluate(() => window.OG.app.estadoAtual().estado.cartas.find((c) => c.projetoId === 'mateada').id);
    const card = '.card[data-carta="' + id + '"]';
    await page.dragAndDrop(card, '#coluna-andamento');
    await page.waitForSelector('.aviso-erro');
    assert.match(await page.textContent('.aviso-erro'), /planeje/i);
    await page.dragAndDrop(card, '#coluna-afazer');
    await page.waitForSelector('.modal [data-acao="escolher-responsavel"]');
    await page.screenshot({ path: path.join(PASTA_PRINTS, '04-quem-vai-tocar.png') });
    await page.click('.modal input[data-pessoa="antune"]', { force: true });
    await page.click('.modal [data-acao="confirmar-responsavel"]:not([data-seguir])');
    await page.waitForSelector('#coluna-afazer ' + card);
    await page.dragAndDrop(card, '#coluna-andamento');
    await page.waitForSelector('.modal [data-acao="confirmar-equipe"]');
    // A equipe começa vazia: sem força, o botão de iniciar explica o que falta.
    assert.equal(await page.getAttribute('.modal [data-acao="confirmar-equipe"]', 'aria-disabled'), 'true');
    assert.match(await page.getAttribute('.modal [data-acao="confirmar-equipe"]', 'data-motivo'), /Força insuficiente/);
    await page.click('.modal [data-acao="sugerir-equipe"]');
    await page.screenshot({ path: path.join(PASTA_PRINTS, '05-equipe.png') });
    await page.click('.modal [data-acao="confirmar-equipe"]');
    await page.waitForSelector('#coluna-andamento ' + card);
    assert.equal(await page.getAttribute(card, 'draggable'), null, 'card em andamento não é arrastável');
    await conferirHud(page);
    await page.screenshot({ path: path.join(PASTA_PRINTS, '06-quadro.png'), fullPage: true });
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('coordenador toca um projeto por vez; a equipe não deixa ninguém sobrar', async () => {
    const page = await novaPagina(browser, null, sementeTranquila('farroupilha', 4));
    await comecar(page, 4, 'farroupilha');
    await confirmarEvento(page);
    const ids = await page.evaluate(() => {
      const e = window.OG.app.estadoAtual().estado;
      return Object.fromEntries(e.cartas.map((c) => [c.projetoId, c.id]));
    });
    // Mateada com Antune, já montando a equipe pelo botão "Planejar e montar equipe".
    await page.click('[data-acao="abrir-planejar"][data-carta="' + ids.mateada + '"]');
    await page.click('.modal input[data-pessoa="antune"]', { force: true });
    await page.click('.modal [data-acao="confirmar-responsavel"][data-seguir="equipe"]');
    await marcarEquipe(page, ['agatha', 'giulie', 'wesley']); // tenta pôr gente sobrando
    // Com a força completa, os outros voluntários ficam desabilitados: o Wesley não entra.
    assert.equal(await page.getAttribute('.modal input[data-pessoa="wesley"]', 'disabled'), '');
    assert.equal(await page.getAttribute('.modal [data-acao="confirmar-equipe"]', 'aria-disabled'), null);
    const marcados = await page.$$eval('.modal input[data-acao="alternar-pessoa"]:checked', (els) => els.map((e) => e.dataset.pessoa));
    assert.deepEqual(marcados.sort(), ['agatha', 'giulie']);
    await page.click('.modal [data-acao="confirmar-equipe"]');
    await page.waitForSelector('#coluna-andamento .card[data-carta="' + ids.mateada + '"]');
    // Pilcha com Antune (ocupado): planejar pode, iniciar fica bloqueado e explica.
    await page.click('[data-acao="abrir-planejar"][data-carta="' + ids.pilcha + '"]');
    await page.click('.modal input[data-pessoa="antune"]', { force: true });
    assert.equal(await page.getAttribute('.modal [data-acao="confirmar-responsavel"][data-seguir="equipe"]', 'aria-disabled'), 'true');
    await page.click('.modal [data-acao="confirmar-responsavel"]:not([data-seguir])');
    await page.waitForSelector('#coluna-afazer .card[data-carta="' + ids.pilcha + '"]');
    assert.equal(await page.getAttribute('[data-acao="abrir-iniciar"][data-carta="' + ids.pilcha + '"]', 'aria-disabled'), 'true');
    await page.click('[data-acao="abrir-iniciar"][data-carta="' + ids.pilcha + '"]', { force: true });
    await page.waitForSelector('.aviso-erro');
    assert.match(await page.textContent('.aviso-erro'), /Antune já está tocando Mateada do Mesquita/);
    // Trocar o responsável resolve.
    await page.click('[data-acao="abrir-trocar"][data-carta="' + ids.pilcha + '"]');
    await page.click('.modal input[data-pessoa="sumindo"]', { force: true });
    await page.click('.modal [data-acao="confirmar-responsavel"]');
    await page.click('[data-acao="abrir-iniciar"][data-carta="' + ids.pilcha + '"]');
    await page.click('.modal [data-acao="sugerir-equipe"]');
    await page.click('.modal [data-acao="confirmar-equipe"]');
    await page.waitForSelector('#coluna-andamento .card[data-carta="' + ids.pilcha + '"]');
    const real = await estadoReal(page);
    assert.equal(real.colunas.andamento, 2);
    await conferirHud(page);
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('recarregar a página no meio da rodada mantém tudo', async () => {
    const page = await novaPagina(browser);
    await comecar(page, 8, 'junina');
    for (let i = 0; i < 12; i++) await passo(page);
    const antes = await page.evaluate(() => JSON.stringify(window.OG.app.estadoAtual().estado));
    await page.reload();
    await page.waitForSelector('[data-acao="continuar"]');
    await page.click('[data-acao="continuar"]');
    await page.waitForSelector('.tela-jogo');
    const depois = await page.evaluate(() => JSON.stringify(window.OG.app.estadoAtual().estado));
    assert.equal(depois, antes);
    await conferirHud(page);
    await page.context().close();
  });

  await caso('nova partida pedida durante um evento substitui a anterior por completo', async () => {
    const page = await novaPagina(browser);
    await comecar(page, 8, 'gamer');
    while ((await estadoReal(page)).rodada < 2) await passo(page);
    await page.waitForSelector('.modal [data-acao="confirmar-evento"]');
    await page.click('.modal [data-acao="menu"]');
    await page.click('.modal [data-acao="nova-partida"]');
    await page.waitForSelector('.tela-missoes');
    await page.click('label.opcao-duracao:has(input[value="10"])');
    await page.click('[data-missao="cultural"]');
    await page.waitForSelector('.modal [data-acao="confirmar-acao"]');
    await page.click('.modal [data-acao="confirmar-acao"]');
    await page.waitForSelector('.tela-jogo');
    const real = await page.evaluate(() => {
      const e = window.OG.app.estadoAtual().estado;
      return { missao: e.config.missaoId, duracao: e.config.duracao, rodada: e.rodada, livro: e.livro.length, todasNoBacklog: e.cartas.every((c) => c.coluna === 'backlog' && c.chegada === 1), fase: e.fase, arquivo: e.arquivo.length };
    });
    assert.deepEqual(real, { missao: 'cultural', duracao: 10, rodada: 1, livro: 3, todasNoBacklog: true, fase: 'evento', arquivo: 0 });
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('teclado: planejar e iniciar só com o teclado; foco acompanha o card; Tab preso na janela', async () => {
    const page = await novaPagina(browser, null, sementeTranquila('farroupilha', 4));
    await comecar(page, 4, 'farroupilha');
    await page.waitForSelector('.modal [data-acao="confirmar-evento"]');
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].focus();
    await page.keyboard.press('Enter');
    const id = await page.evaluate(() => window.OG.app.estadoAtual().estado.cartas.find((c) => c.projetoId === 'pilcha').id);
    await page.focus('[data-acao="abrir-planejar"][data-carta="' + id + '"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.modal [data-acao="escolher-responsavel"]');
    // Ninguém vem marcado: a escolha do responsável é do jogador.
    assert.equal(await page.$('.modal input[data-acao="escolher-responsavel"]:checked'), null);
    await page.focus('.modal input[data-pessoa="antune"]');
    await page.keyboard.press('Space');
    await page.waitForSelector('.modal input[data-pessoa="antune"]:checked');
    await page.focus('.modal [data-acao="confirmar-responsavel"][data-seguir="equipe"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.modal [data-acao="confirmar-equipe"]');
    await page.focus('.modal [data-acao="sugerir-equipe"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.modal input[data-acao="alternar-pessoa"]:checked');
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('.modal')), 'o foco escapou da janela modal');
    await page.focus('.modal [data-acao="confirmar-equipe"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#coluna-andamento .card[data-carta="' + id + '"]');
    assert.equal(await page.$('.modal'), null);
    const foco = await page.evaluate(() => document.activeElement && document.activeElement.dataset.foco);
    assert.equal(foco, 'detalhes:' + id, 'o foco acompanha o card que mudou de coluna');
    await page.context().close();
  });

  await caso('celular (390×844): sem rolagem lateral, abas de coluna, faixa da coordenação e navegação inferior', async () => {
    const page = await novaPagina(browser, { width: 390, height: 844 });
    await semRolagemHorizontal(page);
    await page.screenshot({ path: path.join(PASTA_PRINTS, '07-celular-inicio.png'), fullPage: true });
    await comecar(page, 8, 'farroupilha');
    await semRolagemHorizontal(page);
    await confirmarEvento(page);
    await semRolagemHorizontal(page);
    assert.ok(await visivel(page, '.nav-celular'));
    assert.ok(await visivel(page, '.trocar-coluna'));
    assert.ok(await visivel(page, '.coordenacao'));
    await page.screenshot({ path: path.join(PASTA_PRINTS, '08-celular-quadro.png') });
    await page.click('.nav-celular [data-aba="equipe"]');
    assert.ok(await visivel(page, '.painel-equipe'));
    await page.click('.nav-celular [data-aba="diario"]');
    assert.ok(await visivel(page, '.painel-diario'));
    await page.click('.nav-celular [data-aba="quadro"]');
    await jogarAteOFim(page);
    await conferirTelaFinal(page);
    await semRolagemHorizontal(page);
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('tablet (900×1100): equipe e diário abrem como gaveta e fecham com Esc', async () => {
    const page = await novaPagina(browser, { width: 900, height: 1100 });
    await comecar(page, 10, 'liga');
    await confirmarEvento(page);
    await semRolagemHorizontal(page);
    await page.click('[data-acao="abrir-lateral"]');
    await page.waitForTimeout(250);
    assert.ok(await visivel(page, '.painel-equipe'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => document.querySelector('.tela-jogo').classList.contains('lateral-aberta')), false);
    await page.screenshot({ path: path.join(PASTA_PRINTS, '10-tablet.png') });
    await page.context().close();
  });

  await caso('nenhuma largura de 320 a 1920 px tem rolagem horizontal (início, nova partida e quadro em plena partida, com cards concluídos e em execução)', async () => {
    for (const w of [320, 360, 390, 600, 768, 1024, 1280, 1366, 1440, 1920]) {
      const page = await novaPagina(browser, { width: w, height: 900 });
      await semRolagemHorizontal(page);
      await page.click('[data-acao="jogar"]');
      await semRolagemHorizontal(page);
      await page.click('label.opcao-duracao:has(input[value="26"])');
      await page.click('[data-missao="concolor"]');
      // Joga até haver cards concluídos e em execução (a partir da rodada 3).
      let real = await estadoReal(page);
      while (real.rodada < 3 || !real.colunas.concluido || real.fase !== 'planejamento') {
        await passo(page);
        real = await estadoReal(page);
        assert.ok(real.rodada < 8, 'largura ' + w + ': sem cards concluídos até a rodada 8');
      }
      assert.ok(real.colunas.concluido > 0 && (real.colunas.andamento || 0) + (real.colunas.revisao || 0) > 0, 'largura ' + w + ': ' + JSON.stringify(real.colunas));
      await semRolagemHorizontal(page);
      assert.deepEqual(page.errosConsole, [], 'largura ' + w);
      await page.context().close();
    }
  });

  await caso('configuração "caixa apertado" vale para a próxima partida e fica salva', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="configuracoes"]');
    await page.check('.modal [data-acao="alternar-caixa-apertado"]');
    await page.click('.modal [data-acao="fechar-modal"]');
    await page.reload();
    await comecar(page, 4, 'talentos');
    const inicial = await page.evaluate(() => {
      const e = window.OG.app.estadoAtual().estado;
      return { apertado: e.config.caixaApertado, inicial: e.livro[0].valor };
    });
    assert.deepEqual(inicial, { apertado: true, inicial: 200 });
    assert.match(await page.textContent('.hud-modo'), /caixa apertado/);
    await jogarAteOFim(page);
    await conferirTelaFinal(page);
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('partida salva adulterada é descartada com aviso; partida da versão 1.0 também', async () => {
    const page = await novaPagina(browser);
    await page.evaluate(() => localStorage.setItem('operacao-gremio-mesquita:partida', '{"versao":2,"config":{"missaoId":"x"}}'));
    await page.reload();
    await page.waitForSelector('.aviso-erro');
    assert.match(await page.textContent('.aviso-erro'), /danificada/);
    assert.equal(await page.$('[data-acao="continuar"]'), null);
    await page.evaluate(() => localStorage.setItem('operacao-gremio-mesquita:partida', '{"versao":1,"missaoId":"farroupilha","rodada":2}'));
    await page.reload();
    await page.waitForSelector('.aviso');
    assert.match(await page.textContent('.avisos'), /versão anterior/);
    assert.equal(await page.$('[data-acao="continuar"]'), null);
    await page.context().close();
  });

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' caso(s) falharam.' : '\nTodos os casos de interface passaram.');
  process.exit(falhas ? 1 : 0);
})();
