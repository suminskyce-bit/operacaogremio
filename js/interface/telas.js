/*
 * telas.js — telas (início, nova partida, jogo, fim) e o conteúdo das janelas modais.
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
  function R() { return OG.regras; }
  function plural(n, s, p) { return OG.util.plural(n, s, p); }
  function rodadas(n) { return n + ' ' + plural(n, 'rodada', 'rodadas'); }

  function marca(extra) {
    return '<span class="marca' + (extra ? ' ' + extra : '') + '" aria-hidden="true"><span class="marca-escola">Escola Técnica</span><span class="marca-mesquita">Mesquita</span></span>';
  }

  // ======================= Telas =======================

  function telaInicio(app) {
    const salvo = app.estado;
    const botoes = [];
    let detalheSalvo = '';
    if (salvo) {
      const n = E().totalRodadas(salvo);
      if (salvo.fase === 'fim') {
        botoes.push('<button type="button" class="botao botao-secundario botao-grande" data-acao="continuar" data-foco="continuar">' + ic('premio') + 'Ver o resultado da última partida</button>');
      } else {
        botoes.push('<button type="button" class="botao botao-primario botao-grande" data-acao="continuar" data-foco="continuar" data-foco-principal>' + ic('jogar') + 'Continuar partida</button>');
        detalheSalvo = '<p class="inicio-continuar">Partida salva: ' + esc(OG.regrasUtil.duracao(n).nome) + ' (' + n + ' rodadas), abertura ' +
          esc(E().missaoPorId(salvo.config.missaoId).nome) + ', rodada ' + salvo.rodada + ' de ' + n + '.</p>';
      }
    }
    const novaPrincipal = !salvo || salvo.fase === 'fim';
    botoes.push('<button type="button" class="botao ' + (novaPrincipal ? 'botao-primario' : 'botao-fantasma') + ' botao-grande" data-acao="jogar" data-foco="jogar"' + (novaPrincipal ? ' data-foco-principal' : '') + '>' +
      (novaPrincipal ? ic('jogar') : '') + (salvo && !novaPrincipal ? 'Nova partida' : 'Jogar') + '</button>');
    botoes.push('<button type="button" class="botao botao-fantasma botao-grande" data-acao="como-jogar" data-foco="como-jogar">' + ic('ajuda') + 'Como jogar</button>');
    botoes.push('<button type="button" class="botao botao-fantasma botao-grande" data-acao="configuracoes" data-foco="configuracoes">' + ic('config') + 'Configurações</button>');

    const membros = E().coordenadores().map(function (p) {
      return '<li class="inicio-membro">' + C().avatar(p) + '<span><span class="nome">' + esc(p.nome) + '</span><span class="cargo">' + esc(p.cargo) + '</span>' +
        '<span class="cargo area">' + esc(C().areaTexto(p)) + '</span></span></li>';
    }).join('');

    return '<main class="tela tela-inicio" id="conteudo">' +
      '<div class="inicio-cabeca">' + marca() + '</div>' +
      '<section class="inicio-heroi" aria-labelledby="titulo-jogo">' +
      '<h1 class="titulo-jogo" id="titulo-jogo"><span class="linha">Operação</span><span class="faixa">Grêmio</span><span class="visualmente-oculto"> — Mesquita</span></h1>' +
      '<p class="inicio-texto">Organize os eventos da escola num quadro Kanban. Todo card precisa de um coordenador responsável e de uma equipe: quem você coloca em cada projeto decide o que fica pronto dentro do prazo. Pedidos novos chegam a cada rodada. Partidas de 4, 8, 10 ou 26 rodadas.</p>' +
      '<div class="inicio-acoes">' + botoes.join('') + '</div>' + detalheSalvo +
      (app.config.caixaApertado ? '<p class="inicio-continuar">Configuração ativa: caixa apertado (novas partidas começam com ' + din(R().CAIXA_APERTADO) + ').</p>' : '') +
      '</section>' +
      '<section class="inicio-time" aria-labelledby="titulo-coordenacao"><h2 id="titulo-coordenacao">A coordenação do Grêmio</h2><ul class="inicio-equipe">' + membros + '</ul></section>' +
      '</main>';
  }

  function textoDuracao(d) {
    if (d.missoes === 1) {
      return 'Uma missão, aberta da rodada 1 à 4, e pedidos avulsos chegando a cada rodada. Boa para aprender.';
    }
    const outras = d.missoes - 1 === 1 ? 'Outra missão é sorteada e chega' : 'Outras ' + (d.missoes - 1) + ' missões são sorteadas e chegam';
    return 'A missão que você escolher abre na rodada 1. ' + outras + ' ao longo da partida; cada missão fica aberta por ' +
      R().JANELA_MISSAO + ' rodadas. Pedidos avulsos chegam todo começo de rodada.' + (d.rodadas >= 26 ? ' A partida fica salva: dá para parar e continuar depois.' : '');
  }

  function telaPreparar(app) {
    const dur = app.config.duracao;
    const info = OG.regrasUtil.duracao(dur);
    const caixa = app.config.caixaApertado ? R().CAIXA_APERTADO : R().CAIXA_INICIAL;
    const opcoes = R().DURACOES.map(function (d) {
      const marcada = d.rodadas === dur;
      return '<li><label class="opcao-duracao' + (marcada ? ' marcada' : '') + '">' +
        '<input type="radio" name="duracao" value="' + d.rodadas + '" data-acao="escolher-duracao" data-foco="duracao:' + d.rodadas + '"' + (marcada ? ' checked' : '') + '>' +
        '<span class="duracao-num">' + d.rodadas + '</span>' +
        '<span class="duracao-texto"><strong>' + esc(d.nome) + '</strong><span>' + d.rodadas + ' rodadas · ' + esc(d.tempo) + '</span>' +
        '<span>' + (d.missoes === 1 ? '1 missão' : d.missoes + ' missões ao longo do jogo') + '</span></span></label></li>';
    }).join('');

    const cartazes = OG.dados.missoes.map(function (m) {
      const projetos = m.projetos.map(function (id) {
        const p = OG.dados.projetosPorId[id];
        return '<li><span class="ponto-cat" style="--cat: var(--cat-' + p.categoria + ')" title="' + esc(OG.dados.categorias[p.categoria].nome) + '"></span>' +
          esc(p.nome) + (p.tempo > 1 ? '<span class="tempo-longo">2 rodadas</span>' : '') + '</li>';
      }).join('');
      return '<li class="cartaz-missao" style="--tema: ' + C().TEMAS[m.id] + '">' +
        '<div class="cartaz-faixa" style="background: ' + C().TEMAS[m.id] + '"></div>' +
        '<h3>' + esc(m.nome) + '</h3>' +
        '<p class="cartaz-desc">' + esc(m.descricao) + '</p>' +
        '<dl class="cartaz-dados">' +
        '<dt>Objetivo</dt><dd>Concluir ' + m.objetivo + ' dos 6 projetos dentro do prazo</dd>' +
        '<dt>Recompensa</dt><dd>' + esc(C().textoRecompensa(m.recompensa)) + '</dd>' +
        '</dl>' +
        '<ul class="cartaz-projetos" aria-label="Projetos da missão">' + projetos + '</ul>' +
        '<button type="button" class="botao botao-primario" data-acao="escolher-missao" data-missao="' + m.id + '" data-foco="missao:' + m.id + '">' +
        ic('jogar') + (info.missoes > 1 ? 'Abrir com ' : 'Jogar ') + esc(m.nome) + '</button>' +
        '</li>';
    }).join('');

    return '<main class="tela tela-missoes" id="conteudo">' +
      '<header class="barra-topo"><button type="button" class="botao botao-fantasma botao-pequeno" data-acao="voltar-inicio" data-foco="voltar-inicio">' + ic('voltar') + 'Início</button>' +
      '<h1>Nova partida</h1>' + marca() + '</header>' +
      '<section class="preparar-bloco" aria-labelledby="t-duracao">' +
      '<h2 id="t-duracao" data-foco-principal tabindex="-1">1. Quanto tempo de jogo?</h2>' +
      '<ul class="duracoes" role="radiogroup" aria-labelledby="t-duracao">' + opcoes + '</ul>' +
      '<p class="preparar-nota">' + esc(textoDuracao(info)) + '</p>' +
      '</section>' +
      '<section class="preparar-bloco" aria-labelledby="t-missao">' +
      '<h2 id="t-missao">2. ' + (info.missoes > 1 ? 'Com que missão o ano começa?' : 'Qual missão?') + '</h2>' +
      '<p class="preparar-nota">O Grêmio começa com ' + din(caixa) + ', 20 de prestígio e 20 de tradição. A meta é calculada para a sua partida: o planejador do jogo joga a mesma partida (mesma agenda e mesmos pedidos) sem imprevistos.</p>' +
      '</section>' +
      '<ul class="grade-missoes">' + cartazes + '</ul>' +
      '</main>';
  }

  function telaJogo(app) {
    const estado = app.estado;
    const colunas = R().COLUNAS;
    const aba = app.ui.abaMobile;
    const trocar = '<nav class="trocar-coluna" aria-label="Colunas do quadro">' + colunas.map(function (col) {
      const n = E().cartasNaColuna(estado, col.id).length;
      return '<button type="button" data-acao="coluna-mobile" data-coluna="' + col.id + '" aria-current="' + (app.ui.colunaMobile === col.id) + '" data-foco="colmob:' + col.id + '">' +
        C().NOMES_COLUNA[col.id] + ' ' + (col.id === 'andamento' ? n + '/5' : n) + '</button>';
    }).join('') + '</nav>';

    const podeEncerrar = estado.fase === 'planejamento';
    const rotuloNav = estado.fase === 'resumo' ? (E().ultimaRodada(estado) ? 'Ver resultado' : 'Próxima rodada') : 'Encerrar rodada';
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
      C().faixaCoordenacao(estado) +
      trocar +
      '<div class="jogo-corpo">' +
      '<main class="quadro" id="quadro" aria-label="Quadro Kanban" tabindex="-1">' +
      colunas.map(function (col) { return C().coluna(estado, col); }).join('') +
      '</main>' +
      '<aside class="lateral" aria-label="Equipe e diário do Grêmio">' + C().painelEquipe(estado) + C().painelDiario(estado, app.ui.aba) + '</aside>' +
      '</div>' + navCelular + '</div>';
  }

  /** Quanto cada pessoa trabalhou na partida (a partir dos cards). */
  function trabalhoPorPessoa(estado) {
    const t = {};
    E().todasPessoas().forEach(function (p) { t[p.id] = { tocou: 0, equipes: 0, revisou: 0 }; });
    estado.cartas.forEach(function (c) {
      if (c.iniciadoNaRodada !== null || c.coluna === 'concluido' || c.coluna === 'revisao') {
        if (c.responsavel && c.coluna !== 'afazer') t[c.responsavel].tocou++;
        (c.coluna === 'andamento' ? c.equipe : c.equipeFinal).forEach(function (id) { t[id].equipes++; });
      }
      if (c.revisor) t[c.revisor].revisou++;
    });
    return t;
  }

  function telaFim(app) {
    const estado = app.estado;
    const n = E().totalRodadas(estado);
    const info = OG.regrasUtil.duracao(n);
    const p = OG.pontuacao.calcular(estado);
    const f = OG.pontuacao.resumoFinanceiro(estado);
    const faixas = R().CLASSIFICACOES.filter(function (c) { return c.minimo > -Infinity; }).map(function (c) { return c.minimo; }).sort(function (a, b) { return a - b; });
    const escala = 120;
    const largura = Math.max(0, Math.min(p.aproveitamento, escala)) / escala * 100;
    const marcas = faixas.map(function (v) {
      return '<span class="marca-faixa" style="left:' + (v / escala * 100) + '%"></span>';
    }).join('');
    const nomesFaixa = { 50: 'Sobreviveu', 70: 'Aprovado', 85: 'Destaque', 100: 'Lendário' };

    const linhasPontos = p.itens.map(function (i) {
      return '<tr><td>' + esc(i.rotulo) + '</td><td class="conta-pts">' + esc(i.conta) + '</td><td>' + i.pontos + '</td></tr>';
    }).join('') + '<tr class="total"><td>Total</td><td></td><td>' + p.total + '</td></tr>';

    const missoes = p.missoes.map(function (m) {
      const classe = m.situacao === 'cumprida' ? 'selo-bom' : m.situacao === 'perdida' ? 'selo-ruim' : 'selo-info';
      const rotulo = m.situacao === 'cumprida' ? 'Cumprida' : m.situacao === 'perdida' ? 'Perdida' : 'Em aberto';
      return '<li><span class="missao-nome"><strong>' + esc(m.nome) + '</strong> <span class="nota">rodadas ' + m.abre + '–' + m.data + ' · ' +
        m.progresso + ' ' + plural(m.progresso, 'projeto', 'projetos') + ' no prazo (objetivo: ' + m.objetivo + ')</span></span>' +
        '<span class="selo ' + classe + '">' + rotulo + '</span></li>';
    }).join('');

    const vencidos = estado.arquivo.length;
    const abertos = estado.cartas.filter(function (c) { return c.coluna !== 'concluido'; });
    const pagosSemRetorno = abertos.filter(function (c) { return c.custoPago !== null; }).length;
    const resumoCards = '<ul class="numeros-fim">' +
      '<li><strong>' + p.entregues + '</strong><span>entregues no prazo</span></li>' +
      '<li><strong>' + p.atrasados + '</strong><span>entregues com atraso</span></li>' +
      '<li><strong>' + vencidos + '</strong><span>venceram sem começar</span></li>' +
      '<li><strong>' + pagosSemRetorno + '</strong><span>pagos e não concluídos</span></li></ul>';

    const trabalho = trabalhoPorPessoa(estado);
    const linhaPessoa = function (pessoa) {
      const t = trabalho[pessoa.id];
      let texto;
      if (pessoa.papel === 'coordenador') {
        texto = t.tocou || t.revisou ? 'tocou ' + t.tocou + ' · revisou ' + t.revisou : 'não trabalhou';
      } else {
        texto = t.equipes ? t.equipes + ' ' + plural(t.equipes, 'projeto', 'projetos') : (pessoa.somentePorEvento ? 'não apareceu' : 'não trabalhou');
      }
      const parado = !t.tocou && !t.revisou && !t.equipes && !pessoa.somentePorEvento;
      return '<li class="' + (parado ? 'parado' : '') + '">' + C().avatar(pessoa, 'avatar-mini') + '<span><strong>' + esc(pessoa.nome) + '</strong> ' + esc(texto) + '</span></li>';
    };
    const naoTrabalharam = E().todasPessoas().filter(function (x) {
      const t = trabalho[x.id];
      return !x.somentePorEvento && !t.tocou && !t.revisou && !t.equipes;
    });

    const licoes = [];
    licoes.push('Os projetos concluídos trouxeram ' + din(f.receitaProjetos) + ' de retorno, mas o lucro deles foi ' + din(f.lucroProjetosConcluidos) + ': retorno não é lucro.');
    if (f.investimentoParado > 0) licoes.push(din(f.investimentoParado) + ' ficaram parados em projetos pagos que não terminaram (ou venceram). Dinheiro investido sem retorno.');
    if (f.perdaPorAtraso > 0) licoes.push('Entregar com atraso custou ' + din(f.perdaPorAtraso) + ' de retorno que não entrou. Prazo também é dinheiro.');
    if (f.despesas > 0) licoes.push('Imprevistos custaram ' + din(f.despesas) + '. Guardar caixa ajuda a absorver o que ninguém planejou.');

    return '<main class="tela tela-fim" id="conteudo">' +
      '<header class="barra-topo" style="padding-left:0;padding-right:0"><h1>Fim de jogo</h1>' + marca() + '</header>' +
      '<section class="fim-destaque" aria-labelledby="classificacao">' +
      '<p class="fim-resumo">' + esc(info.nome) + ' · ' + n + ' rodadas · abertura ' + esc(E().missaoPorId(estado.config.missaoId).nome) + (estado.config.caixaApertado ? ' · caixa apertado' : '') + '</p>' +
      '<h2 id="classificacao" class="carimbo' + (p.classificacao === 'A DIREÇÃO QUER CONVERSAR' ? ' conversar' : '') + '" tabindex="-1" data-foco-principal>' + esc(p.classificacao) + '</h2>' +
      '<p class="fim-resumo">O Grêmio terminou com <strong>' + p.total + ' pontos</strong>. Descontando os ' + p.pontosIniciais + ' do começo, conquistou ' + p.conquistado +
      '. O planejador do jogo, jogando a mesma partida sem imprevistos, conquistaria ' + p.metaConquista + ': <strong>' + p.aproveitamento + '% de aproveitamento</strong>.</p>' +
      '<div class="aproveitamento" role="img" aria-label="Aproveitamento de ' + p.aproveitamento + '%">' +
      '<div class="aproveitamento-barra"><span class="valor" style="width:' + largura + '%"></span>' + marcas + '</div>' +
      '<div class="aproveitamento-legenda" aria-hidden="true"><span style="left:0">0%</span>' +
      faixas.map(function (v) {
        return '<span style="left:' + (v / escala * 100) + '%">' + v + '%<br>' + (nomesFaixa[v] || '') + '</span>';
      }).join('') + '</div>' +
      '</div></section>' +
      '<div class="fim-grade" style="margin-top:18px">' +
      '<section class="painel" aria-labelledby="t-pontos"><h2 id="t-pontos">' + ic('premio') + ' Pontuação</h2>' +
      '<table class="tabela-pontos" style="margin-top:8px"><caption class="visualmente-oculto">Cálculo da pontuação</caption><tbody>' + linhasPontos + '</tbody></table>' +
      '<p class="nota" style="margin-top:10px">Meta: ' + p.meta.total + ' pontos (' + p.meta.entregues + ' projetos no prazo, ' + p.meta.missoesCumpridas + ' ' + plural(p.meta.missoesCumpridas, 'missão', 'missões') + '). ' +
      'Pontos iniciais: ' + p.pontosIniciais + ' (caixa ÷ ' + R().REAIS_POR_PONTO + ' + prestígio + tradição do começo).</p></section>' +
      '<section class="painel" aria-labelledby="t-missao"><h2 id="t-missao">' + ic('missao') + ' Missões: ' + p.missoesCumpridas + ' de ' + p.missoes.length + '</h2>' +
      '<ul class="lista-missoes-fim">' + missoes + '</ul>' + resumoCards + '</section>' +
      '<section class="painel" aria-labelledby="t-gente"><h2 id="t-gente">' + ic('pessoas') + ' Quem fez o Grêmio acontecer</h2>' +
      (naoTrabalharam.length
        ? '<p class="caixa-alerta" style="margin-top:10px">' + ic('alerta') + '<span>' + esc(OG.util.listaPt(naoTrabalharam.map(function (x) { return x.nome; }))) + ' ' + plural(naoTrabalharam.length, 'ficou', 'ficaram') + ' sem trabalhar. Gente parada é capacidade desperdiçada.</span></p>'
        : '<p class="caixa-bom" style="margin-top:10px">' + ic('check') + '<span>Todo mundo trabalhou em pelo menos um projeto.</span></p>') +
      '<div class="gente-fim"><ul>' + E().coordenadores().map(linhaPessoa).join('') + '</ul><ul>' + E().voluntarios().map(linhaPessoa).join('') + '</ul></div></section>' +
      '<section class="painel" aria-labelledby="t-dinheiro"><h2 id="t-dinheiro">' + ic('financas') + ' Dinheiro do Grêmio</h2>' +
      '<dl class="resumo-financeiro" style="margin-top:10px">' +
      '<dt>Caixa inicial</dt><dd>' + din(f.caixaInicial) + '</dd>' +
      '<dt>Investido em projetos</dt><dd class="menos">' + din(-f.investido) + '</dd>' +
      '<dt>Retorno de projetos</dt><dd class="mais">' + OG.util.formatarDinheiroComSinal(f.receitaProjetos) + '</dd>' +
      '<dt>Patrocínios e recompensas</dt><dd class="mais">' + OG.util.formatarDinheiroComSinal(f.outrasReceitas) + '</dd>' +
      '<dt>Despesas inesperadas</dt><dd class="menos">' + din(-f.despesas) + '</dd>' +
      '<dt><strong>Caixa final</strong></dt><dd>' + din(f.caixaFinal) + '</dd></dl>' +
      '<ul class="lista-simples">' + licoes.map(function (l) { return '<li>' + esc(l) + '</li>'; }).join('') + '</ul>' +
      '</section></div>' +
      '<div class="fim-acoes">' +
      '<button type="button" class="botao botao-primario botao-grande" data-acao="jogar-de-novo" data-foco="jogar-de-novo">' + ic('reiniciar') + 'Jogar de novo (' + n + ' rodadas)</button>' +
      '<button type="button" class="botao botao-fantasma botao-grande" data-acao="outra-missao" data-foco="outra-missao">Escolher outra partida</button>' +
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
      aoDispensar: 'fechar-modal',
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

  function textoChegadas(estado) {
    const prox = estado.rodada + 1;
    const pedidos = estado.programacao.filter(function (e) { return e.rodada === prox && e.origem === 'pedido'; }).length;
    const abrem = estado.agenda.filter(function (a) { return a.abre === prox; }).map(function (a) { return E().missaoPorId(a.missaoId).nome; });
    const partes = [];
    if (abrem.length) partes.push('abre a missão ' + OG.util.listaPt(abrem) + ' (6 projetos)');
    if (pedidos) partes.push(pedidos + ' ' + plural(pedidos, 'pedido avulso', 'pedidos avulsos'));
    return partes.length ? 'Na rodada ' + prox + ': ' + partes.join(' e ') + '.' : '';
  }

  function modalResumo(app) {
    const estado = app.estado;
    const r = E().recursos(estado);
    const icones = { avancou: 'concluido', parado: 'parado', equipe: 'pessoas', evento: 'info', info: 'info', vencido: 'alerta', missao: 'missao' };
    const linhas = estado.resumo.linhas.map(function (l) {
      return '<li class="' + l.tipo + '">' + ic(icones[l.tipo] || 'info') + '<span>' + esc(l.texto) + '</span></li>';
    }).join('');
    const ultima = E().ultimaRodada(estado);
    const revisao = E().cartasNaColuna(estado, 'revisao').length;
    let aviso = '';
    if (ultima) {
      aviso = revisao ? '<p class="caixa-alerta">' + ic('alerta') + '<span>' + revisao + ' ' + plural(revisao, 'projeto terminou', 'projetos terminaram') + ' a execução agora, mas não há mais rodada para revisar. Não contam como concluídos.</span></p>' : '';
    } else {
      const chegadas = textoChegadas(estado);
      if (revisao) aviso += '<p class="caixa-info">Na próxima rodada, revise ' + (revisao === 1 ? 'o projeto' : 'os ' + revisao + ' projetos') + ' em Revisão para receber retorno e pontos.</p>';
      if (chegadas) aviso += '<p class="caixa-info">' + ic('info') + ' ' + esc(chegadas) + '</p>';
    }
    const abertas = E().missoesAbertas(estado).map(function (a) {
      const m = E().missaoPorId(a.missaoId);
      return '<span>' + ic('missao', '', 'Missão') + esc(m.nome) + ': ' + E().progressoMissao(estado, a.missaoId) + ' de ' + m.objetivo + '</span>';
    }).join('');
    return {
      chave: 'resumo:' + estado.rodada,
      dispensavel: true,
      aoDispensar: 'fechar-resumo',
      html: cabecalho('Fim da rodada ' + estado.rodada, ultima ? 'Essa foi a última rodada.' : 'Veja o que aconteceu antes da próxima carta de evento.', true, 'Ver o quadro') +
        '<div class="modal-corpo"><ul class="resumo-linhas">' + linhas + '</ul>' + aviso +
        '<div class="mini-recursos"><span>' + ic('dinheiro', '', 'Caixa') + din(r.dinheiro) + '</span><span>' + ic('prestigio', '', 'Prestígio') + r.prestigio + '</span><span>' + ic('tradicao', '', 'Tradição') + r.tradicao + '</span>' + abertas + '</div></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="avancar" data-foco-inicial>' +
        (ultima ? ic('premio') + 'Ver resultado final' : ic('jogar') + 'Começar a rodada ' + (estado.rodada + 1)) + '</button></footer>',
    };
  }

  // ---------- Quem vai tocar? (planejar / trocar responsável) ----------

  function modalResponsavel(app) {
    const estado = app.estado;
    const m = app.ui.modal;
    const c = E().carta(estado, m.cartaId);
    if (!c) return null;
    const proj = E().projetoDaCarta(c);
    const trocar = m.modo === 'trocar';
    const lista = OG.planejador.avaliarCoordenadores(estado, c);
    const linhas = lista.map(function (x) {
      const p = E().pessoa(x.coordId);
      const atual = trocar && x.coordId === c.responsavel;
      const desab = !!x.impedimento || atual;
      const marcado = m.escolhido === x.coordId;
      let status;
      if (x.status.codigo === 'tocando') {
        const t = E().carta(estado, x.status.cartaId);
        status = 'Tocando ' + E().projetoDaCarta(t).nome + ': fica livre na rodada ' + (estado.rodada + t.tempoTotal - t.progresso);
      } else if (x.status.codigo === 'doente') {
        status = 'Com influenza nesta rodada';
      } else {
        status = 'Livre agora';
      }
      if (x.fila) status += ' · ' + x.fila + ' em A fazer';
      const comeca = x.comecaEm === estado.rodada ? 'começa agora' : 'começa na rodada ' + x.comecaEm;
      const tags = [];
      tags.push(x.naArea ? '<span class="selo selo-info">Na área</span>' : '<span class="selo selo-alerta">Fora da área +1</span>');
      tags.push(x.noPrazo ? '<span class="selo selo-bom">' + ic('check') + 'Cabe no prazo</span>' : '<span class="selo selo-ruim">' + ic('alerta') + 'Passa do prazo</span>');
      return '<li><label class="opcao' + (marcado ? ' marcada' : '') + (desab ? ' desabilitada' : '') + '">' +
        '<input type="radio" name="responsavel" data-acao="escolher-responsavel" data-pessoa="' + p.id + '" data-foco="resp:' + p.id + '"' +
        (marcado ? ' checked' : '') + (desab ? ' disabled' : '') + '>' +
        C().avatar(p) +
        '<span class="opcao-texto"><strong>' + esc(p.nome) + (atual ? ' (responsável agora)' : '') + '</strong>' +
        '<span>' + esc(C().areaCurta(p)) + ' · executa em ' + rodadas(x.tempo) + ' · ' + esc(comeca) + ' · revisão na rodada ' + x.revisaoEm + '</span>' +
        '<span>' + esc(x.impedimento || status) + '</span></span>' +
        '<span class="opcao-tags">' + tags.join('') + '</span></label></li>';
    }).join('');

    let rodape;
    if (trocar) {
      const v = m.escolhido ? OG.motor.aplicar(estado, { tipo: 'TROCAR_RESPONSAVEL', cartaId: c.id, responsavel: m.escolhido }) : { ok: false, erro: 'Escolha um coordenador.' };
      rodape = '<button type="button" class="botao botao-secundario" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="button" class="botao botao-primario" data-acao="confirmar-responsavel" data-foco="confirmar-responsavel"' +
        (v.ok ? '' : ' aria-disabled="true" data-motivo="' + esc(v.erro) + '"') + '>' + ic('pessoa') + 'Trocar responsável</button>';
    } else {
      const v = m.escolhido ? OG.motor.aplicar(estado, { tipo: 'PLANEJAR', cartaId: c.id, responsavel: m.escolhido }) : { ok: false, erro: 'Escolha o coordenador responsável.' };
      let seguir = { ok: false, motivo: v.ok ? '' : v.erro };
      if (v.ok) seguir = OG.kanban.avaliarMovimento(v.estado, c.id, 'andamento');
      rodape = '<button type="button" class="botao botao-secundario" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="button" class="botao botao-secundario" data-acao="confirmar-responsavel" data-foco="confirmar-responsavel"' +
        (v.ok ? '' : ' aria-disabled="true" data-motivo="' + esc(v.erro) + '"') + '>Só planejar</button>' +
        '<button type="button" class="botao botao-primario" data-acao="confirmar-responsavel" data-seguir="equipe" data-foco="confirmar-responsavel-equipe"' +
        (seguir.ok ? '' : ' aria-disabled="true" data-motivo="' + esc(seguir.motivo || 'Indisponível agora.') + '"') + '>' + ic('reforco') + 'Planejar e montar equipe</button>';
    }
    return {
      chave: 'responsavel:' + c.id + ':' + (m.modo || 'planejar'),
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho((trocar ? 'Trocar responsável: ' : 'Quem vai tocar: ') + proj.nome,
        esc(OG.dados.categorias[proj.categoria].nome) + ' · ' + esc(C().textoArea(proj)) + ' · prazo: rodada ' + c.prazo + '. Fora da área o projeto leva +' + R().TEMPO_FORA_DA_AREA + ' rodada.', true, 'Cancelar') +
        '<div class="modal-corpo">' + C().farol(estado, c) +
        '<ul class="lista-opcoes" role="radiogroup" aria-label="Coordenador responsável">' + linhas + '</ul>' +
        '<p class="nota">O responsável trabalha no projeto (força 1) e toca um projeto por vez. Até ' + R().FILA_POR_COORDENADOR + ' cards em A fazer por coordenador.</p></div>' +
        '<footer class="modal-rodape">' + rodape + '</footer>',
    };
  }

  // ---------- Equipe (iniciar / completar) ----------

  function linhaVoluntario(estado, p, proj, op) {
    const marcado = op.marcado;
    const desab = op.desabilitado;
    const forca = E().forcaVoluntario(p.id, proj);
    const tags = [];
    if (E().ehEspecialista(p, proj)) tags.push('<span class="selo selo-bom">+2 especialista' + (op.comDesconto ? ' · −' + din(R().DESCONTO_ESPECIALISTA) : '') + '</span>');
    else tags.push('<span class="selo selo-info">+' + forca + '</span>');
    if (p.somentePorEvento) tags.push('<span class="selo selo-alerta">Temporário</span>');
    return '<li><label class="opcao' + (marcado ? ' marcada' : '') + (desab ? ' desabilitada' : '') + '">' +
      '<input type="checkbox" name="equipe" data-acao="alternar-pessoa" data-pessoa="' + p.id + '" data-foco="pessoa:' + p.id + '"' +
      (marcado ? ' checked' : '') + (desab ? ' disabled' : '') + '>' +
      C().avatar(p) +
      '<span class="opcao-texto"><strong>' + esc(p.nome) + '</strong><span>' + esc(p.especialidade.rotulo) + '</span></span>' +
      '<span class="opcao-tags">' + tags.join('') + '</span></label></li>';
  }

  function modalEquipe(app) {
    const estado = app.estado;
    const m = app.ui.modal;
    const c = E().carta(estado, m.cartaId);
    if (!c) return null;
    const proj = E().projetoDaCarta(c);
    const completar = m.tipo === 'completar';
    const coord = E().pessoa(c.responsavel);
    const precisa = E().forcaNecessaria(proj);
    const jaNaEquipe = completar ? c.equipe : [];
    const base = E().forcaDaEquipe(proj, true, jaNaEquipe);
    const sel = m.selecionados.filter(function (id) { return jaNaEquipe.indexOf(id) === -1; });
    const forca = base + sel.reduce(function (s, id) { return s + E().forcaVoluntario(id, proj); }, 0);
    const restante = OG.kanban.rodadasRestantesDoCard(c);
    const candidatos = OG.kanban.candidatos(estado, c);
    const ordenar = function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); };
    const especialistas = candidatos.filter(function (p) { return E().ehEspecialista(p, proj); }).sort(ordenar);
    const outros = candidatos.filter(function (p) { return !E().ehEspecialista(p, proj); }).sort(ordenar);
    const fora = E().voluntarios().filter(function (p) {
      return E().presente(estado, p.id) && candidatos.indexOf(p) === -1 && jaNaEquipe.indexOf(p.id) === -1;
    });
    const cheia = forca >= precisa;
    const comDesconto = !completar && c.custoPago === null;
    const linha = function (p) {
      const marcado = sel.indexOf(p.id) !== -1;
      return linhaVoluntario(estado, p, proj, { marcado: marcado, desabilitado: !marcado && cheia, comDesconto: comDesconto });
    };

    let validacao;
    if (completar) {
      let e = estado;
      validacao = { ok: true };
      for (let i = 0; i < sel.length && validacao.ok; i++) {
        const r = OG.motor.aplicar(e, { tipo: 'COMPLETAR_EQUIPE', cartaId: c.id, pessoaId: sel[i] });
        if (!r.ok) validacao = r;
        else e = r.estado;
      }
      if (validacao.ok && forca < precisa) validacao = { ok: false, erro: 'Ainda falta força: ' + forca + ' de ' + precisa + '.' };
      if (validacao.ok && !sel.length) validacao = { ok: false, erro: 'Escolha quem entra na equipe.' };
    } else {
      validacao = OG.motor.aplicar(estado, { tipo: 'INICIAR', cartaId: c.id, equipe: sel });
    }
    const custo = completar ? null : OG.financas.calcularCusto(estado, c, sel);
    const avisos = [];
    if (!completar && !E().terminaNoPrazo(estado, c)) {
      avisos.push(E().terminaAntesDoFim(estado, c)
        ? '<p class="caixa-alerta">' + ic('alerta') + '<span><strong>Passa do prazo.</strong> Começando agora, fica pronto para revisão depois da rodada ' + c.prazo + ': só metade do retorno, sem prestígio nem tradição.</span></p>'
        : '<p class="caixa-alerta">' + ic('alerta') + '<span><strong>Não termina a tempo.</strong> Começando agora, não executa e revisa antes do fim da partida: o custo vira dinheiro parado.</span></p>');
    }
    const ev = estado.eventoAtual ? E().definicaoEvento(estado.eventoAtual.id) : null;
    if (ev && ev.quando === 'fim' && ev.risco && proj.riscos.indexOf(ev.risco) !== -1) {
      avisos.push('<p class="caixa-alerta">' + ic(ev.risco) + '<span><strong>' + esc(ev.nome) + '</strong> no fim desta rodada pode afetar este projeto.</span></p>');
    }
    const rotuloConfirmar = completar ? 'Reforçar a equipe' : custo.jaPago ? 'Retomar projeto' : 'Iniciar e pagar ' + din(custo.final);
    const jaTem = completar && jaNaEquipe.length
      ? '<p class="nota">Já na equipe: ' + esc(OG.util.listaPt(jaNaEquipe.map(function (id) { return E().pessoa(id).nome; }))) + '.</p>'
      : '';
    return {
      chave: m.tipo + ':' + c.id,
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho((completar ? 'Completar equipe: ' : (c.custoPago !== null ? 'Retomar: ' : 'Iniciar: ')) + proj.nome,
        esc(OG.dados.categorias[proj.categoria].nome) + ' · responsável ' + esc(coord.nome) + ' (+1) · executa em ' + rodadas(restante) + '. Especialista na categoria soma 2; ninguém pode sobrar na equipe.', true, 'Cancelar') +
        '<div class="modal-corpo">' + avisos.join('') +
        C().medidorForca(forca, precisa, E().voluntariosSobrando(proj, jaNaEquipe.concat(sel)).filter(function (id) { return sel.indexOf(id) !== -1; }).length > 0) + jaTem +
        (custo ? C().contaCusto(estado, custo) : '') +
        (especialistas.length ? '<div><h3 class="modal-sub" style="margin:0 0 6px;font-weight:700">Especialistas livres (somam 2)</h3><ul class="lista-opcoes">' + especialistas.map(linha).join('') + '</ul></div>' : '<p class="nota">Nenhum especialista livre nesta categoria agora.</p>') +
        (outros.length ? '<div><h3 class="modal-sub" style="margin:0 0 6px;font-weight:700">Outros voluntários livres (somam 1)</h3><ul class="lista-opcoes">' + outros.map(linha).join('') + '</ul></div>' : '') +
        (fora.length ? '<details class="indisponiveis"><summary>Indisponíveis agora (' + fora.length + ')</summary><ul>' + fora.map(function (p) {
          const st = E().statusPessoa(estado, p.id);
          const motivo = st.codigo === 'livre' ? 'só fica mais ' + rodadas(E().rodadasRestantes(estado, p.id)) + ', e o projeto precisa de ' + restante : st.texto.toLowerCase();
          return '<li><strong>' + esc(p.nome) + '</strong>: ' + esc(motivo) + '</li>';
        }).join('') + '</ul></details>' : '') +
        '</div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-secundario" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="button" class="botao botao-secundario" data-acao="sugerir-equipe" data-foco="sugerir-equipe">' + ic('positivo') + 'Sugerir equipe enxuta</button>' +
        '<button type="button" class="botao botao-primario" data-acao="confirmar-equipe" data-foco="confirmar-equipe"' +
        (validacao.ok ? '' : ' aria-disabled="true" data-motivo="' + esc(validacao.erro) + '"') + '>' + ic(completar ? 'reforco' : 'jogar') + esc(rotuloConfirmar) + '</button></footer>',
    };
  }

  // ---------- Revisão ----------

  function modalRevisor(app) {
    const estado = app.estado;
    const m = app.ui.modal;
    const c = E().carta(estado, m.cartaId);
    if (!c) return null;
    const proj = E().projetoDaCarta(c);
    const noPrazo = estado.rodada <= c.prazo;
    const retorno = noPrazo ? proj.retorno : Math.floor(proj.retorno * R().FRACAO_RETORNO_ATRASADO);
    const lista = E().coordenadores().map(function (p) {
      const impedimento = E().impedimentoRevisor(estado, p.id, c);
      const parado = impedimento ? null : E().projetoParadoSeRevisar(estado, p.id);
      const marcado = m.revisor === p.id;
      const detalhe = impedimento || (parado ? 'Atenção: ' + E().projetoDaCarta(parado).nome + ' fica parado nesta rodada' : 'Revisa sem atrasar nada');
      return '<li><label class="opcao' + (marcado ? ' marcada' : '') + (impedimento ? ' desabilitada' : '') + '">' +
        '<input type="radio" name="revisor" data-acao="escolher-revisor" data-pessoa="' + p.id + '" data-foco="revisor:' + p.id + '"' +
        (marcado ? ' checked' : '') + (impedimento ? ' disabled' : '') + '>' +
        C().avatar(p) +
        '<span class="opcao-texto"><strong>' + esc(p.nome) + '</strong><span>' + esc(detalhe) + '</span></span>' +
        '<span class="opcao-tags">' + (parado ? '<span class="selo selo-alerta">' + ic('parado') + 'Para o próprio projeto</span>' : impedimento ? '' : '<span class="selo selo-bom">Sem custo</span>') + '</span></label></li>';
    }).join('');
    const ganhos = ['+' + din(retorno) + ' de retorno (lucro do projeto: ' + din(retorno - (c.custoPago || 0)) + ')'];
    if (noPrazo && proj.prestigio) ganhos.push('+' + proj.prestigio + ' Prestígio');
    if (noPrazo && proj.tradicao) ganhos.push('+' + proj.tradicao + ' Tradição');
    if (noPrazo) ganhos.push('+' + R().PONTOS_POR_PROJETO + ' pontos de projeto entregue no prazo');
    let missao = '';
    if (c.missaoId && noPrazo) {
      const a = E().entradaAgenda(estado, c.missaoId);
      const def = E().missaoPorId(c.missaoId);
      if (a && !a.cumprida && !a.perdida && E().progressoMissao(estado, c.missaoId) + 1 >= def.objetivo) {
        missao = '<p class="caixa-bom">' + ic('missao') + '<span><strong>Isso cumpre a missão ' + esc(def.nome) + '!</strong> Recompensa: ' + esc(C().textoRecompensa(def.recompensa)) + '.</span></p>';
      }
    }
    const validacao = m.revisor
      ? OG.motor.aplicar(estado, { tipo: 'REVISAR', cartaId: c.id, revisorId: m.revisor })
      : { ok: false, erro: 'Escolha um coordenador.' };
    return {
      chave: 'revisor:' + c.id,
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Revisar: ' + proj.nome, 'Outro coordenador confere o projeto (cada um revisa 1 por rodada). Quem estava livre no começo da rodada revisa sem custo.', true, 'Cancelar') +
        '<div class="modal-corpo">' +
        (noPrazo
          ? '<p class="caixa-bom">' + ic('concluido') + '<span><strong>Ao concluir:</strong> ' + esc(OG.util.listaPt(ganhos)) + '.</span></p>'
          : '<p class="caixa-alerta">' + ic('alerta') + '<span><strong>Depois do prazo (rodada ' + c.prazo + '):</strong> ' + esc(ganhos[0]) + ', sem prestígio nem tradição, e não conta para a missão.</span></p>') +
        missao +
        '<ul class="lista-opcoes" role="radiogroup" aria-label="Coordenador que revisa">' + lista + '</ul></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-secundario" data-acao="fechar-modal">Cancelar</button>' +
        '<button type="button" class="botao botao-primario" data-acao="confirmar-revisao" data-foco="confirmar-revisao"' +
        (validacao.ok ? '' : ' aria-disabled="true" data-motivo="' + esc(validacao.erro) + '"') + '>' + ic('revisar') + 'Concluir projeto</button></footer>',
    };
  }

  // ---------- Detalhes do card ----------

  function modalDetalhe(app) {
    const estado = app.estado;
    const c = E().carta(estado, app.ui.modal.cartaId);
    if (!c) return null;
    const proj = E().projetoDaCarta(c);
    const cat = OG.dados.categorias[proj.categoria];
    const custoRef = c.custoPago !== null ? c.custoPago : proj.custo;
    const especialistas = E().voluntarios().filter(function (p) { return E().ehEspecialista(p, proj); });
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
      backlog: 'No Backlog: ainda sem responsável.',
      afazer: c.custoPago !== null ? 'Em A fazer, já pago: recomeça sem custo.' : 'Em A fazer: pronto para iniciar.',
      andamento: 'Em andamento: ' + c.progresso + ' de ' + rodadas(c.tempoTotal || 0) + ' de execução.',
      revisao: 'Em Revisão: execução completa, falta outro coordenador conferir.',
      concluido: 'Concluído na rodada ' + c.concluidoNaRodada + (c.noPrazo ? ', no prazo.' : ', com atraso.'),
    }[c.coluna];
    const equipe = c.coluna === 'andamento' ? c.equipe : c.equipeFinal;
    const origem = c.origem === 'pedido'
      ? 'Pedido avulso: chegou na rodada ' + c.chegada + '. Não conta para nenhuma missão.'
      : 'Projeto da missão ' + E().missaoPorId(c.missaoId).nome + '.';
    const tempos = E().coordenadores().map(function (p) {
      const t = E().tempoComCoordenador(proj, p.id);
      return '<tr' + (c.responsavel === p.id ? ' class="atual"' : '') + '><td>' + esc(p.nome) + (c.responsavel === p.id ? ' (responsável)' : '') + '</td><td>' +
        (E().naArea(p.id, proj) ? 'na área' : 'fora da área') + '</td><td>' + rodadas(t) + '</td></tr>';
    }).join('');
    return {
      chave: 'detalhe:' + c.id,
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho(proj.nome, ic(cat.icone) + ' ' + esc(cat.nome) + ' · ' + esc(origem), true) +
        '<div class="modal-corpo">' +
        '<p>' + esc(proj.descricao) + '</p>' + C().farol(estado, c) +
        '<dl class="conta">' +
        '<dt>' + (c.custoPago !== null ? 'Custo pago' : 'Custo base (sem descontos)') + '</dt><dd>' + din(custoRef) + '</dd>' +
        '<dt>Retorno ao concluir no prazo</dt><dd>' + din(proj.retorno) + '</dd>' +
        '<dt class="total">Lucro se concluir no prazo</dt><dd>' + din(proj.retorno - custoRef) + '</dd>' +
        '<dt>Força necessária</dt><dd>' + E().forcaNecessaria(proj) + ' (tamanho ' + proj.trabalhadores + ' + 3)</dd>' +
        '<dt>Prestígio ao concluir no prazo</dt><dd>+' + proj.prestigio + '</dd>' +
        '<dt>Tradição ao concluir no prazo</dt><dd>+' + proj.tradicao + '</dd>' +
        '<dt>Prazo</dt><dd>rodada ' + c.prazo + '</dd>' +
        '</dl>' +
        '<div><strong>Tempo de execução com cada coordenador</strong><table class="tabela-tempos"><tbody>' + tempos + '</tbody></table></div>' +
        '<p class="caixa-info"><strong>Situação:</strong> ' + esc(situacao) +
        (c.responsavel ? ' Responsável: ' + esc(E().pessoa(c.responsavel).nome) + '.' : '') +
        (equipe && equipe.length ? ' Equipe: ' + esc(OG.util.listaPt(equipe.map(function (id) { return E().pessoa(id).nome; }))) + '.' : '') + '</p>' +
        '<div><strong>Riscos</strong>' + riscos + '</div>' +
        '<div><strong>Especialistas (somam 2 e dão −' + din(R().DESCONTO_ESPECIALISTA) + ' cada)</strong><p class="nota">' + esc(OG.util.listaPt(especialistas.map(function (p) { return p.nome; }))) + '.</p></div>' +
        '</div>' +
        '<footer class="modal-rodape"><div class="card-acoes" style="margin-right:auto">' + acoes.join('') + '</div>' +
        '<button type="button" class="botao botao-secundario" data-acao="fechar-modal">Fechar</button></footer>',
    };
  }

  // ---------- Agenda ----------

  function modalAgenda(app) {
    const estado = app.estado;
    const linhas = estado.agenda.map(function (a) {
      const m = E().missaoPorId(a.missaoId);
      const sit = E().situacaoMissao(estado, a);
      const rotulo = { aberta: 'Aberta', futura: 'Em breve', cumprida: 'Cumprida', perdida: 'Perdida' }[sit];
      const classe = { aberta: 'selo-alerta', futura: 'selo-info', cumprida: 'selo-bom', perdida: 'selo-ruim' }[sit];
      return '<tr><th scope="row">' + esc(m.nome) + '</th><td>' + a.abre + '–' + a.data + '</td><td>' +
        (sit === 'futura' ? '—' : E().progressoMissao(estado, a.missaoId) + ' de ' + m.objetivo) + '</td><td><span class="selo ' + classe + '">' + rotulo + '</span></td><td>' +
        esc(C().textoRecompensa(m.recompensa)) + '</td></tr>';
    }).join('');
    const futuros = estado.programacao.filter(function (e) { return e.origem === 'pedido'; }).length;
    return {
      chave: 'agenda',
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Agenda do Grêmio', 'Cada missão fica aberta por ' + R().JANELA_MISSAO + ' rodadas: os 6 projetos chegam na abertura e o prazo de todos é a última rodada da janela.', true) +
        '<div class="modal-corpo"><table class="tabela-agenda"><thead><tr><th scope="col">Missão</th><th scope="col">Rodadas</th><th scope="col">No prazo</th><th scope="col">Situação</th><th scope="col">Recompensa</th></tr></thead><tbody>' + linhas + '</tbody></table>' +
        '<p class="caixa-info">Pedidos avulsos: ' + R().PEDIDOS_POR_RODADA + ' chegam no começo de cada rodada (menos na última), com prazo curto. Ainda ' + plural(futuros, 'vai chegar 1', 'vão chegar ' + futuros) + ' nesta partida.</p></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="fechar-modal" data-foco-inicial>Voltar ao quadro</button></footer>',
    };
  }

  // ---------- Menu, regras, configurações, confirmação ----------

  function modalMenu(app) {
    const emJogo = app.tela === 'jogo';
    return {
      chave: 'menu',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Menu', emJogo ? 'A partida fica salva neste navegador.' : '', true) +
        '<div class="modal-corpo"><div class="lista-opcoes">' +
        '<button type="button" class="opcao" data-acao="como-jogar">' + ic('ajuda') + '<span class="decisao-opcao"><strong>Como jogar</strong><span>Regras completas em 3 minutos.</span></span></button>' +
        '<button type="button" class="opcao" data-acao="configuracoes">' + ic('config') + '<span class="decisao-opcao"><strong>Configurações</strong><span>Caixa apertado e partida salva.</span></span></button>' +
        '<button type="button" class="opcao" data-acao="nova-partida">' + ic('reiniciar') + '<span class="decisao-opcao"><strong>Nova partida</strong><span>Escolher duração e missão. A partida atual só é substituída quando você confirmar.</span></span></button>' +
        '<button type="button" class="opcao" data-acao="voltar-inicio">' + ic('inicio') + '<span class="decisao-opcao"><strong>Voltar ao início</strong><span>Você pode continuar depois de onde parou.</span></span></button>' +
        '</div></div>' +
        '<footer class="modal-rodape"><button type="button" class="botao botao-primario" data-acao="fechar-modal">Voltar ao jogo</button></footer>',
    };
  }

  function modalComoJogar() {
    const areas = E().coordenadores().map(function (p) {
      return '<li><strong>' + esc(p.nome) + '</strong> — ' + esc(p.cargo) + ': ' + esc(p.area.coringa ? 'Geral, nunca fica fora da área' : p.area.rotulo) + '</li>';
    }).join('');
    return {
      chave: 'como-jogar',
      classe: 'modal-largo',
      dispensavel: true,
      aoDispensar: 'fechar-modal',
      html: cabecalho('Como jogar', 'Você é o Grêmio Estudantil do Mesquita. O quadro Kanban é onde tudo acontece.', true) +
        '<div class="modal-corpo">' +
        '<ol class="passos">' +
        '<li><span><strong>Leia o evento da rodada.</strong> Toda rodada começa com uma carta: imprevisto, boa notícia ou despesa. Ela vale para a rodada inteira.</span></li>' +
        '<li><span><strong>Escolha o responsável (Planejar).</strong> Leve um card do Backlog para A fazer escolhendo o coordenador que vai tocar o projeto. Cada coordenador tem uma área: fora dela, o projeto leva +' + R().TEMPO_FORA_DA_AREA + ' rodada. Até ' + R().FILA_POR_COORDENADOR + ' cards em A fazer por coordenador.</span></li>' +
        '<li><span><strong>Monte a equipe e inicie.</strong> O responsável trabalha no projeto (força 1) e toca um projeto por vez. Complete a força do card (tamanho + 3) com voluntários: cada um soma 1; especialista na categoria soma 2 e dá ' + din(R().DESCONTO_ESPECIALISTA) + ' de desconto. Ninguém pode sobrar na equipe. Pague o custo.</span></li>' +
        '<li><span><strong>Encerre a rodada.</strong> Projetos com a força completa ganham 1 rodada de execução. Quem termina vai sozinho para Revisão e libera a equipe.</span></li>' +
        '<li><span><strong>Revise.</strong> Outro coordenador confere o projeto (ninguém revisa o próprio; cada um revisa 1 por rodada). Quem estava livre no começo da rodada revisa sem custo; quem está no meio de um projeto para, e o projeto dele não anda na rodada.</span></li>' +
        '<li><span><strong>Cuide dos prazos.</strong> O farol do card mostra a situação: <span class="farol farol-verde inline">verde</span> entregue no prazo, <span class="farol farol-amarelo inline">amarelo</span> no limite, <span class="farol farol-vermelho inline">vermelho</span> atrasado ou sem tempo. Card que não começa até o prazo sai do quadro. Entregue depois do prazo: metade do retorno, sem prestígio nem tradição.</span></li>' +
        '<li><span><strong>Cumpra as missões.</strong> Cada missão pede 4 dos 6 projetos dela concluídos no prazo. Pedidos avulsos chegam todo começo de rodada: escolha quais valem a pena.</span></li>' +
        '</ol>' +
        '<div><strong>Coordenação</strong><ul class="lista-simples">' + areas + '<li>Esporte e Games não têm coordenador da área: só o Sumindo toca esses sem atraso.</li></ul></div>' +
        '<div><strong>Dinheiro</strong><ul class="lista-simples">' +
        '<li>O custo é pago uma vez, ao iniciar. O retorno entra uma vez, ao concluir. Retorno não é lucro: lucro é retorno menos custo.</li>' +
        '<li>O Grêmio começa com ' + din(R().CAIXA_INICIAL) + ' e o caixa nunca fica negativo. Se faltar dinheiro para uma despesa obrigatória, o que faltar vira perda de prestígio (−1 a cada ' + din(R().REAIS_POR_PONTO_DE_DESGASTE) + ').</li>' +
        '</ul></div>' +
        '<div><strong>Pontuação</strong><p class="nota">Caixa ÷ 10 + prestígio + tradição + 5 por projeto entregue no prazo. A classificação compara o que você conquistou com o que o planejador do jogo conquistaria na mesma partida sem imprevistos: 100% ou mais é GRÊMIO LENDÁRIO; 85% DESTAQUE; 70% APROVADO; 50% SOBREVIVEU; abaixo disso, A DIREÇÃO QUER CONVERSAR.</p></div>' +
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
        '<span><strong>Caixa apertado</strong><span>Começar com ' + din(R().CAIXA_APERTADO) + ' em vez de ' + din(R().CAIXA_INICIAL) + '. O dinheiro passa a ser uma decisão de verdade: dá para ficar sem caixa no meio da partida.</span></span></label>' +
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
    telaPreparar,
    telaJogo,
    telaFim,
    modalEvento,
    modalVerEvento,
    modalDecisao,
    modalResumo,
    modalResponsavel,
    modalEquipe,
    modalRevisor,
    modalDetalhe,
    modalAgenda,
    modalMenu,
    modalComoJogar,
    modalConfig,
    modalConfirmar,
  };
})(globalThis);
