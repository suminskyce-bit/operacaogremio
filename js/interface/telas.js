/*
 * telas.js — telas (início, missões, jogo, fim) e o conteúdo das janelas modais.
 * Cada função recebe o estado da aplicação e devolve HTML. Quem decide o que mostrar
 * é o app.js; quem decide as regras é o núcleo.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function esc(v) { return OG.ui.esc(v); }
  function ic(nome, classe, rotulo) { return OG.icones.icone(nome, classe, rotulo); }
  function din(v) { return OG.util.formatarDinheiro(v); }
  function E() { return OG.estado; }
  function C() { return OG.componentes; }
  function plural(n, s, p) { return OG.util.plural(n, s, p); }

  // Faixa de cor de cada cartaz de missão (a Farroupilha leva as cores da bandeira do RS).
  const TEMAS = {
    farroupilha: 'linear-gradient(90deg, #1d8a4d 0 33.3%, #d42a2a 33.3% 66.6%, #f5c400 66.6%)',
    junina: '#f08a24',
    halloween: 'repeating-linear-gradient(90deg, #ff7a00 0 22px, #2b1638 22px 44px)',
    gamer: '#7548d8',
    liga: '#2f9e43',
    cultural: '#e0446a',
    profissoes: '#2a88d6',
    talentos: '#c2189b',
    estudante: '#ffc83d',
    concolor: '#0d948b',
  };

  function textoRecompensa(rec) {
    const partes = [];
    if (rec.dinheiro) partes.push('+' + din(rec.dinheiro));
    if (rec.prestigio) partes.push('+' + rec.prestigio + ' Prestígio');
    if (rec.tradicao) partes.push('+' + rec.tradicao + ' Tradição');
    return OG.util.listaPt(partes);
  }

  function marca(extra) {
    return '<span class="marca' + (extra ? ' ' + extra : '') + '" aria-hidden="true"><span class="marca-escola">Escola Técnica</span><span class="marca-mesquita">Mesquita</span></span>';
  }

  // ======================= Telas =======================

  function telaInicio(app) {
    const salvo = app.estado;
    const botoes = [];
    let detalheSalvo = '';
    if (salvo) {
      const m = E().missao(salvo);
      if (salvo.fase === 'fim') {
        botoes.push('<button type="button" class="botao botao-secundario botao-grande" data-acao="continuar" data-foco="continuar">' + ic('premio') + 'Ver o resultado da última partida</button>');
      } else {
        botoes.push('<button type="button" class="botao botao-primario botao-grande" data-acao="continuar" data-foco="continuar" data-foco-principal>' + ic('jogar') + 'Continuar partida</button>');
        detalheSalvo = '<p class="inicio-continuar">Partida salva: ' + esc(m.nome) + ', rodada ' + salvo.rodada + ' de ' + OG.regras.TOTAL_RODADAS + '.</p>';
      }
    }
    const novaPrincipal = !salvo || salvo.fase === 'fim';
    botoes.push('<button type="button" class="botao ' + (novaPrincipal ? 'botao-primario' : 'botao-fantasma') + ' botao-grande" data-acao="jogar" data-foco="jogar"' + (novaPrincipal ? ' data-foco-principal' : '') + '>' +
      (novaPrincipal ? ic('jogar') : '') + (salvo && !novaPrincipal ? 'Nova partida' : 'Jogar') + '</button>');
    botoes.push('<button type="button" class="botao botao-fantasma botao-grande" data-acao="como-jogar" data-foco="como-jogar">' + ic('ajuda') + 'Como jogar</button>');
    botoes.push('<button type="button" class="botao botao-fantasma botao-grande" data-acao="configuracoes" data-foco="configuracoes">' + ic('config') + 'Configurações</button>');

    const membros = OG.dados.coordenadores.map(function (p) {
      return '<li class="inicio-membro">' + C().avatar(E().pessoa(p.id)) + '<span><span class="nome">' + esc(p.nome) + '</span><span class="cargo">' + esc(p.cargo) + '</span></span></li>';
    }).join('');

    return '<main class="tela tela-inicio" id="conteudo">' +
      '<div class="inicio-cabeca">' + marca() + '</div>' +
      '<section class="inicio-heroi" aria-labelledby="titulo-jogo">' +
      '<h1 class="titulo-jogo" id="titulo-jogo"><span class="linha">Operação</span><span class="faixa">Grêmio</span><span class="visualmente-oculto"> — Mesquita</span></h1>' +
      '<p class="inicio-texto">Organize os eventos da escola num quadro Kanban: escolha os projetos, monte a equipe, cuide do caixa e encare os imprevistos. São 4 rodadas, uns 20 minutos.</p>' +
      '<div class="inicio-acoes">' + botoes.join('') + '</div>' + detalheSalvo +
      (app.config.caixaApertado ? '<p class="inicio-continuar">Configuração ativa: caixa apertado (novas partidas começam com ' + din(OG.regras.CAIXA_APERTADO) + ').</p>' : '') +
      '</section>' +
      '<section class="inicio-time" aria-labelledby="titulo-coordenacao"><h2 id="titulo-coordenacao">A coordenação do Grêmio</h2><ul class="inicio-equipe">' + membros + '</ul></section>' +
      '</main>';
  }

  function telaMissoes(app) {
    const caixa = app.config.caixaApertado ? OG.regras.CAIXA_APERTADO : OG.regras.CAIXA_INICIAL;
    const cartazes = OG.dados.missoes.map(function (m) {
      const projetos = m.projetos.map(function (id) {
        const p = OG.dados.projetosPorId[id];
        return '<li><span class="ponto-cat" style="--cat: var(--cat-' + p.categoria + ')" title="' + esc(OG.dados.categorias[p.categoria].nome) + '"></span>' +
          esc(p.nome) + (p.tempo > 1 ? '<span class="tempo-longo">2 rodadas</span>' : '') + '</li>';
      }).join('');
      return '<li class="cartaz-missao" style="--tema: ' + TEMAS[m.id] + '">' +
        '<div class="cartaz-faixa" style="background: ' + TEMAS[m.id] + '"></div>' +
        '<h2>' + esc(m.nome) + '</h2>' +
        '<p class="cartaz-desc">' + esc(m.descricao) + '</p>' +
        '<dl class="cartaz-dados">' +
        '<dt>Objetivo</dt><dd>Concluir ' + m.objetivo + ' dos 6 projetos</dd>' +
        '<dt>Recompensa</dt><dd>' + esc(textoRecompensa(m.recompensa)) + '</dd>' +
        '<dt>Meta</dt><dd>' + OG.pontuacao.metaDaMissao(m.id, caixa) + ' pontos</dd>' +
        '</dl>' +
        '<ul class="cartaz-projetos" aria-label="Projetos da missão">' + projetos + '</ul>' +
        '<button type="button" class="botao botao-primario" data-acao="escolher-missao" data-missao="' + m.id + '" data-foco="missao:' + m.id + '">Jogar ' + esc(m.nome) + '</button>' +
        '</li>';
    }).join('');
    return '<main class="tela tela-missoes" id="conteudo">' +
      '<header class="barra-topo"><button type="button" class="botao botao-fantasma botao-pequeno" data-acao="voltar-inicio" data-foco="voltar-inicio" data-foco-principal>' + ic('voltar') + 'Início</button>' +
      '<h1>Escolha a missão</h1>' + marca() + '</header>' +
      '<p class="missoes-intro">Cada missão traz 6 projetos. O Grêmio começa com ' + din(caixa) + ', 20 de prestígio e 20 de tradição. A meta é a pontuação do melhor plano possível sem imprevistos.</p>' +
      '<ul class="grade-missoes">' + cartazes + '</ul>' +
      '</main>';
  }

  function telaJogo(app) {
    const estado = app.estado;
    const colunas = OG.regras.COLUNAS;
    const aba = app.ui.abaMobile;
    const trocar = '<nav class="trocar-coluna" aria-label="Colunas do quadro">' + colunas.map(function (col) {
      const n = E().cartasNaColuna(estado, col.id).length;
      return '<button type="button" data-acao="coluna-mobile" data-coluna="' + col.id + '" aria-current="' + (app.ui.colunaMobile === col.id) + '" data-foco="colmob:' + col.id + '">' +
        C().NOMES_COLUNA[col.id] + ' ' + (col.limite ? n + '/' + col.limite : n) + '</button>';
    }).join('') + '</nav>';

    const podeEncerrar = estado.fase === 'planejamento';
    const rotuloNav = estado.fase === 'resumo'
      ? (estado.rodada >= OG.regras.TOTAL_RODADAS ? 'Ver resultado' : 'Próxima rodada')
      : 'Encerrar rodada';
    const acaoNav = estado.fase === 'resumo' ? 'avancar' : 'encerrar-rodada';
    const navCelular = '<nav class="nav-celular" aria-label="Navegação do jogo">' +
      '<button type="button" data-acao="aba-mobile" data-aba="quadro" aria-current="' + (aba === 'quadro') + '" data-foco="nav:quadro">' + ic('kanban') + 'Quadro</button>' +
      '<button type="button" data-acao="aba-mobile" data-aba="equipe" aria-current="' + (aba === 'equipe') + '" data-foco="nav:equipe">' + ic('pessoas') + 'Equipe</button>' +
      '<button type="button" data-acao="aba-mobile" data-aba="diario" aria-current="' + (aba === 'diario') + '" data-foco="nav:diario">' + ic('historico') + 'Diário</button>' +
      '<button type="button" class="botao-encerrar" data-acao="' + acaoNav + '" data-foco="nav:encerrar"' +
      (podeEncerrar || estado.fase === 'resumo' ? '' : ' aria-disabled="true" data-motivo="' + esc(OG.kanban.mensagemFase(estado)) + '"') + '>' +
      ic('rodada') + esc(rotuloNav) + '</button>' +
      '</nav>';

    return '<div class="tela tela-jogo aba-' + aba + (app.ui.lateralAberta ? ' lateral-aberta' : '') + '">' +
      '<a class="pular" href="#quadro">Pular para o quadro</a>' +
      C().hud(estado) +
      C().faixaEvento(estado) +
      trocar +
      '<div class="jogo-corpo">' +
      '<main class="quadro" id="quadro" aria-label="Quadro Kanban" tabindex="-1">' +
      colunas.map(function (col) { return C().coluna(estado, col); }).join('') +
      '</main>' +
      '<aside class="lateral" aria-label="Equipe e diário do Grêmio">' + C().painelEquipe(estado) + C().painelDiario(estado, app.ui.aba) + '</aside>' +
      '</div>' + navCelular + '</div>';
  }

  function telaFim(app) {
    const estado = app.estado;
    const m = E().missao(estado);
    const p = OG.pontuacao.calcular(estado);
    const f = OG.pontuacao.resumoFinanceiro(estado);
    const R = OG.regras;
    const escala = 120;
    const largura = Math.max(0, Math.min(p.aproveitamento, escala)) / escala * 100;
    const marcas = [40, 60, 80, 100].map(function (v) {
      return '<span class="marca-faixa" style="left:' + (v / escala * 100) + '%"></span>';
    }).join('');

    const linhasPontos = p.itens.map(function (i) {
      return '<tr><td>' + esc(i.rotulo) + '</td><td class="conta-pts">' + esc(i.conta) + '</td><td>' + i.pontos + '</td></tr>';
    }).join('') + '<tr class="total"><td>Total</td><td></td><td>' + p.total + '</td></tr>';

    const projetos = estado.cartas.slice().sort(function (a, b) {
      return OG.kanban.ORDEM.indexOf(b.coluna) - OG.kanban.ORDEM.indexOf(a.coluna);
    }).map(function (c) {
      const proj = E().projetoDaCarta(c);
      const situacoes = {
        concluido: ['Concluído', 'selo-bom'],
        revisao: ['Faltou revisar', 'selo-alerta'],
        andamento: ['Ficou em andamento', 'selo-alerta'],
        afazer: [c.custoPago !== null ? 'Pago, não terminou' : 'Não iniciado', c.custoPago !== null ? 'selo-alerta' : 'selo-info'],
        backlog: ['Não escolhido', 'selo-info'],
      };
      const s = situacoes[c.coluna];
      return '<li><span class="ponto-cat" style="--cat: var(--cat-' + proj.categoria + ')"></span>' + esc(proj.nome) +
        '<span class="situacao selo ' + s[1] + '">' + s[0] + '</span></li>';
    }).join('');

    const missaoTexto = p.missaoCumprida
      ? '<p class="caixa-bom">' + ic('concluido') + '<span><strong>Missão cumprida:</strong> ' + p.concluidos + ' projetos concluídos (objetivo: ' + p.objetivo + '). Recompensa recebida: ' + esc(textoRecompensa(p.recompensa)) + '.</span></p>'
      : '<p class="caixa-alerta">' + ic('alerta') + '<span><strong>Missão não cumprida:</strong> ' + p.concluidos + ' de ' + p.objetivo + ' projetos concluídos. A recompensa (' + esc(textoRecompensa(p.recompensa)) + ') ficou de fora.</span></p>';

    const licoes = [];
    licoes.push('Os projetos concluídos trouxeram ' + din(f.receitaProjetos) + ' de retorno, mas o lucro deles foi ' + din(f.lucroProjetosConcluidos) + ': retorno não é lucro.');
    if (f.investimentoParado > 0) licoes.push(din(f.investimentoParado) + ' ficaram parados em projetos pagos que não terminaram. Dinheiro investido sem retorno.');
    if (f.despesas > 0) licoes.push('Imprevistos custaram ' + din(f.despesas) + '. Guardar caixa ajuda a absorver o que ninguém planejou.');

    return '<main class="tela tela-fim" id="conteudo">' +
      '<header class="barra-topo" style="padding-left:0;padding-right:0"><h1>Fim de jogo</h1>' + marca() + '</header>' +
      '<section class="fim-destaque" aria-labelledby="classificacao">' +
      '<p class="fim-resumo">' + esc(m.nome) + (estado.caixaApertado ? ' (caixa apertado)' : '') + '</p>' +
      '<h2 id="classificacao" class="carimbo' + (p.aproveitamento < 40 ? ' conversar' : '') + '" tabindex="-1" data-foco-principal>' + esc(p.classificacao) + '</h2>' +
      '<p class="fim-resumo">O Grêmio terminou com <strong>' + p.total + ' pontos</strong>. Descontando os ' + p.pontosIniciais + ' do começo, conquistou ' + p.conquistado + ' dos ' + p.metaConquista + ' que o melhor plano possível conquistaria: <strong>' + p.aproveitamento + '% de aproveitamento</strong>.</p>' +
      '<div class="aproveitamento" role="img" aria-label="Aproveitamento de ' + p.aproveitamento + '%">' +
      '<div class="aproveitamento-barra"><span class="valor" style="width:' + largura + '%"></span>' + marcas + '</div>' +
      '<div class="aproveitamento-legenda" aria-hidden="true"><span style="left:0">0%</span>' +
      [[40, 'Sobreviveu'], [60, 'Aprovado'], [80, 'Destaque'], [100, 'Lendário']].map(function (f) {
        return '<span style="left:' + (f[0] / escala * 100) + '%">' + f[0] + '%<br>' + f[1] + '</span>';
      }).join('') + '</div>' +
      '</div></section>' +
      '<div class="fim-grade" style="margin-top:18px">' +
      '<section class="painel" aria-labelledby="t-pontos"><h2 id="t-pontos">' + ic('premio') + ' Pontuação</h2>' +
      '<table class="tabela-pontos" style="margin-top:8px"><caption class="visualmente-oculto">Cálculo da pontuação</caption><tbody>' + linhasPontos + '</tbody></table>' +
      '<p class="nota" style="margin-top:10px">Meta da missão: ' + p.meta + ' pontos. Pontos iniciais: ' + p.pontosIniciais + ' (caixa ÷ ' + R.REAIS_POR_PONTO + ' + prestígio + tradição do começo).</p></section>' +
      '<section class="painel" aria-labelledby="t-missao"><h2 id="t-missao">' + ic('missao') + ' Missão</h2><div style="margin-top:10px;display:grid;gap:12px">' + missaoTexto +
      '<ul class="lista-projetos-fim">' + projetos + '</ul></div></section>' +
      '<section class="painel" aria-labelledby="t-dinheiro" style="grid-column:1/-1"><h2 id="t-dinheiro">' + ic('financas') + ' Dinheiro do Grêmio</h2>' +
      '<div style="display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));margin-top:10px">' +
      '<dl class="resumo-financeiro">' +
      '<dt>Caixa inicial</dt><dd>' + din(f.caixaInicial) + '</dd>' +
      '<dt>Investido em projetos</dt><dd class="menos">' + din(-f.investido) + '</dd>' +
      '<dt>Retorno de projetos</dt><dd class="mais">' + OG.util.formatarDinheiroComSinal(f.receitaProjetos) + '</dd>' +
      '<dt>Patrocínios e recompensas</dt><dd class="mais">' + OG.util.formatarDinheiroComSinal(f.outrasReceitas) + '</dd>' +
      '<dt>Despesas inesperadas</dt><dd class="menos">' + din(-f.despesas) + '</dd>' +
      '<dt><strong>Caixa final</strong></dt><dd>' + din(f.caixaFinal) + '</dd></dl>' +
      '<ul class="lista-simples">' + licoes.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '</div></section></div>' +
      '<div class="fim-acoes">' +
      '<button type="button" class="botao botao-primario botao-grande" data-acao="jogar-de-novo" data-foco="jogar-de-novo">' + ic('reiniciar') + 'Jogar ' + esc(m.nome) + ' de novo</button>' +
      '<button type="button" class="botao botao-fantasma botao-grande" data-acao="outra-missao" data-foco="outra-missao">Escolher outra missão</button>' +
      '<button type="button" class="botao botao-fantasma botao-grande" data-acao="voltar-inicio" data-foco="voltar-inicio">' + ic('inicio') + 'Início</button>' +
      '</div></main>';
  }

  // ======================= Modais =======================

  function cabecalho(titulo, sub, fechavel, rotuloFechar) {
    return '<header class="modal-cabeca"><div style="flex:1"><h2 id="modal-titulo">' + esc(titulo) + '</h2>' +
      (sub ? '<p class="modal-sub">' + sub + '</p>' : '') + '</div>' +
      (fechavel ? '<button type="button" class="botao botao-secundario botao-icone" data-acao="fechar-modal" aria-label="' + esc(rotuloFechar || 'Fechar') + '">' + ic('fechar') + '</button>' : '') +
      '</header>';
  }

  function botaoOpcao(acao, op, extra) {
    const motivo = op.habilitado === false ? ' aria-disabled="true" data-motivo="' + esc(op.motivo || 'Indisponível') + '" title="' + esc(op.motivo || '') + '"' : '';
    return '<button type="button" class="botao ' + (extra || 'botao-primario') + '" data-acao="' + acao + '" data-escolha="' + esc(op.id) + '" data-foco="' + acao + ':' + esc(op.id) + '"' + motivo + '>' + esc(op.rotulo) + '</button>';
  }

  function modalEvento(app) {
    const estado = app.estado;
    const opcoes = OG.eventos.opcoesEvento(estado);
    const botoes = opcoes.map(function (op, i) {
      return botaoOpcao('confirmar-evento', op, i === opcoes.length - 1 ? 'botao-primario' : 'botao-secundario');
    }).join('');
    return {
      chave: 'evento:' + estado.rodada + ':' + estado.eventoAtual.id,
      classe: 'modal-evento',
      dispensavel: false,
      html: '<div class="modal-corpo" style="padding-top:20px">' + C().cartaEvento(estado) + '</div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-secundario botao-pequeno" data-acao="menu" style="margin-right:auto">' + ic('menu') + 'Menu</button>' + botoes + '</footer>',
    };
  }

  function modalVerEvento(app) {
    return {
      chave: 'ver-evento',
      dispensavel: true,
      html: '<div class="modal-corpo" style="padding-top:20px">' + C().cartaEvento(app.estado) + '</div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="fechar-modal" data-foco-inicial>Voltar ao quadro</button></footer>',
    };
  }

  function modalDecisao(app) {
    const estado = app.estado;
    const dec = OG.eventos.decisaoFimRodada(estado);
    if (!dec) return null;
    const opcoes = dec.opcoes.map(function (op) {
      const motivo = op.habilitado ? '' : ' aria-disabled="true" data-motivo="' + esc(op.motivo || '') + '"';
      return '<li><button type="button" class="opcao' + (op.habilitado ? '' : ' desabilitada') + '" data-acao="resolver-decisao" data-escolha="' + esc(op.id) + '" data-foco="decisao:' + esc(op.id) + '"' + motivo + '>' +
        '<span class="decisao-opcao"><strong>' + esc(op.rotulo) + '</strong><span>' + esc(op.habilitado ? op.descricao : (op.motivo || '')) + '</span></span></button></li>';
    }).join('');
    return {
      chave: 'decisao:' + estado.rodada,
      dispensavel: false,
      html: cabecalho(dec.titulo, 'Fim da rodada ' + estado.rodada + ': o evento cobra a conta agora.', false) +
        '<div class="modal-corpo"><p>' + esc(dec.pergunta) + '</p><ul class="lista-opcoes">' + opcoes + '</ul></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-secundario" data-acao="cancelar-encerramento">' + ic('voltar') + 'Voltar ao quadro</button></footer>',
    };
  }

  function modalResumo(app) {
    const estado = app.estado;
    const r = E().recursos(estado);
    const m = E().missao(estado);
    const icones = { avancou: 'concluido', parado: 'parado', equipe: 'pessoas', evento: 'info', info: 'info' };
    const linhas = estado.resumo.linhas.map(function (l) {
      return '<li class="' + l.tipo + '">' + ic(icones[l.tipo] || 'info') + '<span>' + esc(l.texto) + '</span></li>';
    }).join('');
    const ultima = estado.rodada >= OG.regras.TOTAL_RODADAS;
    let aviso = '';
    if (ultima) {
      const revisao = E().cartasNaColuna(estado, 'revisao').length;
      aviso = revisao ? '<p class="caixa-alerta">' + ic('alerta') + '<span>' + revisao + ' ' + plural(revisao, 'projeto terminou', 'projetos terminaram') + ' a execução agora, mas não há mais rodada para revisar. Não contam como concluídos.</span></p>' : '';
    } else {
      const revisao = E().cartasNaColuna(estado, 'revisao').length;
      if (revisao) aviso = '<p class="caixa-info">Na próxima rodada, revise ' + (revisao === 1 ? 'o projeto' : 'os ' + revisao + ' projetos') + ' em Revisão para receber retorno e pontos.</p>';
    }
    return {
      chave: 'resumo:' + estado.rodada,
      dispensavel: true,
      aoDispensar: 'fechar-resumo',
      html: cabecalho('Fim da rodada ' + estado.rodada, ultima ? 'Essa foi a última rodada.' : 'Veja o que aconteceu antes da próxima carta de evento.', true, 'Ver o quadro') +
        '<div class="modal-corpo"><ul class="resumo-linhas">' + linhas + '</ul>' + aviso +
        '<div class="mini-recursos"><span>' + ic('dinheiro', '', 'Caixa') + din(r.dinheiro) + '</span><span>' + ic('prestigio', '', 'Prestígio') + r.prestigio + '</span><span>' + ic('tradicao', '', 'Tradição') + r.tradicao + '</span><span>' + ic('missao', '', 'Missão') + E().totalConcluidos(estado) + ' de ' + m.objetivo + '</span></div></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="avancar" data-foco-inicial>' +
        (ultima ? ic('premio') + 'Ver resultado final' : ic('jogar') + 'Começar a rodada ' + (estado.rodada + 1)) + '</button></footer>',
    };
  }

  function linhaPessoa(estado, p, proj, op) {
    const marcado = op.marcado;
    const desab = op.desabilitado;
    const tags = [];
    if (!op.radio && E().ehEspecialista(p, proj)) tags.push(op.comDesconto ? '<span class="selo selo-bom">Especialista −' + din(OG.regras.DESCONTO_ESPECIALISTA) + '</span>' : '<span class="selo selo-bom">Especialista</span>');
    if (!op.radio && p.papel === 'coordenador') tags.push('<span class="selo selo-info" title="Só coordenadores fazem revisões. Quem está em projeto não revisa.">Coordenador</span>');
    if (p.somentePorEvento) tags.push('<span class="selo selo-alerta">Temporário</span>');
    return '<li><label class="opcao' + (marcado ? ' marcada' : '') + (desab ? ' desabilitada' : '') + '">' +
      '<input type="' + (op.radio ? 'radio' : 'checkbox') + '" name="' + (op.radio ? 'revisor' : 'equipe') + '" data-acao="' + op.acao + '" data-pessoa="' + p.id + '" data-foco="pessoa:' + p.id + '"' +
      (marcado ? ' checked' : '') + (desab ? ' disabled' : '') + '>' +
      C().avatar(p) +
      '<span class="opcao-texto"><strong>' + esc(p.nome) + '</strong><span>' + (op.detalhe ? esc(op.detalhe) + '. ' : '') + esc(op.radio ? p.cargo : p.papel === 'coordenador' ? p.cargo + '. ' + C().especialidadeTexto(p) : p.especialidade.rotulo) + '</span></span>' +
      '<span class="opcao-tags">' + tags.join('') + '</span></label></li>';
  }

  function ordenarVoluntariosPrimeiro(a, b) {
    if (a.papel !== b.papel) return a.papel === 'voluntario' ? -1 : 1;
    return a.nome.localeCompare(b.nome, 'pt-BR');
  }

  function modalEquipe(app) {
    const estado = app.estado;
    const m = app.ui.modal;
    const c = E().carta(estado, m.cartaId);
    if (!c) return null;
    const proj = E().projetoDaCarta(c);
    const completar = m.tipo === 'completar';
    const precisa = completar ? proj.trabalhadores - c.equipe.length : proj.trabalhadores;
    const restante = proj.tempo - c.progresso;
    const presentes = E().todasPessoas().filter(function (p) { return E().presente(estado, p.id); });
    const livres = presentes.filter(function (p) { return E().statusPessoa(estado, p.id).codigo === 'livre'; });
    const cabem = livres.filter(function (p) { return E().rodadasRestantes(estado, p.id) >= restante; });
    const especialistas = cabem.filter(function (p) { return E().ehEspecialista(p, proj); }).sort(ordenarVoluntariosPrimeiro);
    const outras = cabem.filter(function (p) { return !E().ehEspecialista(p, proj); }).sort(ordenarVoluntariosPrimeiro);
    const fora = presentes.filter(function (p) { return cabem.indexOf(p) === -1; });
    const sel = m.selecionados;
    const cheia = sel.length >= precisa;
    const comDesconto = !completar && c.custoPago === null;
    const linha = function (p) {
      const marcado = sel.indexOf(p.id) !== -1;
      return linhaPessoa(estado, p, proj, { marcado: marcado, desabilitado: !marcado && cheia, comDesconto: comDesconto, acao: 'alternar-pessoa' });
    };

    let validacao;
    if (completar) {
      validacao = sel.length === precisa ? { ok: true } : { ok: false, erro: 'Escolha ' + precisa + ' ' + plural(precisa, 'pessoa', 'pessoas') + '.' };
    } else {
      validacao = OG.motor.aplicar(estado, { tipo: 'INICIAR', cartaId: c.id, equipe: sel });
    }
    const custo = completar ? null : OG.financas.calcularCusto(estado, c, sel);
    const avisos = [];
    if (!completar && !E().terminaATempo(estado, c)) {
      avisos.push('<p class="caixa-alerta">' + ic('alerta') + '<span><strong>Não termina a tempo.</strong> Começando agora, este projeto não executa e revisa antes do fim da partida: o custo vira dinheiro parado.</span></p>');
    }
    const ev = estado.eventoAtual ? E().definicaoEvento(estado.eventoAtual.id) : null;
    if (!completar && ev && ev.quando === 'fim' && ev.risco && proj.riscos.indexOf(ev.risco) !== -1) {
      avisos.push('<p class="caixa-alerta">' + ic(ev.risco) + '<span><strong>' + esc(ev.nome) + '</strong> no fim desta rodada pode afetar este projeto.</span></p>');
    }
    const rotuloConfirmar = completar
      ? 'Adicionar à equipe'
      : custo.jaPago ? 'Retomar projeto' : 'Iniciar e pagar ' + din(custo.final);
    const sub = esc(OG.dados.categorias[proj.categoria].nome) + '. Precisa de ' + precisa + ' ' + plural(precisa, 'pessoa', 'pessoas') +
      (completar ? ' para completar a equipe' : '') + '. Escolhidas: ' + sel.length + ' de ' + precisa + '.';
    return {
      chave: m.tipo + ':' + c.id,
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho((completar ? 'Completar equipe: ' : (c.custoPago !== null ? 'Retomar: ' : 'Iniciar: ')) + proj.nome, sub, true, 'Cancelar') +
        '<div class="modal-corpo">' + avisos.join('') +
        (custo ? C().contaCusto(estado, custo) : '') +
        (especialistas.length ? '<div><h3 class="modal-sub" style="margin:0 0 6px;font-weight:700">Especialistas livres</h3><ul class="lista-opcoes">' + especialistas.map(linha).join('') + '</ul></div>' : '<p class="nota">Nenhum especialista livre nesta categoria agora.</p>') +
        (outras.length ? '<div><h3 class="modal-sub" style="margin:0 0 6px;font-weight:700">Outras pessoas livres</h3><ul class="lista-opcoes">' + outras.map(linha).join('') + '</ul></div>' : '') +
        (fora.length ? '<details class="indisponiveis"><summary>Indisponíveis agora (' + fora.length + ')</summary><ul>' + fora.map(function (p) {
          const st = E().statusPessoa(estado, p.id);
          const motivo = st.codigo === 'livre' ? 'só fica mais ' + E().rodadasRestantes(estado, p.id) + ' rodada, e o projeto precisa de ' + restante : st.texto.toLowerCase();
          return '<li><strong>' + esc(p.nome) + '</strong>: ' + esc(motivo) + '</li>';
        }).join('') + '</ul></details>' : '') +
        '</div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-secundario" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="button" class="botao botao-primario" data-acao="confirmar-equipe" data-foco="confirmar-equipe"' +
        (validacao.ok ? '' : ' aria-disabled="true" data-motivo="' + esc(validacao.erro) + '"') + '>' + ic(completar ? 'reforco' : 'jogar') + esc(rotuloConfirmar) + '</button></footer>',
    };
  }

  function modalRevisor(app) {
    const estado = app.estado;
    const m = app.ui.modal;
    const c = E().carta(estado, m.cartaId);
    if (!c) return null;
    const proj = E().projetoDaCarta(c);
    const coords = OG.dados.coordenadores.map(function (p) { return E().pessoa(p.id); });
    const lucro = proj.retorno - (c.custoPago || 0);
    const missao = E().missao(estado);
    const cumpre = !estado.missaoCumprida && E().totalConcluidos(estado) + 1 >= missao.objetivo;
    const lista = coords.map(function (p) {
      const st = E().statusPessoa(estado, p.id);
      const livre = st.codigo === 'livre';
      return linhaPessoa(estado, p, proj, {
        marcado: m.revisor === p.id, desabilitado: !livre, acao: 'escolher-revisor', radio: true,
        detalhe: livre ? null : st.texto,
      });
    }).join('');
    const ganhos = ['+' + din(proj.retorno) + ' de retorno (lucro do projeto: ' + din(lucro) + ')'];
    if (proj.prestigio) ganhos.push('+' + proj.prestigio + ' Prestígio');
    if (proj.tradicao) ganhos.push('+' + proj.tradicao + ' Tradição');
    const validacao = m.revisor
      ? OG.motor.aplicar(estado, { tipo: 'REVISAR', cartaId: c.id, revisorId: m.revisor })
      : { ok: false, erro: 'Escolha um coordenador.' };
    return {
      chave: 'revisor:' + c.id,
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Revisar: ' + proj.nome, 'Um coordenador livre confere o projeto. Quem revisa fica ocupado até o fim da rodada.', true, 'Cancelar') +
        '<div class="modal-corpo">' +
        '<p class="caixa-bom">' + ic('concluido') + '<span><strong>Ao concluir:</strong> ' + esc(OG.util.listaPt(ganhos)) + '.</span></p>' +
        (cumpre ? '<p class="caixa-bom">' + ic('missao') + '<span><strong>Isso cumpre a missão!</strong> Recompensa: ' + esc(textoRecompensa(missao.recompensa)) + '.</span></p>' : '') +
        '<ul class="lista-opcoes" role="radiogroup" aria-label="Coordenador que revisa">' + lista + '</ul></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-secundario" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="button" class="botao botao-primario" data-acao="confirmar-revisao" data-foco="confirmar-revisao"' +
        (validacao.ok ? '' : ' aria-disabled="true" data-motivo="' + esc(validacao.erro) + '"') + '>' + ic('revisar') + 'Concluir projeto</button></footer>',
    };
  }

  function modalDetalhe(app) {
    const estado = app.estado;
    const c = E().carta(estado, app.ui.modal.cartaId);
    if (!c) return null;
    const proj = E().projetoDaCarta(c);
    const cat = OG.dados.categorias[proj.categoria];
    const custoRef = c.custoPago !== null ? c.custoPago : proj.custo;
    const especialistas = E().todasPessoas().filter(function (p) { return E().ehEspecialista(p, proj); });
    const riscos = proj.riscos.length
      ? '<ul class="lista-simples">' + proj.riscos.map(function (r) {
        const d = OG.dados.riscos[r];
        return '<li>' + ic(r) + ' ' + esc(d.nome) + ': sofre com o evento “' + esc(d.evento) + '”.</li>';
      }).join('') + '</ul>'
      : '<p class="nota">Nenhum risco especial: nenhum evento de fim de rodada mira este projeto.</p>';
    const acoes = [C().acoesDaCarta(estado, c, true)];
    if (estado.fase === 'planejamento' && c.coluna === 'afazer' && c.custoPago === null) {
      acoes.push(C().botao('desplanejar', 'Voltar ao backlog', { carta: c.id, icone: 'voltar' }));
    }
    const situacao = {
      backlog: 'No Backlog: ainda não escolhido.',
      afazer: c.custoPago !== null ? 'Em A fazer, já pago: recomeça sem custo.' : 'Em A fazer: pronto para iniciar.',
      andamento: 'Em andamento: ' + c.progresso + ' de ' + proj.tempo + ' rodadas de execução.',
      revisao: 'Em Revisão: execução completa, falta um coordenador conferir.',
      concluido: 'Concluído na rodada ' + c.concluidoNaRodada + '.',
    }[c.coluna];
    const equipe = c.coluna === 'andamento' ? c.equipe : c.equipeFinal;
    return {
      chave: 'detalhe:' + c.id,
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho(proj.nome, ic(cat.icone) + ' ' + esc(cat.nome) + (proj.novo ? '. Card de apoio criado para completar a missão.' : ''), true) +
        '<div class="modal-corpo">' +
        '<p>' + esc(proj.descricao) + '</p>' +
        '<dl class="conta">' +
        '<dt>' + (c.custoPago !== null ? 'Custo pago' : 'Custo base (sem descontos)') + '</dt><dd>' + din(custoRef) + '</dd>' +
        '<dt>Retorno ao concluir</dt><dd>' + din(proj.retorno) + '</dd>' +
        '<dt class="total">Lucro se concluir</dt><dd>' + din(proj.retorno - custoRef) + '</dd>' +
        '<dt>Tempo de execução</dt><dd>' + proj.tempo + ' ' + plural(proj.tempo, 'rodada', 'rodadas') + '</dd>' +
        '<dt>Pessoas necessárias</dt><dd>' + proj.trabalhadores + '</dd>' +
        '<dt>Prestígio ao concluir</dt><dd>+' + proj.prestigio + '</dd>' +
        '<dt>Tradição ao concluir</dt><dd>+' + proj.tradicao + '</dd>' +
        '</dl>' +
        '<p class="caixa-info"><strong>Situação:</strong> ' + esc(situacao) +
        (equipe && equipe.length ? ' Equipe: ' + esc(OG.util.listaPt(equipe.map(function (id) { return E().pessoa(id).nome; }))) + '.' : '') + '</p>' +
        '<div><strong>Riscos</strong>' + riscos + '</div>' +
        '<div><strong>Especialistas (−' + din(OG.regras.DESCONTO_ESPECIALISTA) + ' cada)</strong><p class="nota">' + esc(OG.util.listaPt(especialistas.map(function (p) { return p.nome; }))) + '.</p></div>' +
        '</div>' +
        '<footer class="modal-rodape"><div class="card-acoes" style="margin-right:auto">' + acoes.join('') + '</div>' +
        '<button type="button" class="botao botao-secundario" data-acao="fechar-modal">Fechar</button></footer>',
    };
  }

  function modalMenu(app) {
    const emJogo = app.tela === 'jogo';
    return {
      chave: 'menu',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Menu', emJogo ? 'A partida fica salva neste navegador.' : '', true) +
        '<div class="modal-corpo"><div class="lista-opcoes">' +
        '<button type="button" class="opcao" data-acao="como-jogar">' + ic('ajuda') + '<span class="decisao-opcao"><strong>Como jogar</strong><span>Regras completas em 2 minutos.</span></span></button>' +
        '<button type="button" class="opcao" data-acao="configuracoes">' + ic('config') + '<span class="decisao-opcao"><strong>Configurações</strong><span>Caixa apertado e partida salva.</span></span></button>' +
        '<button type="button" class="opcao" data-acao="nova-partida">' + ic('reiniciar') + '<span class="decisao-opcao"><strong>Nova partida</strong><span>Escolher missão. A partida atual só é substituída quando você confirmar.</span></span></button>' +
        '<button type="button" class="opcao" data-acao="voltar-inicio">' + ic('inicio') + '<span class="decisao-opcao"><strong>Voltar ao início</strong><span>Você pode continuar depois de onde parou.</span></span></button>' +
        '</div></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="fechar-modal">Voltar ao jogo</button></footer>',
    };
  }

  function modalComoJogar() {
    const R = OG.regras;
    return {
      chave: 'como-jogar',
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Como jogar', 'Você é o Grêmio Estudantil do Mesquita. A missão: tirar um evento do papel em 4 rodadas.', true) +
        '<div class="modal-corpo">' +
        '<ol class="passos">' +
        '<li><span><strong>Leia o evento da rodada.</strong> Toda rodada começa com uma carta: imprevisto, boa notícia ou despesa. Ela vale para a rodada inteira, então dá para se preparar.</span></li>' +
        '<li><span><strong>Planeje.</strong> Arraste projetos do Backlog para A fazer (ou use o botão Planejar).</span></li>' +
        '<li><span><strong>Inicie.</strong> Leve o projeto para Em andamento, escolha a equipe e pague o custo. No máximo ' + R.LIMITE_EM_ANDAMENTO + ' projetos ao mesmo tempo: esse é o limite do Kanban.</span></li>' +
        '<li><span><strong>Encerre a rodada.</strong> Cada projeto em andamento ganha 1 rodada de progresso. Projeto de 1 rodada termina; de 2 rodadas, precisa de duas. Quem termina vai sozinho para Revisão.</span></li>' +
        '<li><span><strong>Revise.</strong> Na rodada seguinte, um coordenador livre confere o projeto e ele vai para Concluído. Só então entram o retorno, o prestígio e a tradição.</span></li>' +
        '<li><span><strong>Cumpra a missão.</strong> Conclua os projetos pedidos antes do fim da rodada ' + R.TOTAL_RODADAS + '. A recompensa entra na hora.</span></li>' +
        '</ol>' +
        '<div><strong>Dinheiro</strong><ul class="lista-simples">' +
        '<li>O custo é pago uma vez, ao iniciar. O retorno entra uma vez, ao concluir. Retorno não é lucro: lucro é retorno menos custo.</li>' +
        '<li>O Grêmio começa com ' + din(R.CAIXA_INICIAL) + ' e o caixa nunca fica negativo. Se faltar dinheiro para uma despesa obrigatória, o que faltar vira perda de prestígio (−1 a cada ' + din(R.REAIS_POR_PONTO_DE_DESGASTE) + ').</li>' +
        '<li>Especialista na categoria do projeto dá ' + din(R.DESCONTO_ESPECIALISTA) + ' de desconto por pessoa. Doações e materiais encontrados descontam o próximo projeto.</li>' +
        '</ul></div>' +
        '<div><strong>Equipe</strong><ul class="lista-simples">' +
        '<li>Cada pessoa trabalha em um projeto por vez. Só os 5 coordenadores revisam, e quem revisou fica ocupado até o fim da rodada.</li>' +
        '<li>Patrício é o coringa: só aparece com o evento “Patrício Ajudou” e fica 2 rodadas.</li>' +
        '</ul></div>' +
        '<div><strong>Tempo</strong><ul class="lista-simples">' +
        '<li>Projeto iniciado na última rodada não termina a tempo (precisa executar e ainda ser revisado). O jogo avisa.</li>' +
        '<li>Ícones nos cards mostram riscos: quadra, equipamento, fornecedor e mesas. Alguns eventos miram esses projetos.</li>' +
        '</ul></div>' +
        '<div><strong>Pontuação</strong><p class="nota">Caixa ÷ 10 + prestígio + tradição + 5 por projeto concluído. A classificação compara o que você conquistou com o melhor plano possível da missão: 100% ou mais é GRÊMIO LENDÁRIO; 80% DESTAQUE; 60% APROVADO; 40% SOBREVIVEU; abaixo disso, A DIREÇÃO QUER CONVERSAR.</p></div>' +
        '</div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="fechar-modal" data-foco-inicial>Entendi</button></footer>',
    };
  }

  function modalConfig(app) {
    const salvo = !!app.estado;
    return {
      chave: 'config',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Configurações', 'Valem para as próximas partidas.', true) +
        '<div class="modal-corpo">' +
        '<label class="interruptor"><input type="checkbox" data-acao="alternar-caixa-apertado" data-foco="cfg-caixa"' + (app.config.caixaApertado ? ' checked' : '') + '>' +
        '<span><strong>Caixa apertado</strong><span>Começar com ' + din(OG.regras.CAIXA_APERTADO) + ' em vez de ' + din(OG.regras.CAIXA_INICIAL) + '. O dinheiro passa a ser uma decisão de verdade: dá para ficar sem caixa no meio da partida.</span></span></label>' +
        '<div class="caixa-info">A partida é salva automaticamente neste navegador. ' + (salvo ? 'Há uma partida salva agora.' : 'Não há partida salva.') + '</div>' +
        (salvo ? '<button type="button" class="botao botao-secundario" data-acao="apagar-salvo">' + ic('reiniciar') + 'Apagar partida salva</button>' : '') +
        '</div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="fechar-modal" data-foco-inicial>Pronto</button></footer>',
    };
  }

  function modalConfirmar(app) {
    const c = app.ui.modal.confirmar;
    return {
      chave: 'confirmar:' + c.id,
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho(c.titulo, '', true) +
        '<div class="modal-corpo">' + c.html + '</div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-secundario" data-acao="fechar-modal" data-foco-inicial>' + esc(c.cancelar || 'Cancelar') + '</button>' +
        '<button type="button" class="botao ' + (c.perigo ? 'botao-perigo' : 'botao-primario') + '" data-acao="confirmar-acao">' + esc(c.rotulo) + '</button></footer>',
    };
  }

  OG.telas = {
    telaInicio,
    telaMissoes,
    telaJogo,
    telaFim,
    modalEvento,
    modalVerEvento,
    modalDecisao,
    modalResumo,
    modalEquipe,
    modalRevisor,
    modalDetalhe,
    modalMenu,
    modalComoJogar,
    modalConfig,
    modalConfirmar,
  };
})(globalThis);
