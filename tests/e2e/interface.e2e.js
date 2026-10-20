/*
 * Teste de ponta a ponta da interface, no navegador de verdade (Playwright + Chromium).
 * É opcional: precisa do Playwright instalado.
 *
 *   npm install --no-save playwright && npx playwright install chromium
 *   npm run test:e2e
 *
 * O que ele faz: joga partidas completas clicando como um jogador, arrasta cards,
 * recarrega a página no meio da rodada, começa partida nova durante um evento,
 * usa só o teclado, e confere a tela de celular. Em cada passo compara os números
 * mostrados na tela com o estado real do jogo.
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
const URL_JOGO = process.env.JOGO_URL || 'file://' + path.resolve(__dirname, '..', '..', 'index.html');
const PASTA_PRINTS = path.resolve(__dirname, 'prints');

let falhas = 0;
async function caso(nome, fn) {
  try {
    await fn();
    console.log('ok   ' + nome);
  } catch (erro) {
    falhas++;
    console.log('FALHOU ' + nome + '\n   ' + (erro && erro.stack ? erro.stack.split('\n').slice(0, 4).join('\n   ') : erro));
  }
}

async function novaPagina(browser, viewport) {
  const contexto = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 } });
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
      caixa: window.OG.util.formatarDinheiro(r.dinheiro),
      prestigio: String(r.prestigio),
      tradicao: String(r.tradicao),
      colunas: app.estado.cartas.reduce((a, c) => { a[c.coluna] = (a[c.coluna] || 0) + 1; return a; }, {}),
      valido: window.OG.persistencia.validarEstado(app.estado).ok,
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
    contagens: Array.from(document.querySelectorAll('.coluna')).reduce((a, col) => {
      a[col.dataset.coluna] = col.querySelectorAll('.card').length;
      return a;
    }, {}),
  }));
  assert.equal(hud.caixa, real.caixa, 'caixa na tela difere do estado');
  assert.equal(hud.prestigio, real.prestigio, 'prestígio na tela difere do estado');
  assert.equal(hud.tradicao, real.tradicao, 'tradição na tela difere do estado');
  ['backlog', 'afazer', 'andamento', 'revisao', 'concluido'].forEach((c) => {
    assert.equal(hud.contagens[c], real.colunas[c] || 0, 'cards na coluna ' + c);
  });
  assert.ok(real.valido, 'estado ficou inválido');
}

async function visivel(page, seletor) {
  const el = await page.$(seletor);
  return !!el && (await el.isVisible());
}

async function clicarHabilitado(page, seletor) {
  const botoes = await page.$$(seletor);
  for (const b of botoes) {
    if (!(await b.isVisible())) continue;
    if ((await b.getAttribute('aria-disabled')) === 'true') continue;
    await b.click();
    return true;
  }
  return false;
}

/** Joga uma partida inteira pela interface. Retorna o número de ações feitas. */
async function jogarPelaInterface(page, opcoes) {
  opcoes = opcoes || {};
  let acoes = 0;
  for (let passo = 0; passo < 400; passo++) {
    const real = await estadoReal(page);
    if (real && real.tela === 'fim') return acoes;
    acoes++;
    if (await visivel(page, '.modal [data-acao="confirmar-evento"]')) {
      const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
      await botoes[botoes.length - 1].click();
    } else if (await visivel(page, '.modal [data-acao="resolver-decisao"]')) {
      await clicarHabilitado(page, '.modal [data-acao="resolver-decisao"]');
    } else if (await visivel(page, '.modal [data-acao="avancar"]')) {
      await page.click('.modal [data-acao="avancar"]');
    } else if (await visivel(page, '.modal [data-acao="confirmar-acao"]')) {
      await page.click('.modal [data-acao="confirmar-acao"]');
    } else if (await clicarHabilitado(page, '.card [data-acao="abrir-revisar"]')) {
      await page.waitForSelector('.modal [data-acao="confirmar-revisao"]');
      await page.click('.modal [data-acao="confirmar-revisao"]');
    } else if (await clicarHabilitado(page, '.card [data-acao="mutirao"]')) {
      // usou o Mutirão
    } else if (await clicarHabilitado(page, '.card [data-acao="abrir-completar"]')) {
      await page.waitForSelector('.modal [data-acao="confirmar-equipe"]');
      if (!(await clicarHabilitado(page, '.modal [data-acao="confirmar-equipe"]'))) await page.click('.modal [data-acao="fechar-modal"]');
    } else if (!opcoes.semIniciar && real.rodada < 4 && await clicarHabilitado(page, '.card [data-acao="abrir-iniciar"]')) {
      await page.waitForSelector('.modal [data-acao="confirmar-equipe"]');
      if (!(await clicarHabilitado(page, '.modal [data-acao="confirmar-equipe"]'))) {
        await page.click('.modal [data-acao="fechar-modal"]');
        await page.click('[data-acao="encerrar-rodada"]');
      }
    } else if (!opcoes.semIniciar && real.rodada < 4 && (real.colunas.afazer || 0) === 0 && await clicarHabilitado(page, '.card [data-acao="planejar"]')) {
      // planejou
    } else {
      await clicarHabilitado(page, '[data-acao="encerrar-rodada"]');
    }
    await page.waitForTimeout(25);
    await conferirHud(page);
  }
  throw new Error('A partida não terminou em 400 passos');
}

