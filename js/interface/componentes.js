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
  function R() { return OG.regras; }
  function plural(n, s, p) { return OG.util.plural(n, s, p); }
  function rodadas(n) { return n + ' ' + plural(n, 'rodada', 'rodadas'); }

  const NOMES_COLUNA = {
    backlog: 'Backlog',
    afazer: 'A fazer',
    andamento: 'Em andamento',
    revisao: 'Revisão',
    concluido: 'Concluído',
  };

  const COLUNA_VAZIA = {
    backlog: 'Nada esperando. Pedidos novos chegam no começo de cada rodada.',
    afazer: 'Planeje: escolha um card do Backlog e quem vai ser o responsável.',
    andamento: 'Nenhum projeto rodando. Cada coordenador toca um por vez.',
    revisao: 'Projetos que terminam a execução chegam aqui no fim da rodada.',
    concluido: 'Nada concluído ainda. Retorno e pontos entram aqui.',
  };

  const TIPOS_EVENTO = {
    negativo: { rotulo: 'Imprevisto', icone: 'negativo' },
    positivo: { rotulo: 'Boa notícia', icone: 'positivo' },
    despesa: { rotulo: 'Despesa', icone: 'despesa' },
    neutro: { rotulo: 'Semana tranquila', icone: 'info' },
  };

  const QUANDO_EVENTO = {
    agora: 'Vale agora, ao confirmar.',
    rodada: 'Vale durante toda esta rodada.',
    fim: 'É resolvido quando você encerrar a rodada.',
  };

  // Cor de cada missão (a Farroupilha leva as cores da bandeira do RS).
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
  // Cor da etiqueta de cada missão (texto branco com contraste AA: 4,5:1 ou mais).
  const COR_MISSAO = {
    farroupilha: '#17703f', junina: '#9a5200', halloween: '#a64800', gamer: '#6a3fc9', liga: '#23793a',
    cultural: '#b8325a', profissoes: '#1f6fb2', talentos: '#a8137f', estudante: '#7a5c00', concolor: '#0a7068',
  };

  function textoRecompensa(rec) {
    const partes = [];
    if (rec.dinheiro) partes.push('+' + din(rec.dinheiro));
    if (rec.prestigio) partes.push('+' + rec.prestigio + ' Prestígio');
    if (rec.tradicao) partes.push('+' + rec.tradicao + ' Tradição');
    return OG.util.listaPt(partes);
  }

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
    let cat = '';
    if (p.papel === 'coordenador') cat = p.area.coringa ? 'coringa' : p.area.categorias[0];
    else cat = p.especialidade.coringa ? 'coringa' : (p.especialidade.categorias || [])[0] || '';
    return '<span class="avatar avatar-iniciais ' + (classe || '') + '" data-cat="' + cat + '" aria-hidden="true">' + esc(iniciais(p.nome)) + '</span>';
  }

  /** "Área: Cultura" / "Geral: nunca fica fora da área" */
  function areaTexto(p) {
    return p.area.coringa ? 'Geral: nunca fica fora da área' : 'Área: ' + p.area.rotulo;
  }

  function areaCurta(p) {
    return p.area.coringa ? 'Geral (coringa)' : p.area.rotulo;
  }

  function especialidadeTexto(p) {
    return p.especialidade.coringa ? 'Coringa: especialista em tudo' : 'Especialista: ' + p.especialidade.rotulo;
  }

  /** Coordenadores da área do projeto (Sumindo por último, porque serve para tudo). */
  function coordenadoresDaArea(proj) {
    const lista = E().coordenadores().filter(function (p) { return E().naArea(p.id, proj); });
    return lista.sort(function (a, b) { return (a.area.coringa ? 1 : 0) - (b.area.coringa ? 1 : 0); });
  }

  function textoArea(proj) {
    const nomes = coordenadoresDaArea(proj).filter(function (p) { return !p.area.coringa; }).map(function (p) { return p.nome; });
    return nomes.length ? 'Área de ' + OG.util.listaPt(nomes) + ' (e Sumindo)' : 'Na área só de Sumindo, o Geral';
  }

  function textoAreaCurto(proj) {
    const nomes = coordenadoresDaArea(proj).filter(function (p) { return !p.area.coringa; }).map(function (p) { return p.nome; });
    return nomes.length ? 'Área: ' + OG.util.listaPt(nomes) : 'Área: só Sumindo';
  }

  const ROTULO_STATUS = { livre: 'Livre', ocupado: 'Em equipe', tocando: 'Tocando', doente: 'Doente', ausente: 'Fora' };

  function pessoaItem(estado, p) {
    const st = E().statusPessoa(estado, p.id);
    const linhas = [];
    if (p.papel === 'coordenador') {
      linhas.push(p.cargo);
      linhas.push(areaTexto(p));
    } else {
      linhas.push(p.especialidade.rotulo);
    }
    if (st.codigo === 'ocupado' || st.codigo === 'tocando' || st.codigo === 'doente') linhas.push(st.texto);
    if (p.papel === 'coordenador') {
      const fila = E().filaDe(estado, p.id).length;
      if (fila) linhas.push(fila + ' ' + plural(fila, 'card', 'cards') + ' em A fazer');
    }
    if (p.somentePorEvento) {
      const t = E().registroTemporario(estado, p.id);
      linhas.push(t ? 'Temporário até o fim da rodada ' + Math.min(t.ateRodada, E().totalRodadas(estado)) : 'Aparece com o evento “Patrício Ajudou”');
    }
    const revisou = p.papel === 'coordenador' && E().revisouNestaRodada(estado, p.id);
    return '<li class="pessoa ' + (st.codigo === 'ausente' ? 'ausente' : '') + '">' +
      avatar(p) +
      '<div class="pessoa-texto"><span class="pessoa-nome">' + esc(p.nome) + '</span>' +
      linhas.map(function (l) { return '<span class="pessoa-papel">' + esc(l) + '</span>'; }).join('') +
      '</div><span class="pessoa-status"><span class="status status-' + st.codigo + '">' + ROTULO_STATUS[st.codigo] + '</span>' +
      (revisou ? '<span class="status status-revisando">Revisou</span>' : '') + '</span></li>';
  }

  function painelEquipe(estado) {
    const coords = E().coordenadores();
    const vols = E().voluntarios();
    const presentes = vols.filter(function (p) { return E().presente(estado, p.id); });
    const livres = presentes.filter(function (p) { return E().statusPessoa(estado, p.id).codigo === 'livre'; }).length;
    const coordLivres = E().coordenadoresLivres(estado).length;
    return '<section class="painel painel-equipe" aria-labelledby="titulo-equipe">' +
      '<button class="botao botao-secundario botao-pequeno fechar-lateral" data-acao="fechar-lateral">' + ic('fechar') + ' Fechar</button>' +
      '<h2 id="titulo-equipe">' + ic('pessoas') + ' Equipe</h2>' +
      '<p class="equipe-resumo">' + coordLivres + ' de 5 coordenadores e ' + livres + ' de ' + presentes.length + ' voluntários livres agora.</p>' +
      '<h3>Coordenação: tocam os projetos e revisam</h3><ul class="lista-pessoas">' + coords.map(function (p) { return pessoaItem(estado, p); }).join('') + '</ul>' +
      '<h3>Voluntários: força das equipes (especialista vale 2)</h3><ul class="lista-pessoas lista-voluntarios">' + vols.map(function (p) { return pessoaItem(estado, p); }).join('') + '</ul>' +
      '</section>';
  }

  // ---------------- Coordenação (faixa acima do quadro) ----------------

  function faixaCoordenacao(estado) {
    const itens = E().coordenadores().map(function (p) {
      const st = E().statusPessoa(estado, p.id);
      const fila = E().filaDe(estado, p.id).length;
      const revisou = E().revisouNestaRodada(estado, p.id);
      let status = 'Livre';
      let detalhe = fila ? 'pode começar agora' : 'sem projeto';
      if (st.codigo === 'tocando') {
        const c = E().carta(estado, st.cartaId);
        status = 'Tocando';
        detalhe = E().projetoDaCarta(c).nome + ' (' + c.progresso + '/' + c.tempoTotal + ')';
      } else if (st.codigo === 'doente') {
        status = 'Doente';
        detalhe = 'com influenza nesta rodada';
      }
      return '<li class="coord coord-' + st.codigo + '">' + avatar(p) +
        '<div class="coord-texto"><span class="coord-nome">' + esc(p.nome) + ' <span class="coord-area">' + esc(areaCurta(p)) + '</span></span>' +
        '<span class="coord-detalhe"><span class="status status-' + st.codigo + '">' + status + '</span> ' + esc(detalhe) + '</span>' +
        '<span class="coord-extra"><span title="Cards em A fazer com este responsável (máximo ' + R().FILA_POR_COORDENADOR + ')">A fazer: ' + fila + '/' + R().FILA_POR_COORDENADOR + '</span>' +
        (revisou ? '<span class="status status-revisando">Já revisou</span>' : '') + '</span></div></li>';
    }).join('');
    return '<section class="coordenacao" aria-labelledby="titulo-coordenacao-jogo">' +
      '<h2 id="titulo-coordenacao-jogo" class="visualmente-oculto">Coordenação: quem está livre</h2>' +
      '<ul class="coordenacao-lista">' + itens + '</ul></section>';
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

  const DICA_ATRASO = 'Entregue depois do prazo: só metade do retorno, sem prestígio nem tradição, e não conta para a missão.';

  /**
   * Farol do prazo, como as datas dos quadros Kanban de verdade:
   * verde = entregue no prazo, amarelo = no limite, vermelho = atrasado ou sem tempo.
   */
  function farol(estado, c) {
    const f = E().farolDoPrazo(estado, c);
    const prazo = 'rodada ' + c.prazo;
    const naoIniciado = c.coluna === 'backlog' || c.coluna === 'afazer';
    let classe;
    let icone;
    let texto;
    let dica;
    switch (f) {
      case 'entregue':
        classe = 'verde'; icone = 'check'; texto = 'Entregue no prazo'; dica = 'Concluído até a ' + prazo + '.';
        break;
      case 'tarde':
        classe = 'cinza'; icone = 'tempo'; texto = 'Entregue com atraso'; dica = DICA_ATRASO;
        break;
      case 'atrasado':
        classe = 'vermelho'; icone = 'alerta';
        texto = estado.rodada > c.prazo ? 'Atrasado: prazo era a ' + prazo : 'Vai passar do prazo (' + prazo + ')';
        dica = DICA_ATRASO;
        break;
      case 'impossivel':
        classe = 'vermelho'; icone = 'alerta'; texto = 'Não dá mais tempo (vence na ' + prazo + ')';
        dica = 'Mesmo começando agora, não termina até o prazo. Se não começar, o card sai do quadro no fim da ' + prazo + '.';
        break;
      case 'urgente':
        classe = 'amarelo'; icone = 'tempo';
        if (naoIniciado) texto = 'Comece nesta rodada (prazo: ' + prazo + ')';
        else if (c.coluna === 'revisao') texto = 'Revise até a ' + prazo;
        else texto = 'No limite do prazo (' + prazo + ')';
        dica = 'Sem folga: qualquer atraso passa do prazo. ' + DICA_ATRASO;
        break;
      default:
        classe = 'neutro'; icone = 'rodada'; texto = 'Prazo: ' + prazo;
        dica = naoIniciado ? 'Card que não começar até o prazo sai do quadro.' : 'Dentro do prazo, com folga.';
    }
    return '<p class="farol farol-' + classe + '" title="' + esc(dica) + '">' + ic(icone) + '<span>' + esc(texto) + '</span></p>';
  }

  function origemDaCarta(c) {
    if (c.origem === 'pedido') return '<span class="etiqueta etiqueta-pedido" title="Pedido avulso: chegou na rodada ' + c.chegada + ', não conta para missão.">Pedido</span>';
    const m = E().missaoPorId(c.missaoId);
    return '<span class="etiqueta etiqueta-missao" style="--missao:' + COR_MISSAO[m.id] + '" title="Projeto da missão ' + esc(m.nome) + '">' + esc(m.nome) + '</span>';
  }

  function responsavelDaCarta(estado, c) {
    const proj = E().projetoDaCarta(c);
    if (!c.responsavel) {
      if (c.coluna !== 'backlog') return '';
      return '<p class="card-area" title="' + esc(textoArea(proj)) + '. Fora da área o projeto leva +' + R().TEMPO_FORA_DA_AREA + ' rodada.">' + ic('pessoa') + '<span>' + esc(textoAreaCurto(proj)) + '</span></p>';
    }
    const p = E().pessoa(c.responsavel);
    const fora = !E().naArea(c.responsavel, proj);
    return '<div class="card-responsavel' + (fora ? ' fora' : '') + '">' + avatar(p, 'avatar-mini') +
      '<span><span class="rotulo">Responsável</span> <strong>' + esc(p.nome) + '</strong>' +
      (fora ? ' <span class="fora-area" title="Fora da área de ' + esc(p.nome) + ': o projeto leva +' + R().TEMPO_FORA_DA_AREA + ' rodada.">fora da área +1</span>' : '') +
      '</span></div>';
  }

  /** O card está parado nesta rodada porque o responsável foi revisar outro? */
  function paradoPorRevisao(estado, c) {
    for (let i = 0; i < estado.revisoresDaRodada.length; i++) {
      const x = E().projetoParadoSeRevisar(estado, estado.revisoresDaRodada[i]);
      if (x && x.id === c.id) return E().pessoa(estado.revisoresDaRodada[i]);
    }
    return null;
  }

  function selosDaCarta(estado, c) {
    const p = E().projetoDaCarta(c);
    const s = [];
    const planejando = estado.fase === 'planejamento';
    const bloqueio = c.coluna !== 'concluido' ? E().bloqueioDaCarta(estado, c) : null;
    if (bloqueio) s.push(selo('ruim', 'parado', 'Parado nesta rodada', bloqueio));
    if (c.coluna === 'afazer' && c.custoPago !== null) {
      s.push(selo('bom', 'check', 'Já pago', 'Voltou por causa de um evento: recomeça sem cobrar o custo de novo.'));
    }
    if (c.coluna === 'andamento') {
      const forca = E().forcaDaCarta(c);
      const precisa = E().forcaNecessaria(p);
      if (forca < precisa) {
        s.push(selo('ruim', 'reforco', 'Falta força: ' + forca + ' de ' + precisa, 'Sem a força completa o projeto não avança no fim da rodada. Complete a equipe.'));
      }
      const revisor = paradoPorRevisao(estado, c);
      if (revisor) s.push(selo('ruim', 'parado', revisor.nome + ' foi revisar', 'O responsável parou para revisar outro projeto: este não avança nesta rodada.'));
    }
    const ev = planejando && estado.eventoAtual ? E().definicaoEvento(estado.eventoAtual.id) : null;
    if (ev && ev.quando === 'fim' && (c.coluna === 'andamento' || c.coluna === 'afazer')) {
      if (ev.risco && p.riscos.indexOf(ev.risco) !== -1) {
        s.push(selo('alerta', ev.risco, 'Risco no fim da rodada', ev.nome + ': ' + ev.efeito));
      } else if (ev.id === 'ev_reuniao' && c.coluna === 'andamento') {
        s.push(selo('alerta', 'alerta', 'Pode parar na reunião', ev.efeito));
      }
    }
    if (c.coluna === 'revisao' && planejando && E().ultimaRodada(estado)) {
      s.push(selo('alerta', 'alerta', 'Última chance de revisar', 'Na última rodada, projeto que não for revisado não conta.'));
    }
    return s.length ? '<div class="card-selos">' + s.join('') + '</div>' : '';
  }

  /** Botões de ação do card. `soBotoes` devolve só os botões, sem o contêiner. */
  function acoesDaCarta(estado, c, soBotoes) {
    if (estado.fase !== 'planejamento') return '';
    const b = [];
    if (c.coluna === 'backlog') {
      const av = OG.kanban.avaliarMovimento(estado, c.id, 'afazer');
      b.push(botao('abrir-planejar', 'Planejar', { carta: c.id, motivo: av.ok ? null : av.motivo, icone: 'direita', primario: true }));
    } else if (c.coluna === 'afazer') {
      const av = OG.kanban.avaliarMovimento(estado, c.id, 'andamento');
      b.push(botao('abrir-iniciar', c.custoPago !== null ? 'Retomar' : 'Iniciar', { carta: c.id, motivo: av.ok ? null : av.motivo, icone: 'jogar', primario: true }));
      b.push(botao('abrir-trocar', 'Trocar responsável', { carta: c.id, icone: 'pessoa' }));
    } else if (c.coluna === 'andamento') {
      if (E().forcaDaCarta(c) < E().forcaNecessaria(E().projetoDaCarta(c))) {
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

  function segmentos(total, feitos) {
    let seg = '';
    for (let i = 0; i < total; i++) seg += '<span class="' + (i < feitos ? 'feito' : '') + '"></span>';
    return '<div class="segmentos" aria-hidden="true">' + seg + '</div>';
  }

  function progressoDaCarta(estado, c) {
    if (c.coluna === 'backlog' || c.coluna === 'afazer') return '';
    let texto;
    if (c.coluna === 'andamento') {
      const restante = c.tempoTotal - c.progresso;
      texto = 'Execução: ' + c.progresso + ' de ' + rodadas(c.tempoTotal);
      const anda = estado.fase === 'planejamento' && !E().bloqueioDaCarta(estado, c) && !paradoPorRevisao(estado, c) &&
        E().forcaDaCarta(c) >= E().forcaNecessaria(E().projetoDaCarta(c));
      if (anda) texto += restante === 1 ? '. Termina no fim desta rodada.' : '. Faltam ' + restante + ' rodadas.';
    } else if (c.coluna === 'revisao') {
      texto = 'Execução completa. Falta a revisão.';
    } else {
      const rev = E().pessoa(c.revisor);
      texto = 'Revisado por ' + (rev ? rev.nome : '?') + ' na rodada ' + c.concluidoNaRodada + '.';
    }
    return '<div class="card-progresso">' + segmentos(c.tempoTotal, c.progresso) + '<span>' + esc(texto) + '</span></div>';
  }

  function equipeDaCarta(c) {
    const ids = c.coluna === 'andamento' ? c.equipe : [];
    if (!ids.length) return '';
    const proj = E().projetoDaCarta(c);
    const pessoas = ids.map(function (id) { return E().pessoa(id); });
    const forca = E().forcaDaCarta(c);
    const precisa = E().forcaNecessaria(proj);
    return '<div class="card-equipe">' + pessoas.map(function (p) { return avatar(p, 'avatar-mini'); }).join('') +
      '<span>' + esc(OG.util.listaPt(pessoas.map(function (p) { return p.nome; }))) +
      ' · ' + (forca >= precisa ? 'força completa' : 'força ' + forca + ' de ' + precisa) + '</span></div>';
  }

  function textoTempo(c) {
    const proj = E().projetoDaCarta(c);
    if (c.tempoTotal) return rodadas(c.tempoTotal);
    if (c.responsavel) return rodadas(E().tempoComCoordenador(proj, c.responsavel));
    return rodadas(proj.tempo) + ' na área';
  }

  function cardCompacto(estado, c) {
    const p = E().projetoDaCarta(c);
    const rev = E().pessoa(c.revisor);
    return '<article class="card card-compacto card-cat-' + p.categoria + (c.noPrazo ? '' : ' tarde') + '" data-carta="' + esc(c.id) + '" aria-labelledby="titulo-' + esc(c.id) + '">' +
      '<h3 class="card-titulo" id="titulo-' + esc(c.id) + '"><button type="button" data-acao="detalhes" data-carta="' + esc(c.id) + '" data-foco="detalhes:' + esc(c.id) + '">' + esc(p.nome) + '</button></h3>' +
      '<span class="compacto-info">' + (c.noPrazo ? ic('check', 'ic-verde', 'No prazo') : ic('tempo', '', 'Com atraso')) +
      'R' + c.concluidoNaRodada + (rev ? ' · ' + esc(rev.nome) : '') + '</span></article>';
  }

  function card(estado, c) {
    const p = E().projetoDaCarta(c);
    const cat = OG.dados.categorias[p.categoria];
    const arrastavel = estado.fase === 'planejamento' && (c.coluna === 'backlog' || c.coluna === 'afazer' || c.coluna === 'revisao');
    const congelado = c.coluna !== 'concluido' && !!E().bloqueioDaCarta(estado, c);
    const classes = ['card', 'card-cat-' + p.categoria];
    if (c.coluna === 'concluido') classes.push('concluido');
    if (congelado) classes.push('congelado');
    const f = E().farolDoPrazo(estado, c);
    if (f === 'impossivel' || f === 'atrasado') classes.push('em-risco');
    const riscos = p.riscos.map(function (r) {
      const def = OG.dados.riscos[r];
      return '<span title="' + esc(def.nome + ' (evento: ' + def.evento + ')') + '">' + ic(r, '', def.nome) + '</span>';
    }).join('');
    const curto = OG.util.formatarDinheiroCurto;
    const custo = c.custoPago !== null ? c.custoPago : p.custo;
    const forca = E().forcaNecessaria(p);
    const badges = [
      '<li title="Rodadas de execução' + (c.responsavel ? ' com o responsável' : ' com um coordenador da área (fora da área: +1)') + '">' + ic('tempo', '', 'Tempo') + esc(textoTempo(c)) + '</li>',
      '<li title="Força necessária: o responsável soma 1, voluntário 1, especialista 2.">' + ic('pessoas', '', 'Força necessária') + 'força ' + forca + '</li>',
      '<li class="badge-dinheiro" title="' + (c.custoPago !== null ? 'Custo pago' : 'Custo') + ' → retorno ao concluir no prazo">' + ic('dinheiro', '', 'Dinheiro') + curto(custo) + ' → ' + curto(p.retorno) + '</li>',
    ];
    if (p.prestigio) badges.push('<li class="badge-prestigio" title="Prestígio ao concluir no prazo">' + ic('prestigio', '', 'Prestígio') + '+' + p.prestigio + '</li>');
    if (p.tradicao) badges.push('<li class="badge-tradicao" title="Tradição ao concluir no prazo">' + ic('tradicao', '', 'Tradição') + '+' + p.tradicao + '</li>');
    return '<article class="' + classes.join(' ') + '" data-carta="' + esc(c.id) + '"' +
      (arrastavel ? ' draggable="true"' : '') + ' aria-labelledby="titulo-' + esc(c.id) + '">' +
      '<div class="card-etiquetas"><span class="etiqueta etiqueta-cat">' + ic(cat.icone) + esc(cat.nome) + '</span>' +
      origemDaCarta(c) + (riscos ? '<span class="card-riscos">' + riscos + '</span>' : '') + '</div>' +
      '<h3 class="card-titulo" id="titulo-' + esc(c.id) + '"><button type="button" data-acao="detalhes" data-carta="' + esc(c.id) + '" data-foco="detalhes:' + esc(c.id) + '">' + esc(p.nome) + '</button></h3>' +
      farol(estado, c) +
      '<ul class="card-badges">' + badges.join('') + '</ul>' +
      responsavelDaCarta(estado, c) +
      progressoDaCarta(estado, c) +
      equipeDaCarta(c) +
      selosDaCarta(estado, c) +
      acoesDaCarta(estado, c) +
      '</article>';
  }

  const CONCLUIDOS_COMPLETOS = 3;

  function coluna(estado, def) {
    const cartas = E().cartasNaColuna(estado, def.id);
    let contagem = String(cartas.length);
    let rotuloContagem = cartas.length + ' ' + plural(cartas.length, 'card', 'cards');
    let dica = '';
    let cheia = false;
    if (def.id === 'andamento') {
      contagem = cartas.length + '/5';
      rotuloContagem = cartas.length + ' de 5 projetos ao mesmo tempo (um por coordenador)';
      cheia = cartas.length >= 5;
      dica = 'Um por coordenador';
    } else if (def.id === 'afazer') {
      dica = 'Até ' + R().FILA_POR_COORDENADOR + ' por coordenador';
    }
    let lista;
    if (!cartas.length) {
      lista = '<li class="coluna-vazia">' + COLUNA_VAZIA[def.id] + '</li>';
    } else if (def.id === 'concluido' && cartas.length > CONCLUIDOS_COMPLETOS) {
      // Os mais recentes ficam completos; os antigos, numa lista compacta.
      const recentes = cartas.slice(-CONCLUIDOS_COMPLETOS).reverse();
      const antigos = cartas.slice(0, -CONCLUIDOS_COMPLETOS).reverse();
      lista = recentes.map(function (c) { return '<li>' + card(estado, c) + '</li>'; }).join('') +
        '<li><details class="concluidos-antigos" data-chave="concluidos-antigos"><summary>Mais ' + antigos.length + ' ' + plural(antigos.length, 'concluído', 'concluídos') + '</summary>' +
        '<ol>' + antigos.map(function (c) { return '<li>' + cardCompacto(estado, c) + '</li>'; }).join('') + '</ol></details></li>';
    } else {
      lista = cartas.map(function (c) { return '<li>' + card(estado, c) + '</li>'; }).join('');
    }
    return '<section class="coluna coluna-' + def.id + '" data-coluna="' + def.id + '" id="coluna-' + def.id + '" aria-labelledby="col-' + def.id + '">' +
      '<header class="coluna-cabeca"><h2 id="col-' + def.id + '">' + NOMES_COLUNA[def.id] + '</h2>' +
      '<span class="coluna-contagem' + (cheia ? ' cheia' : '') + '" aria-label="' + esc(rotuloContagem) + '">' + contagem + '</span></header>' +
      (dica ? '<p class="coluna-limite">' + esc(dica) + '</p>' : '') +
      '<p class="coluna-dica-soltar" data-dica-soltar></p>' +
      '<ol class="coluna-cards">' + lista + '</ol></section>';
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

  function chipMissao(estado, a) {
    const m = E().missaoPorId(a.missaoId);
    const sit = E().situacaoMissao(estado, a);
    const prog = E().progressoMissao(estado, a.missaoId);
    if (sit === 'cumprida') {
      return '<li class="chip-missao cumprida" title="Missão cumprida na rodada ' + a.cumpridaNaRodada + '">' + ic('concluido') + '<span>' + esc(m.nome) + '</span></li>';
    }
    if (sit === 'perdida') {
      return '<li class="chip-missao perdida" title="Chegou à data com ' + prog + ' de ' + m.objetivo + '">' + ic('bloqueado') + '<span>' + esc(m.nome) + '</span></li>';
    }
    if (sit === 'futura') {
      return '<li class="chip-missao futura">' + ic('missao') + '<span>' + esc(m.nome) + ' · abre na rodada ' + a.abre + '</span></li>';
    }
    const pct = Math.min(100, Math.round((prog / m.objetivo) * 100));
    const urgente = a.data === estado.rodada;
    return '<li class="chip-missao aberta' + (urgente ? ' urgente' : '') + '" style="--missao:' + COR_MISSAO[m.id] + '">' + ic('missao') +
      '<span><strong>' + esc(m.nome) + '</strong> ' + prog + '/' + m.objetivo + ' no prazo · até a rodada ' + a.data + '</span>' +
      '<span class="barra-missao" aria-hidden="true"><span style="width:' + pct + '%"></span></span></li>';
  }

  function faixaMissoes(estado) {
    const agenda = estado.agenda;
    let visiveis = agenda;
    let resumo = '';
    if (agenda.length > 3) {
      const abertas = agenda.filter(function (a) { return E().situacaoMissao(estado, a) === 'aberta'; });
      const futura = agenda.find(function (a) { return E().situacaoMissao(estado, a) === 'futura'; });
      visiveis = abertas.concat(futura ? [futura] : []);
      const cumpridas = agenda.filter(function (a) { return a.cumprida; }).length;
      const perdidas = agenda.filter(function (a) { return a.perdida; }).length;
      resumo = cumpridas + perdidas ? cumpridas + ' ' + plural(cumpridas, 'cumprida', 'cumpridas') + (perdidas ? ', ' + perdidas + ' ' + plural(perdidas, 'perdida', 'perdidas') : '') : '';
    }
    return '<div class="hud-missoes"><ul class="lista-missoes" aria-label="Missões">' + visiveis.map(function (a) { return chipMissao(estado, a); }).join('') + '</ul>' +
      '<button type="button" class="chip chip-agenda" data-acao="abrir-agenda" data-foco="abrir-agenda">' + ic('rodada') + 'Agenda' +
      (agenda.length > 1 ? '<span class="detalhe-agenda">&nbsp;(' + agenda.length + ' missões' + (resumo ? ': ' + esc(resumo) : '') + ')</span>' : '') + '</button></div>';
  }

  function barraRodadas(estado) {
    const n = E().totalRodadas(estado);
    const terminadas = estado.rodada - 1 + (estado.fase === 'resumo' || estado.fase === 'fim' ? 1 : 0);
    if (n <= 10) {
      let pips = '';
      for (let i = 1; i <= n; i++) {
        const terminou = i <= terminadas;
        pips += '<span class="pip' + (terminou ? ' feita' : i === estado.rodada ? ' atual' : '') + '"></span>';
      }
      return '<span class="pips">' + pips + '</span>';
    }
    return '<span class="barra-rodadas"><span style="width:' + Math.round((terminadas / n) * 100) + '%"></span></span>';
  }

  function hud(estado) {
    const r = E().recursos(estado);
    const n = E().totalRodadas(estado);
    const info = OG.regrasUtil.duracao(n);
    const m = E().missaoPorId(estado.config.missaoId);
    let encerrar;
    if (estado.fase === 'resumo') {
      const ultima = E().ultimaRodada(estado);
      encerrar = '<button type="button" class="botao botao-primario so-largo" data-acao="avancar" data-foco="encerrar">' +
        ic(ultima ? 'premio' : 'jogar') + '<span>' + (ultima ? 'Ver resultado final' : 'Começar a rodada ' + (estado.rodada + 1)) + '</span></button>';
    } else {
      encerrar = '<button type="button" class="botao botao-primario so-largo" data-acao="encerrar-rodada" data-foco="encerrar"' +
        (estado.fase === 'planejamento' ? '' : ' aria-disabled="true" data-motivo="' + esc(OG.kanban.mensagemFase(estado)) + '"') + '>' +
        ic('rodada') + '<span>Encerrar rodada ' + estado.rodada + '</span></button>';
    }
    return '<header class="hud">' +
      '<div class="hud-marca"><span class="marca" aria-hidden="true"><span class="marca-escola">Escola</span><span class="marca-mesquita">Mesquita</span></span>' +
      '<div><div class="hud-titulo">' + esc(info.nome) + ' · ' + n + ' rodadas</div>' +
      '<div class="hud-modo">Abertura: ' + esc(m.nome) + (estado.config.caixaApertado ? ' · caixa apertado' : '') + '</div></div></div>' +
      '<div class="hud-rodada" role="group" aria-label="Rodada ' + estado.rodada + ' de ' + n + '"><span class="numero" aria-hidden="true">' + estado.rodada + '<small>/' + n + '</small></span>' +
      '<span aria-hidden="true"><span class="rotulo">Rodada</span>' + barraRodadas(estado) + '</span></div>' +
      '<dl class="hud-recursos">' +
      '<div class="recurso recurso-caixa" data-recurso="dinheiro"><dt>' + ic('dinheiro') + '<span>Caixa</span></dt><dd>' + din(r.dinheiro) + '</dd></div>' +
      '<div class="recurso recurso-prestigio" data-recurso="prestigio"><dt>' + ic('prestigio') + '<span>Prestígio</span></dt><dd>' + r.prestigio + '</dd></div>' +
      '<div class="recurso recurso-tradicao" data-recurso="tradicao"><dt>' + ic('tradicao') + '<span>Tradição</span></dt><dd>' + r.tradicao + '</dd></div>' +
      '</dl>' +
      '<div class="hud-acoes">' + encerrar +
      '<button type="button" class="botao botao-fantasma botao-equipe-lateral" data-acao="abrir-lateral" data-foco="abrir-lateral" aria-label="Abrir equipe e diário">' + ic('pessoas') + '<span class="so-largo">Equipe e diário</span></button>' +
      '<button type="button" class="botao botao-fantasma botao-icone" data-acao="menu" data-foco="menu" aria-label="Menu do jogo">' + ic('menu') + '</button>' +
      '</div>' +
      '<div class="hud-linha2">' + faixaMissoes(estado) +
      '<div class="hud-evento">' + chipsDoTopo(estado) + '</div></div>' +
      '</header>';
  }

  /** Lembrete da regra do evento que vale nesta rodada. */
  function faixaEvento(estado) {
    if (estado.fase !== 'planejamento' || !estado.eventoAtual) return '';
    const ev = E().definicaoEvento(estado.eventoAtual.id);
    if (!ev || ev.tipo === 'neutro') return '';
    let situacao = '';
    const nomeCarta = function (id) { return E().projetoDaCarta(E().carta(estado, id)).nome; };
    switch (ev.id) {
      case 'ev_chimarrao': {
        const ini = OG.kanban.iniciadosNaRodada(estado);
        const resta = Math.max(0, R().LIMITE_INICIOS_CHIMARRAO - ini.length);
        situacao = (ini.length ? 'Já começaram: ' + OG.util.listaPt(ini.map(function (c) { return nomeCarta(c.id); })) + '. ' : '') +
          (resta ? 'Ainda ' + plural(resta, 'pode começar 1 projeto', 'podem começar ' + resta + ' projetos') + '.' : 'Mais nenhum início nesta rodada.');
        break;
      }
      case 'ev_provas': {
        const mv = estado.cartasMovidasNaRodada;
        const resta = Math.max(0, R().LIMITE_MOVIMENTOS_PROVAS - mv.length);
        situacao = (mv.length ? 'Já se moveram: ' + OG.util.listaPt(mv.map(nomeCarta)) + '. ' : '') +
          (resta ? 'Ainda ' + plural(resta, 'pode se mover 1 card', 'podem se mover ' + resta + ' cards') + '.' : 'Só esses podem continuar andando.');
        break;
      }
      case 'ev_impressora':
      case 'ev_quadra': {
        const afetados = estado.cartas.filter(function (c) { return c.coluna !== 'concluido' && E().bloqueioDaCarta(estado, c); });
        situacao = afetados.length ? 'Parados: ' + OG.util.listaPt(afetados.map(function (c) { return E().projetoDaCarta(c).nome; })) + '.' : 'Nenhum card seu é afetado.';
        break;
      }
      case 'ev_mutirao':
        situacao = OG.kanban.mutiraoDisponivel(estado) ? 'Use o botão “Usar Mutirão” num card de Em andamento.' : 'Mutirão já usado.';
        break;
      case 'ev_influenza': {
        const alvo = estado.eventoAtual.alvo;
        situacao = alvo ? E().pessoa(alvo).nome + ' está com influenza e volta na próxima rodada.' : 'Ninguém ficou doente.';
        break;
      }
      case 'ev_patricio':
        situacao = 'Patrício está no Grêmio como temporário: soma 2 de força em qualquer projeto.';
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
    const lista = Object.keys(porRodada).map(Number).sort(function (a, b) { return b - a; });
    if (!lista.length) return '<p class="nota">Ainda não aconteceu nada.</p>';
    return lista.map(function (r) {
      return '<div class="historico-rodada"><h4>Rodada ' + r + '</h4><ul>' +
        porRodada[r].slice().reverse().map(function (h) {
          return '<li class="' + esc(h.tipo) + '">' + esc(h.texto) + '</li>';
        }).join('') + '</ul></div>';
    }).join('');
  }

  function financas(estado) {
    const f = OG.pontuacao.resumoFinanceiro(estado);
    const pontos = OG.pontuacao.pontosDe(estado);
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
      (f.investimentoParado ? '<dt>Pago e ainda sem retorno</dt><dd>' + din(f.investimentoParado) + '</dd>' : '') +
      '<dt><strong>Pontos agora</strong></dt><dd>' + pontos + '</dd>' +
      '</dl>' +
      '<table class="tabela-financas"><caption class="visualmente-oculto">Lançamentos do caixa, do mais recente ao mais antigo</caption>' +
      '<thead><tr><th scope="col">Rod.</th><th scope="col">O quê</th><th scope="col" style="text-align:right">Valor</th><th scope="col" style="text-align:right">Saldo</th></tr></thead><tbody>' +
      linhas.map(function (x) {
        return '<tr><td>' + x.l.rodada + '</td><td>' + esc(x.l.descricao) + '</td><td class="valor ' + (x.l.valor >= 0 ? 'mais' : 'menos') + '">' +
          OG.util.formatarDinheiroComSinal(x.l.valor) + '</td><td class="saldo">' + din(x.saldo) + '</td></tr>';
      }).join('') + '</tbody></table>' +
      '<p class="nota" style="margin-top:8px">Retorno é tudo o que entrou de um projeto. Lucro é o retorno menos o custo.</p>';
  }

  function regrasResumo(estado) {
    const n = estado ? E().totalRodadas(estado) : 4;
    return '<ol class="regras-lista">' +
      '<li>Cada rodada começa com um evento. Ele vale para a rodada inteira.</li>' +
      '<li><strong>Planejar:</strong> leve um card do Backlog para A fazer escolhendo o <strong>coordenador responsável</strong> (até ' + R().FILA_POR_COORDENADOR + ' por coordenador).</li>' +
      '<li><strong>Iniciar:</strong> o responsável precisa estar livre — cada coordenador toca um projeto por vez e trabalha nele (força 1). Complete a força do card com voluntários (especialista vale 2) e pague o custo.</li>' +
      '<li>Fora da área do responsável, o projeto leva +' + R().TEMPO_FORA_DA_AREA + ' rodada. Sumindo, o Geral, nunca está fora da área.</li>' +
      '<li><strong>Encerrar a rodada:</strong> projetos com a força completa ganham 1 rodada de execução. Quem termina vai para Revisão.</li>' +
      '<li><strong>Revisar:</strong> outro coordenador confere (cada um revisa 1 por rodada). Quem para no meio de um projeto para revisar deixa o próprio projeto parado na rodada.</li>' +
      '<li><strong>Prazo:</strong> card que não começa até o prazo sai do quadro. Entregue depois do prazo: metade do retorno, sem prestígio nem tradição.</li>' +
      '</ol>' +
      '<ul class="lista-simples" style="margin-top:12px">' +
      '<li>Missão: conclua 4 dos 6 projetos dela dentro do prazo. Pedidos avulsos chegam todo começo de rodada.</li>' +
      '<li>Especialista na categoria do projeto: ' + din(R().DESCONTO_ESPECIALISTA) + ' de desconto por pessoa.</li>' +
      '<li>O caixa nunca fica negativo. Despesa sem dinheiro vira perda de prestígio.</li>' +
      '<li>Pontos: caixa ÷ 10 + prestígio + tradição + 5 por projeto entregue no prazo. Partida de ' + n + ' rodadas.</li>' +
      '</ul>';
  }

  function painelDiario(estado, aba) {
    const abas = [
      { id: 'historico', rotulo: 'Histórico', icone: 'historico' },
      { id: 'financas', rotulo: 'Finanças', icone: 'financas' },
      { id: 'regras', rotulo: 'Regras', icone: 'regras' },
    ];
    const conteudo = aba === 'financas' ? financas(estado) : aba === 'regras' ? regrasResumo(estado) : historico(estado);
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
      '<div class="carta-evento-tipo"><span>' + ic(tipo.icone) + ' ' + tipo.rotulo + '</span><span>Rodada ' + ev.rodada + ' de ' + E().totalRodadas(estado) + '</span></div>' +
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

  /**
   * Medidor de força. Passar do necessário só é problema quando alguém poderia sair
   * da equipe (`sobrando`): com especialista valendo 2, às vezes a conta não fecha exata.
   */
  function medidorForca(forca, precisa, sobrando) {
    let seg = '';
    const total = Math.max(precisa, forca);
    for (let i = 0; i < total; i++) {
      seg += '<span class="' + (i < forca ? (i < precisa ? 'feito' : sobrando ? 'sobra' : 'extra') : '') + '"></span>';
    }
    const ok = forca >= precisa;
    let texto;
    if (!ok) texto = 'faltam ' + (precisa - forca);
    else if (sobrando) texto = 'tem gente sobrando';
    else texto = forca > precisa ? 'completa (+' + (forca - precisa) + ', ninguém sobra)' : 'completa';
    return '<div class="medidor-forca' + (ok && !sobrando ? ' completo' : '') + (sobrando ? ' sobrando' : '') + '"><div class="medidor-topo"><strong>Força da equipe: ' + forca + ' de ' + precisa + '</strong>' +
      '<span>' + texto + '</span></div>' +
      '<div class="segmentos segmentos-forca" aria-hidden="true">' + seg + '</div></div>';
  }

  OG.componentes = {
    NOMES_COLUNA,
    TIPOS_EVENTO,
    TEMAS,
    COR_MISSAO,
    textoRecompensa,
    avatar,
    areaTexto,
    areaCurta,
    especialidadeTexto,
    coordenadoresDaArea,
    textoArea,
    textoAreaCurto,
    painelEquipe,
    faixaCoordenacao,
    farol,
    card,
    acoesDaCarta,
    coluna,
    hud,
    faixaEvento,
    painelDiario,
    regrasResumo,
    cartaEvento,
    contaCusto,
    medidorForca,
    segmentos,
    botao,
    paradoPorRevisao,
  };
})(globalThis);
