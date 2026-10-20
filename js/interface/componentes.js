/*
 * componentes.js — pedaços da interface gerados a partir do estado do jogo.
 * Nada aqui decide regra: botões e avisos consultam o núcleo (OG.kanban, OG.estado...).
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function esc(v) { return OG.ui.esc(v); }
  function ic(nome, classe, rotulo) { return OG.icones.icone(nome, classe, rotulo); }
  function din(v) { return OG.util.formatarDinheiro(v); }
  function E() { return OG.estado; }

  const NOMES_COLUNA = {
    backlog: 'Backlog',
    afazer: 'A fazer',
    andamento: 'Em andamento',
    revisao: 'Revisão',
    concluido: 'Concluído',
  };

  const COLUNA_VAZIA = {
    backlog: 'Todos os projetos da missão já saíram daqui.',
    afazer: 'Planeje: traga projetos do Backlog para cá.',
    andamento: 'Nenhum projeto rodando. Inicie até 2 a partir de A fazer.',
    revisao: 'Projetos que terminam a execução chegam aqui no fim da rodada.',
    concluido: 'Nada concluído ainda. Retorno e pontos entram aqui.',
  };

  const TIPOS_EVENTO = {
    negativo: { rotulo: 'Imprevisto', icone: 'negativo' },
    positivo: { rotulo: 'Boa notícia', icone: 'positivo' },
    despesa: { rotulo: 'Despesa', icone: 'despesa' },
  };

  const QUANDO_EVENTO = {
    agora: 'Vale agora, ao confirmar.',
    rodada: 'Vale durante toda esta rodada.',
    fim: 'É resolvido quando você encerrar a rodada.',
  };

  function plural(n, s, p) { return OG.util.plural(n, s, p); }

  // ---------------- Pessoas ----------------

  function iniciais(nome) {
    const partes = nome.split(/\s+/);
    if (partes.length === 1) return nome.length <= 3 ? nome.toUpperCase() : nome[0].toUpperCase();
    return partes.map(function (s) { return s[0]; }).join('').slice(0, 2).toUpperCase();
  }

  function avatar(p, classe) {
    if (p.foto) {
      return '<img class="avatar ' + (classe || '') + '" src="' + esc(p.foto) + '" alt="" width="40" height="40" loading="lazy">';
    }
    const e = p.especialidade || {};
    const cat = e.coringa ? 'coringa' : (e.categorias || [])[0] || '';
    return '<span class="avatar avatar-iniciais ' + (classe || '') + '" data-cat="' + cat + '" aria-hidden="true">' + esc(iniciais(p.nome)) + '</span>';
  }

  const ROTULO_STATUS = { livre: 'Livre', ocupado: 'Em projeto', revisando: 'Revisou', doente: 'Doente', ausente: 'Fora' };

  function especialidadeTexto(p) {
    return p.especialidade.coringa ? 'Coringa: especialista em tudo' : 'Especialista: ' + p.especialidade.rotulo;
  }

  function pessoaItem(estado, p) {
    const st = E().statusPessoa(estado, p.id);
    const linhas = [];
    if (p.papel === 'coordenador') linhas.push(p.cargo);
    linhas.push(p.papel === 'coordenador' ? especialidadeTexto(p) : p.especialidade.rotulo);
    if (st.codigo === 'ocupado' || st.codigo === 'revisando' || st.codigo === 'doente') linhas.push(st.texto);
    if (p.somentePorEvento) {
      const t = E().registroTemporario(estado, p.id);
      linhas.push(t ? 'Temporário até o fim da rodada ' + Math.min(t.ateRodada, OG.regras.TOTAL_RODADAS) : 'Aparece com o evento “Patrício Ajudou”');
    }
    return '<li class="pessoa ' + (st.codigo === 'ausente' ? 'ausente' : '') + '">' +
      avatar(p) +
      '<div class="pessoa-texto"><span class="pessoa-nome">' + esc(p.nome) + '</span>' +
      linhas.map(function (l) { return '<span class="pessoa-papel">' + esc(l) + '</span>'; }).join('') +
      '</div><span class="status status-' + st.codigo + '">' + ROTULO_STATUS[st.codigo] + '</span></li>';
  }

  function painelEquipe(estado) {
    const coords = OG.dados.coordenadores.map(function (p) { return E().pessoa(p.id); });
    const vols = OG.dados.voluntarios.map(function (p) { return E().pessoa(p.id); });
    const todas = coords.concat(vols).filter(function (p) { return E().presente(estado, p.id); });
    const livres = todas.filter(function (p) { return E().statusPessoa(estado, p.id).codigo === 'livre'; }).length;
    return '<section class="painel painel-equipe" aria-labelledby="titulo-equipe">' +
      '<button class="botao botao-secundario botao-pequeno fechar-lateral" data-acao="fechar-lateral">' + ic('fechar') + ' Fechar</button>' +
      '<h2 id="titulo-equipe">' + ic('pessoas') + ' Equipe</h2>' +
      '<p class="equipe-resumo">' + livres + ' de ' + todas.length + ' pessoas livres agora. Especialista na categoria do projeto dá R$ 10,00 de desconto.</p>' +
      '<h3>Coordenação (só eles revisam)</h3><ul class="lista-pessoas">' + coords.map(function (p) { return pessoaItem(estado, p); }).join('') + '</ul>' +
      '<h3>Voluntários</h3><ul class="lista-pessoas lista-voluntarios">' + vols.map(function (p) { return pessoaItem(estado, p); }).join('') + '</ul>' +
      '</section>';
  }

  // ---------------- Cards ----------------

  function botao(acao, rotulo, op) {
    op = op || {};
    const classes = 'botao botao-pequeno ' + (op.primario ? 'botao-primario' : 'botao-secundario');
    const motivo = op.motivo ? ' aria-disabled="true" data-motivo="' + esc(op.motivo) + '" title="' + esc(op.motivo) + '"' : '';
    return '<button type="button" class="' + classes + '" data-acao="' + acao + '"' +
      (op.carta ? ' data-carta="' + esc(op.carta) + '"' : '') +
      ' data-foco="' + acao + ':' + esc(op.carta || '') + '"' + motivo + '>' +
      (op.icone ? ic(op.icone) : '') + '<span>' + esc(rotulo) + '</span></button>';
  }

  function selo(tipo, icone, texto, dica) {
    return '<span class="selo selo-' + tipo + '"' + (dica ? ' title="' + esc(dica) + '"' : '') + '>' + ic(icone) + esc(texto) + '</span>';
  }

  function selosDaCarta(estado, c) {
    const p = E().projetoDaCarta(c);
    const s = [];
    const planejando = estado.fase === 'planejamento';
    const bloqueio = c.coluna !== 'concluido' ? E().bloqueioDaCarta(estado, c) : null;
    if (bloqueio) s.push(selo('ruim', 'parado', 'Parado nesta rodada', bloqueio));
    if ((c.coluna === 'backlog' || c.coluna === 'afazer') && !E().terminaATempo(estado, c) && estado.fase !== 'fim') {
      s.push(selo('alerta', 'alerta', 'Não termina a tempo', 'Começando agora, não dá tempo de executar e revisar antes do fim da partida: o custo vira dinheiro parado.'));
    }
    if (c.coluna === 'afazer' && c.custoPago !== null) {
      s.push(selo('bom', 'check', 'Já pago', 'Voltou por causa de um evento: recomeça sem cobrar o custo de novo.'));
    }
    if (c.coluna === 'andamento' && c.equipe.length < p.trabalhadores) {
      const falta = p.trabalhadores - c.equipe.length;
      s.push(selo('ruim', 'reforco', 'Falta ' + falta + ' ' + plural(falta, 'pessoa', 'pessoas'), 'Sem a equipe completa o projeto não avança no fim da rodada.'));
    }
    const ev = planejando && estado.eventoAtual ? E().definicaoEvento(estado.eventoAtual.id) : null;
    if (ev && ev.quando === 'fim' && c.coluna !== 'revisao' && c.coluna !== 'concluido') {
      if (ev.risco && p.riscos.indexOf(ev.risco) !== -1) {
        s.push(selo('alerta', ev.risco, 'Risco no fim da rodada', ev.nome + ': ' + ev.efeito));
      } else if (ev.id === 'ev_reuniao' && c.coluna === 'andamento') {
        s.push(selo('alerta', 'alerta', 'Pode parar na reunião', ev.efeito));
      }
    }
    if (c.coluna === 'revisao' && planejando && estado.rodada === OG.regras.TOTAL_RODADAS) {
      s.push(selo('alerta', 'alerta', 'Última chance de revisar', 'Na última rodada, projeto que não for revisado não conta.'));
    }
    return s.length ? '<div class="card-selos">' + s.join('') + '</div>' : '';
  }

  /** Botões de ação do card. `soBotoes` devolve só os botões, sem o contêiner. */
  function acoesDaCarta(estado, c, soBotoes) {
    if (estado.fase !== 'planejamento') return '';
    const p = E().projetoDaCarta(c);
    const b = [];
    if (c.coluna === 'backlog') {
      const av = OG.kanban.avaliarMovimento(estado, c.id, 'afazer');
      b.push(botao('planejar', 'Planejar', { carta: c.id, motivo: av.ok ? null : av.motivo, icone: 'direita' }));
    } else if (c.coluna === 'afazer') {
      const av = OG.kanban.avaliarMovimento(estado, c.id, 'andamento');
      b.push(botao('abrir-iniciar', c.custoPago !== null ? 'Retomar' : 'Iniciar', { carta: c.id, motivo: av.ok ? null : av.motivo, icone: 'jogar', primario: true }));
    } else if (c.coluna === 'andamento') {
      if (c.equipe.length < p.trabalhadores) {
        const livres = OG.kanban.candidatos(estado, c).length;
        b.push(botao('abrir-completar', 'Completar equipe', { carta: c.id, primario: true, icone: 'reforco', motivo: livres ? null : 'Ninguém livre que possa ficar até o fim deste projeto.' }));
      }
      if (OG.kanban.mutiraoDisponivel(estado)) {
        b.push(botao('mutirao', 'Usar Mutirão', { carta: c.id, icone: 'mutirao', primario: true, motivo: E().bloqueioDaCarta(estado, c) }));
      }
    } else if (c.coluna === 'revisao') {
      const av = OG.kanban.avaliarMovimento(estado, c.id, 'concluido');
      b.push(botao('abrir-revisar', 'Revisar', { carta: c.id, motivo: av.ok ? null : av.motivo, icone: 'revisar', primario: true }));
    }
    if (soBotoes) return b.join('');
    return b.length ? '<div class="card-acoes">' + b.join('') + '</div>' : '';
  }

  function progressoDaCarta(estado, c) {
    const p = E().projetoDaCarta(c);
    if (c.coluna === 'backlog' || c.coluna === 'afazer') return '';
    let texto = '';
    if (c.coluna === 'andamento') {
      const restante = p.tempo - c.progresso;
      texto = 'Execução: ' + c.progresso + ' de ' + p.tempo + ' ' + plural(p.tempo, 'rodada', 'rodadas');
      if (estado.fase === 'planejamento' && !E().bloqueioDaCarta(estado, c) && c.equipe.length >= p.trabalhadores) {
        texto += restante === 1 ? '. Termina no fim desta rodada.' : '. Falta ' + restante + ' rodadas.';
      }
    } else if (c.coluna === 'revisao') {
      texto = 'Execução completa. Falta a revisão.';
    } else {
      const rev = E().pessoa(c.revisor);
      texto = 'Revisado por ' + (rev ? rev.nome : '?') + ' na rodada ' + c.concluidoNaRodada + '.';
    }
    let seg = '';
    for (let i = 0; i < p.tempo; i++) seg += '<span class="' + (i < c.progresso ? 'feito' : '') + '"></span>';
    return '<div class="card-progresso"><div class="segmentos" aria-hidden="true">' + seg + '</div><span>' + esc(texto) + '</span></div>';
  }

  function equipeDaCarta(c) {
    const ids = c.coluna === 'andamento' ? c.equipe : [];
    if (!ids.length) return '';
    const pessoas = ids.map(function (id) { return E().pessoa(id); });
    return '<div class="card-equipe">' + pessoas.map(function (p) { return avatar(p); }).join('') +
      '<span>' + esc(OG.util.listaPt(pessoas.map(function (p) { return p.nome; }))) + '</span></div>';
  }

  function numero(classe, rotulo, icone, valor, zero) {
    return '<div class="' + classe + (zero ? ' zero' : '') + '"><dt>' + (icone ? ic(icone, '', rotulo) : esc(rotulo)) + '</dt><dd>' + valor + '</dd></div>';
  }

  function card(estado, c) {
    const p = E().projetoDaCarta(c);
    const cat = OG.dados.categorias[p.categoria];
    const arrastavel = estado.fase === 'planejamento' && (c.coluna === 'backlog' || c.coluna === 'afazer' || c.coluna === 'revisao');
    const congelado = c.coluna !== 'concluido' && !!E().bloqueioDaCarta(estado, c);
    const classes = ['card', 'card-cat-' + p.categoria];
    if (c.coluna === 'concluido') classes.push('concluido');
    if (congelado) classes.push('congelado');
    const riscos = p.riscos.map(function (r) {
      const def = OG.dados.riscos[r];
      return '<span title="' + esc(def.nome + ' (evento: ' + def.evento + ')') + '">' + ic(r, '', def.nome) + '</span>';
    }).join('');
    const custoTexto = c.custoPago !== null ? din(c.custoPago) : din(p.custo);
    return '<article class="' + classes.join(' ') + '" data-carta="' + esc(c.id) + '"' +
      (arrastavel ? ' draggable="true"' : '') + ' aria-labelledby="titulo-' + esc(c.id) + '">' +
      '<div class="card-topo"><span class="card-categoria">' + ic(cat.icone) + esc(cat.nome) + '</span>' +
      (riscos ? '<span class="card-riscos">' + riscos + '</span>' : '') + '</div>' +
      '<h3 class="card-titulo" id="titulo-' + esc(c.id) + '"><button type="button" data-acao="detalhes" data-carta="' + esc(c.id) + '" data-foco="detalhes:' + esc(c.id) + '">' + esc(p.nome) + '</button></h3>' +
      '<dl class="card-dinheiro">' +
      '<div><dt>' + (c.custoPago !== null ? 'Custo pago' : 'Custo') + '</dt><dd>' + custoTexto + '</dd></div>' +
      '<div><dt>Retorno</dt><dd>' + din(p.retorno) + '</dd></div>' +
      '</dl>' +
      '<dl class="card-numeros">' +
      numero('', 'Tempo', 'tempo', p.tempo + ' ' + plural(p.tempo, 'rodada', 'rodadas')) +
      numero('', 'Pessoas', 'pessoas', p.trabalhadores + ' ' + plural(p.trabalhadores, 'pessoa', 'pessoas')) +
      '</dl><dl class="card-numeros">' +
      numero('prestigio', 'Prestígio', 'prestigio', '+' + p.prestigio, !p.prestigio) +
      numero('tradicao', 'Tradição', 'tradicao', '+' + p.tradicao, !p.tradicao) +
      '</dl>' +
      progressoDaCarta(estado, c) +
      equipeDaCarta(c) +
      selosDaCarta(estado, c) +
      acoesDaCarta(estado, c) +
      '</article>';
  }

  function coluna(estado, def) {
    const cartas = E().cartasNaColuna(estado, def.id);
    const limite = def.limite;
    const cheia = limite && cartas.length >= limite;
    const contagem = limite ? cartas.length + '/' + limite : String(cartas.length);
    const rotuloContagem = limite
      ? cartas.length + ' de ' + limite + ' vagas ocupadas'
      : cartas.length + ' ' + plural(cartas.length, 'card', 'cards');
    return '<section class="coluna coluna-' + def.id + '" data-coluna="' + def.id + '" id="coluna-' + def.id + '" aria-labelledby="col-' + def.id + '">' +
      '<header class="coluna-cabeca"><h2 id="col-' + def.id + '">' + NOMES_COLUNA[def.id] + '</h2>' +
      '<span class="coluna-contagem' + (cheia ? ' cheia' : '') + '" aria-label="' + rotuloContagem + '">' + contagem + '</span></header>' +
      '<p class="coluna-dica-soltar" data-dica-soltar></p>' +
      '<ol class="coluna-cards">' +
      (cartas.length
        ? cartas.map(function (c) { return '<li>' + card(estado, c) + '</li>'; }).join('')
        : '<li class="coluna-vazia">' + COLUNA_VAZIA[def.id] + '</li>') +
      '</ol></section>';
  }

  // ---------------- HUD ----------------

  function chipsDoTopo(estado) {
    const chips = [];
    const ev = estado.eventoAtual ? E().definicaoEvento(estado.eventoAtual.id) : null;
    if (ev && estado.fase !== 'fim') {
      chips.push('<button type="button" class="chip chip-evento ' + ev.tipo + '" data-acao="ver-evento" data-foco="ver-evento">' +
        ic(TIPOS_EVENTO[ev.tipo].icone) + 'Evento: ' + esc(ev.nome) + '</button>');
    }
    estado.descontosPendentes.forEach(function (d) {
      const texto = d.tipo === 'percentual' ? d.valor + '% de desconto' : din(d.valor) + ' de desconto';
      chips.push('<span class="chip chip-bonus" title="Vale para o próximo projeto iniciado">' + ic('positivo') + esc(texto) + ' no próximo projeto</span>');
    });
    return chips.join('');
  }

  function hud(estado) {
    const R = OG.regras;
    const m = E().missao(estado);
    const r = E().recursos(estado);
    const concluidos = E().totalConcluidos(estado);
    let pips = '';
    for (let i = 1; i <= R.TOTAL_RODADAS; i++) {
      const terminou = i < estado.rodada || (i === estado.rodada && (estado.fase === 'resumo' || estado.fase === 'fim'));
      pips += '<span class="pip' + (terminou ? ' feita' : i === estado.rodada ? ' atual' : '') + '"></span>';
    }
    const pct = Math.min(100, Math.round((concluidos / m.objetivo) * 100));
    const podeEncerrar = estado.fase === 'planejamento';
    let encerrar;
    if (estado.fase === 'resumo') {
      const ultima = estado.rodada >= R.TOTAL_RODADAS;
      encerrar = '<button type="button" class="botao botao-primario so-largo" data-acao="avancar" data-foco="encerrar">' +
        ic(ultima ? 'premio' : 'jogar') + '<span>' + (ultima ? 'Ver resultado final' : 'Começar a rodada ' + (estado.rodada + 1)) + '</span></button>';
    } else {
      encerrar = '<button type="button" class="botao botao-primario so-largo" data-acao="encerrar-rodada" data-foco="encerrar"' +
        (podeEncerrar ? '' : ' aria-disabled="true" data-motivo="' + esc(OG.kanban.mensagemFase(estado)) + '"') + '>' +
        ic('rodada') + '<span>Encerrar rodada ' + estado.rodada + '</span></button>';
    }
    return '<header class="hud">' +
      '<div class="hud-marca"><span class="marca" aria-hidden="true"><span class="marca-escola">Escola</span><span class="marca-mesquita">Mesquita</span></span>' +
      '<div><div class="hud-titulo">' + esc(m.nome) + '</div>' +
      (estado.caixaApertado ? '<div class="hud-modo">Modo caixa apertado</div>' : '') + '</div></div>' +
      '<div class="hud-rodada" role="group" aria-label="Rodada ' + estado.rodada + ' de ' + R.TOTAL_RODADAS + '"><span class="numero" aria-hidden="true">' + estado.rodada + '<small>/' + R.TOTAL_RODADAS + '</small></span>' +
      '<span aria-hidden="true"><span class="rotulo">Rodada</span><span class="pips">' + pips + '</span></span></div>' +
      '<dl class="hud-recursos">' +
      '<div class="recurso recurso-caixa" data-recurso="dinheiro"><dt>' + ic('dinheiro') + '<span>Caixa</span></dt><dd>' + din(r.dinheiro) + '</dd></div>' +
      '<div class="recurso recurso-prestigio" data-recurso="prestigio"><dt>' + ic('prestigio') + '<span>Prestígio</span></dt><dd>' + r.prestigio + '</dd></div>' +
      '<div class="recurso recurso-tradicao" data-recurso="tradicao"><dt>' + ic('tradicao') + '<span>Tradição</span></dt><dd>' + r.tradicao + '</dd></div>' +
      '</dl>' +
      '<div class="hud-acoes">' + encerrar +
      '<button type="button" class="botao botao-fantasma botao-icone botao-equipe-lateral" data-acao="abrir-lateral" data-foco="abrir-lateral" aria-label="Abrir equipe e diário">' + ic('pessoas') + '</button>' +
      '<button type="button" class="botao botao-fantasma botao-icone" data-acao="menu" data-foco="menu" aria-label="Menu do jogo">' + ic('menu') + '</button>' +
      '</div>' +
      '<div class="hud-missao' + (estado.missaoCumprida ? ' cumprida' : '') + '">' + ic('missao') +
      '<span>' + (estado.missaoCumprida
        ? '<strong>Missão cumprida!</strong> ' + concluidos + ' projetos concluídos.'
        : 'Missão: <strong>' + concluidos + ' de ' + m.objetivo + '</strong> projetos concluídos') + '</span>' +
      '<span class="barra-missao" aria-hidden="true"><span style="width:' + pct + '%"></span></span></div>' +
      '<div class="hud-evento">' + chipsDoTopo(estado) + '</div>' +
      '</header>';
  }

  /** Lembrete da regra do evento que vale nesta rodada. */
  function faixaEvento(estado) {
    if (estado.fase !== 'planejamento' || !estado.eventoAtual) return '';
    const ev = E().definicaoEvento(estado.eventoAtual.id);
    let situacao = '';
    const nomeCarta = function (id) { return E().projetoDaCarta(E().carta(estado, id)).nome; };
    switch (ev.id) {
      case 'ev_chimarrao': {
        const ini = OG.kanban.iniciadosNaRodada(estado);
        situacao = ini.length ? 'Já começou: ' + nomeCarta(ini[0].id) + '. Mais nenhum início nesta rodada.' : 'Nenhum projeto começou ainda nesta rodada.';
        break;
      }
      case 'ev_provas': {
        const m = estado.cartasMovidasNaRodada;
        situacao = m.length ? 'Card movimentado: ' + nomeCarta(m[0]) + '. Só ele pode continuar andando.' : 'Nenhum card movimentado ainda. Escolha bem.';
        break;
      }
      case 'ev_impressora':
      case 'ev_quadra': {
        const afetados = estado.cartas.filter(function (c) { return c.coluna !== 'concluido' && E().bloqueioDaCarta(estado, c); });
        situacao = afetados.length ? 'Parados: ' + OG.util.listaPt(afetados.map(function (c) { return E().projetoDaCarta(c).nome; })) + '.' : 'Nenhum projeto seu é afetado.';
        break;
      }
      case 'ev_mutirao':
        situacao = OG.kanban.mutiraoDisponivel(estado) ? 'Use o botão “Usar Mutirão” em um card de Em andamento.' : 'Mutirão já usado.';
        break;
      case 'ev_influenza': {
        const alvo = estado.eventoAtual.alvo;
        situacao = alvo ? E().pessoa(alvo).nome + ' está com influenza e volta na próxima rodada.' : 'Ninguém ficou doente.';
        break;
      }
      case 'ev_patricio':
        situacao = 'Patrício está na equipe como temporário.';
        break;
      default:
        if (ev.quando === 'fim') {
          const emRisco = E().cartasNaColuna(estado, 'andamento').filter(function (c) {
            return !ev.risco || E().projetoDaCarta(c).riscos.indexOf(ev.risco) !== -1;
          });
          situacao = emRisco.length
            ? 'Em risco agora: ' + OG.util.listaPt(emRisco.map(function (c) { return E().projetoDaCarta(c).nome; })) + '.'
            : 'Nenhum projeto em andamento é afetado agora.';
        } else {
          return '';
        }
    }
    return '<div class="faixa-evento ' + ev.tipo + '" role="note">' + ic(TIPOS_EVENTO[ev.tipo].icone) +
      '<div><strong>' + esc(ev.nome) + ':</strong> ' + esc(ev.efeito) + '<span class="estado-regra">' + esc(situacao) + '</span></div></div>';
  }

  // ---------------- Diário: histórico, finanças, regras ----------------

  function historico(estado) {
    const porRodada = {};
    estado.historico.forEach(function (h) { (porRodada[h.rodada] = porRodada[h.rodada] || []).push(h); });
    const rodadas = Object.keys(porRodada).map(Number).sort(function (a, b) { return b - a; });
    if (!rodadas.length) return '<p class="nota">Ainda não aconteceu nada.</p>';
    return rodadas.map(function (r) {
      return '<div class="historico-rodada"><h4>Rodada ' + r + '</h4><ul>' +
        porRodada[r].slice().reverse().map(function (h) {
          return '<li class="' + esc(h.tipo) + '">' + esc(h.texto) + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  function financas(estado) {
    const f = OG.pontuacao.resumoFinanceiro(estado);
    let saldo = 0;
    const linhas = estado.livro.filter(function (l) { return l.recurso === 'dinheiro'; }).map(function (l) {
      saldo += l.valor;
      return { l: l, saldo: saldo };
    }).reverse();
    return '<dl class="resumo-financeiro">' +
      '<dt>Caixa inicial</dt><dd>' + din(f.caixaInicial) + '</dd>' +
      '<dt>Investido em projetos</dt><dd class="menos">' + din(-f.investido) + '</dd>' +
      '<dt>Retorno de projetos</dt><dd class="mais">' + OG.util.formatarDinheiroComSinal(f.receitaProjetos) + '</dd>' +
      '<dt>Patrocínios e recompensas</dt><dd class="mais">' + OG.util.formatarDinheiroComSinal(f.outrasReceitas) + '</dd>' +
      '<dt>Despesas inesperadas</dt><dd class="menos">' + din(-f.despesas) + '</dd>' +
      '<dt><strong>Caixa agora</strong></dt><dd>' + din(f.caixaFinal) + '</dd>' +
      '</dl>' +
      '<table class="tabela-financas"><caption class="visualmente-oculto">Lançamentos do caixa, do mais recente ao mais antigo</caption>' +
      '<thead><tr><th scope="col">Rod.</th><th scope="col">O quê</th><th scope="col" style="text-align:right">Valor</th><th scope="col" style="text-align:right">Saldo</th></tr></thead><tbody>' +
      linhas.map(function (x) {
        return '<tr><td>' + x.l.rodada + '</td><td>' + esc(x.l.descricao) + '</td><td class="valor ' + (x.l.valor >= 0 ? 'mais' : 'menos') + '">' +
          OG.util.formatarDinheiroComSinal(x.l.valor) + '</td><td class="saldo">' + din(x.saldo) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="nota" style="margin-top:8px">Retorno é tudo o que entrou de um projeto. Lucro é o retorno menos o custo.</p>';
  }

  function regrasResumo() {
    return '<ol class="regras-lista">' +
      '<li>Cada rodada começa com um evento. Ele vale para a rodada inteira.</li>' +
      '<li>Planeje: leve projetos do Backlog para A fazer.</li>' +
      '<li>Inicie: monte a equipe e pague o custo. No máximo 2 projetos em andamento.</li>' +
      '<li>Encerre a rodada: projetos em andamento ganham 1 rodada de progresso. Quem completar vai para Revisão.</li>' +
      '<li>Revise: um coordenador livre confere e o projeto vai para Concluído. Só aí entram retorno, prestígio e tradição.</li>' +
      '</ol>' +
      '<ul class="lista-simples" style="margin-top:12px">' +
      '<li>Especialista na categoria do projeto: R$ 10,00 de desconto por pessoa.</li>' +
      '<li>Quem revisa fica ocupado até o fim da rodada.</li>' +
      '<li>Projeto iniciado na última rodada não termina a tempo.</li>' +
      '<li>O caixa nunca fica negativo. Despesa sem dinheiro vira perda de prestígio.</li>' +
      '<li>Pontos: caixa ÷ 10 + prestígio + tradição + 5 por projeto concluído.</li>' +
      '</ul>';
  }

  function painelDiario(estado, aba) {
    const abas = [
      { id: 'historico', rotulo: 'Histórico', icone: 'historico' },
      { id: 'financas', rotulo: 'Finanças', icone: 'financas' },
      { id: 'regras', rotulo: 'Regras', icone: 'regras' },
    ];
    const conteudo = aba === 'financas' ? financas(estado) : aba === 'regras' ? regrasResumo() : historico(estado);
    return '<section class="painel painel-diario" aria-label="Diário do Grêmio">' +
      '<div class="abas" role="tablist" aria-label="Diário do Grêmio">' +
      abas.map(function (a) {
        return '<button type="button" class="aba" role="tab" id="aba-' + a.id + '" aria-controls="painel-aba" aria-selected="' + (aba === a.id) + '" data-acao="aba" data-aba="' + a.id + '" data-foco="aba:' + a.id + '" tabindex="' + (aba === a.id ? '0' : '-1') + '">' +
          ic(a.icone) + a.rotulo + '</button>';
      }).join('') + '</div>' +
      '<div class="aba-painel" role="tabpanel" id="painel-aba" aria-labelledby="aba-' + aba + '">' + conteudo + '</div></section>';
  }

  // ---------------- Evento ----------------

  function cartaEvento(estado, idTitulo) {
    const ev = estado.eventoAtual;
    const def = E().definicaoEvento(ev.id);
    const tipo = TIPOS_EVENTO[def.tipo];
    let extra = '';
    if (ev.id === 'ev_influenza') {
      const p = ev.alvo ? E().pessoa(ev.alvo) : null;
      extra = '<p class="caixa-info">' + (p ? '<strong>Quem pegou:</strong> ' + esc(p.nome) + ' (' + esc(p.papel === 'coordenador' ? p.cargo : p.especialidade.rotulo) + ').' : 'Ninguém estava livre para ficar doente.') + '</p>';
    }
    return '<div class="carta-evento ' + def.tipo + '">' +
      '<div class="carta-evento-tipo"><span>' + ic(tipo.icone) + ' ' + tipo.rotulo + '</span><span>Rodada ' + ev.rodada + ' de ' + OG.regras.TOTAL_RODADAS + '</span></div>' +
      '<div class="carta-evento-corpo">' +
      '<h3 id="' + (idTitulo || 'modal-titulo') + '">' + esc(def.nome) + '</h3>' +
      '<blockquote>“' + esc(def.texto) + '”</blockquote>' +
      '<p class="efeito">' + esc(def.efeito) + '</p>' + extra +
      '<p class="quando">' + ic('tempo') + QUANDO_EVENTO[def.quando] + '</p>' +
      '</div></div>';
  }

  // ---------------- Custo ----------------

  function contaCusto(estado, custo) {
    const caixa = OG.financas.caixa(estado);
    if (custo.jaPago) {
      return '<p class="caixa-bom">' + ic('check') + '<span>O custo deste projeto já foi pago antes. Retomar não cobra nada.</span></p>';
    }
    return '<dl class="conta">' +
      '<dt>Custo base</dt><dd>' + din(custo.base) + '</dd>' +
      custo.itens.map(function (i) { return '<dt class="desconto">' + esc(i.rotulo) + '</dt><dd class="desconto">' + din(i.valor) + '</dd>'; }).join('') +
      '<dt class="total">Total a pagar</dt><dd>' + din(custo.final) + '</dd>' +
      '<dt>Caixa agora</dt><dd>' + din(caixa) + '</dd>' +
      '<dt>Caixa depois</dt><dd class="' + (caixa - custo.final < 0 ? 'menos' : '') + '">' + din(caixa - custo.final) + '</dd>' +
      '</dl>';
  }

  OG.componentes = {
    NOMES_COLUNA,
    TIPOS_EVENTO,
    avatar,
    especialidadeTexto,
    painelEquipe,
    card,
    acoesDaCarta,
    coluna,
    hud,
    faixaEvento,
    painelDiario,
    regrasResumo,
    cartaEvento,
    contaCusto,
    botao,
  };
})(globalThis);