async function conferirTelaFinal(page) {
  await page.waitForSelector('.tela-fim');
  const dados = await page.evaluate(() => {
    const app = window.OG.app.estadoAtual();
    const p = window.OG.pontuacao.calcular(app.estado);
    const linhas = Array.from(document.querySelectorAll('.tabela-pontos tr')).map((tr) => tr.lastElementChild.textContent.trim());
    return { p, linhas, carimbo: document.querySelector('.carimbo').textContent.trim() };
  });
  const valores = dados.linhas.slice(0, 4).map(Number);
  const total = Number(dados.linhas[4]);
  assert.equal(valores.reduce((a, b) => a + b, 0), total, 'linhas da pontuação não somam o total');
  assert.equal(total, dados.p.total);
  assert.equal(dados.carimbo, dados.p.classificacao);
  return dados.p;
}

async function semRolagemHorizontal(page) {
  const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: window.innerWidth }));
  assert.ok(r.sw <= r.w + 1, 'a página rola na horizontal: ' + r.sw + ' > ' + r.w);
}

(async () => {
  fs.mkdirSync(PASTA_PRINTS, { recursive: true });
  const browser = await chromium.launch();

  await caso('tela inicial abre sem erros e mostra os 5 coordenadores', async () => {
    const page = await novaPagina(browser);
    await page.waitForSelector('.tela-inicio');
    const nomes = await page.$$eval('.inicio-membro .nome', (els) => els.map((e) => e.textContent));
    assert.deepEqual(nomes, ['Sumindo', 'Antune', 'Luize', 'Ryani', 'JV']);
    assert.ok(await visivel(page, '[data-acao="jogar"]'));
    assert.ok(await visivel(page, '[data-acao="como-jogar"]'));
    assert.ok(await visivel(page, '[data-acao="configuracoes"]'));
    await page.screenshot({ path: path.join(PASTA_PRINTS, '01-inicio.png') });
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('como jogar e configurações abrem e fecham (Esc devolve o foco)', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="como-jogar"]');
    await page.waitForSelector('.modal');
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

  for (const missao of ['farroupilha', 'halloween', 'liga', 'estudante']) {
    await caso('partida completa pela interface: ' + missao, async () => {
      const page = await novaPagina(browser);
      await page.click('[data-acao="jogar"]');
      await page.click('[data-missao="' + missao + '"]');
      await page.waitForSelector('.tela-jogo');
      if (missao === 'farroupilha') await page.screenshot({ path: path.join(PASTA_PRINTS, '02-evento.png') });
      const acoes = await jogarPelaInterface(page);
      const p = await conferirTelaFinal(page);
      assert.ok(p.concluidos >= 3, missao + ': só ' + p.concluidos + ' projetos concluídos pelo robô da interface');
      if (missao === 'farroupilha') await page.screenshot({ path: path.join(PASTA_PRINTS, '09-fim.png'), fullPage: true });
      assert.deepEqual(page.errosConsole, []);
      console.log('     ' + missao + ': ' + acoes + ' passos, ' + p.total + ' pontos, ' + p.aproveitamento + '%, ' + p.classificacao + (p.missaoCumprida ? ', missão cumprida' : ''));
      await page.context().close();
    });
  }

  await caso('partida sem iniciar nada termina como "A DIREÇÃO QUER CONVERSAR"', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="junina"]');
    await jogarPelaInterface(page, { semIniciar: true });
    const p = await conferirTelaFinal(page);
    assert.equal(p.classificacao, 'A DIREÇÃO QUER CONVERSAR');
    await page.context().close();
  });

  await caso('arrastar e soltar: movimento válido move, inválido explica o motivo', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="farroupilha"]');
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].click();
    // Backlog -> Em andamento direto: recusado
    await page.dragAndDrop('.card[data-carta="mateada"]', '#coluna-andamento');
    await page.waitForSelector('.aviso-erro');
    const msg = await page.textContent('.aviso-erro');
    assert.match(msg, /planeje/i);
    // Backlog -> A fazer: aceito
    await page.dragAndDrop('.card[data-carta="mateada"]', '#coluna-afazer');
    await page.waitForSelector('#coluna-afazer .card[data-carta="mateada"]');
    // A fazer -> Em andamento: abre a escolha de equipe
    await page.dragAndDrop('.card[data-carta="mateada"]', '#coluna-andamento');
    await page.waitForSelector('.modal [data-acao="confirmar-equipe"]');
    await page.screenshot({ path: path.join(PASTA_PRINTS, '03-equipe.png') });
    await page.click('.modal [data-acao="confirmar-equipe"]');
    await page.waitForSelector('#coluna-andamento .card[data-carta="mateada"]');
    // Card em andamento não pode ser arrastado para Revisão (não tem draggable)
    const arrastavel = await page.getAttribute('.card[data-carta="mateada"]', 'draggable');
    assert.equal(arrastavel, null);
    await conferirHud(page);
    await page.screenshot({ path: path.join(PASTA_PRINTS, '04-quadro.png') });
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('limite de 2 em andamento: o terceiro "Iniciar" fica bloqueado e explica', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="halloween"]');
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].click();
    for (const id of ['fantasias', 'cinema_terror', 'deco_terror']) {
      await page.click('[data-acao="planejar"][data-carta="' + id + '"]');
    }
    for (const id of ['fantasias', 'cinema_terror']) {
      await page.click('[data-acao="abrir-iniciar"][data-carta="' + id + '"]');
      await page.click('.modal [data-acao="confirmar-equipe"]');
    }
    const bloqueado = await page.getAttribute('[data-acao="abrir-iniciar"][data-carta="deco_terror"]', 'aria-disabled');
    assert.equal(bloqueado, 'true');
    // O botão parece desabilitado, mas o clique explica o motivo (force: o Playwright não clica em aria-disabled).
    await page.click('[data-acao="abrir-iniciar"][data-carta="deco_terror"]', { force: true });
    await page.waitForSelector('.aviso-erro');
    assert.match(await page.textContent('.aviso-erro'), /Limite atingido/);
    const real = await estadoReal(page);
    assert.equal(real.colunas.andamento, 2);
    await page.context().close();
  });

  await caso('recarregar a página no meio da rodada mantém tudo', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="junina"]');
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].click();
    await page.click('[data-acao="planejar"][data-carta="correio"]');
    await page.click('[data-acao="abrir-iniciar"][data-carta="correio"]');
    await page.click('.modal [data-acao="confirmar-equipe"]');
    const antes = await estadoReal(page);
    await page.reload();
    await page.waitForSelector('[data-acao="continuar"]');
    await page.click('[data-acao="continuar"]');
    await page.waitForSelector('.tela-jogo');
    const depois = await estadoReal(page);
    assert.deepEqual(depois, antes);
    await conferirHud(page);
    await page.context().close();
  });

  await caso('nova partida pedida durante um evento substitui a anterior por completo', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="gamer"]');
    let botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].click();
    await page.click('[data-acao="planejar"][data-carta="brawl_stars"]');
    await page.click('[data-acao="abrir-iniciar"][data-carta="brawl_stars"]');
    await page.click('.modal [data-acao="confirmar-equipe"]');
    await page.click('[data-acao="encerrar-rodada"]');
    if (await visivel(page, '.modal [data-acao="resolver-decisao"]')) await clicarHabilitado(page, '.modal [data-acao="resolver-decisao"]');
    await page.click('.modal [data-acao="avancar"]');
    // Evento da rodada 2 aberto: abre o menu por dentro da carta.
    await page.waitForSelector('.modal [data-acao="confirmar-evento"]');
    await page.click('.modal [data-acao="menu"]');
    await page.click('.modal [data-acao="nova-partida"]');
    await page.waitForSelector('.tela-missoes');
    await page.click('[data-missao="cultural"]');
    await page.waitForSelector('.modal [data-acao="confirmar-acao"]');
    await page.click('.modal [data-acao="confirmar-acao"]');
    await page.waitForSelector('.tela-jogo');
    const real = await page.evaluate(() => {
      const e = window.OG.app.estadoAtual().estado;
      return { missao: e.missaoId, rodada: e.rodada, livro: e.livro.length, todasNoBacklog: e.cartas.every((c) => c.coluna === 'backlog'), fase: e.fase };
    });
    assert.deepEqual(real, { missao: 'cultural', rodada: 1, livro: 3, todasNoBacklog: true, fase: 'evento' });
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('teclado: planejar com Enter e o foco acompanha o card', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="farroupilha"]');
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].focus();
    await page.keyboard.press('Enter');
    await page.focus('[data-acao="planejar"][data-carta="pilcha"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#coluna-afazer .card[data-carta="pilcha"]');
    const foco = await page.evaluate(() => document.activeElement && document.activeElement.dataset.foco);
    assert.equal(foco, 'abrir-iniciar:pilcha');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.modal [data-acao="confirmar-equipe"]');
    // Tab fica preso dentro da janela
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab');
    const dentro = await page.evaluate(() => !!document.activeElement.closest('.modal'));
    assert.ok(dentro, 'o foco escapou da janela modal');
    await page.keyboard.press('Escape');
    assert.equal(await page.$('.modal'), null);
    await page.context().close();
  });

  await caso('celular (390×844): sem rolagem lateral, abas de coluna e navegação inferior', async () => {
    const page = await novaPagina(browser, { width: 390, height: 844 });
    await semRolagemHorizontal(page);
    await page.screenshot({ path: path.join(PASTA_PRINTS, '05-celular-inicio.png'), fullPage: true });
    await page.click('[data-acao="jogar"]');
    await semRolagemHorizontal(page);
    await page.click('[data-missao="farroupilha"]');
    await page.screenshot({ path: path.join(PASTA_PRINTS, '06-celular-evento.png') });
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].click();
    await semRolagemHorizontal(page);
    assert.ok(await visivel(page, '.nav-celular'));
    assert.ok(await visivel(page, '.trocar-coluna'));
    await page.click('[data-acao="planejar"][data-carta="mateada"]');
    await page.click('[data-acao="coluna-mobile"][data-coluna="afazer"]');
    await page.waitForTimeout(500);
    assert.ok(await page.isVisible('#coluna-afazer .card[data-carta="mateada"]'));
    await page.screenshot({ path: path.join(PASTA_PRINTS, '07-celular-quadro.png') });
    await page.click('.nav-celular [data-aba="equipe"]');
    assert.ok(await visivel(page, '.painel-equipe'));
    await page.screenshot({ path: path.join(PASTA_PRINTS, '08-celular-equipe.png'), fullPage: true });
    await page.click('.nav-celular [data-aba="diario"]');
    assert.ok(await visivel(page, '.painel-diario'));
    await page.click('.nav-celular [data-aba="quadro"]');
    // Encerrar pela barra inferior
    await page.click('.nav-celular [data-acao="encerrar-rodada"]');
    await page.waitForSelector('.modal');
    await semRolagemHorizontal(page);
    // Joga até o fim no celular
    await jogarPelaInterface(page);
    await conferirTelaFinal(page);
    await semRolagemHorizontal(page);
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('tablet (900×1100): equipe abre como painel lateral', async () => {
    const page = await novaPagina(browser, { width: 900, height: 1100 });
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="liga"]');
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].click();
    await semRolagemHorizontal(page);
    await page.click('[data-acao="abrir-lateral"]');
    await page.waitForTimeout(250);
    assert.ok(await visivel(page, '.painel-equipe'));
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const aberta = await page.evaluate(() => document.querySelector('.tela-jogo').classList.contains('lateral-aberta'));
    assert.equal(aberta, false);
    await page.screenshot({ path: path.join(PASTA_PRINTS, '10-tablet.png') });
    await page.context().close();
  });

  await caso('configuração "caixa apertado" vale para a próxima partida e fica salva', async () => {
    const page = await novaPagina(browser);
    await page.click('[data-acao="configuracoes"]');
    await page.check('.modal [data-acao="alternar-caixa-apertado"]');
    await page.click('.modal [data-acao="fechar-modal"]');
    await page.reload();
    await page.click('[data-acao="jogar"]');
    await page.click('[data-missao="talentos"]');
    const botoes = await page.$$('.modal [data-acao="confirmar-evento"]:not([aria-disabled="true"])');
    await botoes[botoes.length - 1].click();
    const inicial = await page.evaluate(() => {
      const e = window.OG.app.estadoAtual().estado;
      return { apertado: e.caixaApertado, inicial: e.livro[0].valor };
    });
    assert.deepEqual(inicial, { apertado: true, inicial: 200 });
    assert.ok(await visivel(page, '.hud-modo'));
    await conferirHud(page);
    await jogarPelaInterface(page);
    await conferirTelaFinal(page);
    assert.deepEqual(page.errosConsole, []);
    await page.context().close();
  });

  await caso('estado salvo adulterado é descartado com aviso', async () => {
    const page = await novaPagina(browser);
    await page.evaluate(() => localStorage.setItem('operacao-gremio-mesquita:partida', '{"versao":1,"missaoId":"x"}'));
    await page.reload();
    await page.waitForSelector('.aviso-erro');
    assert.match(await page.textContent('.aviso-erro'), /danificada/);
    assert.equal(await page.$('[data-acao="continuar"]'), null);
    await page.context().close();
  });

  await browser.close();
  console.log(falhas ? '\n' + falhas + ' caso(s) falharam.' : '\nTodos os casos de interface passaram.');
  process.exit(falhas ? 1 : 0);
})();
