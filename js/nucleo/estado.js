/*
 * estado.js — leitura do estado da partida (seletores) e erros de regra.
 *
 * Princípio: os números exibidos são SEMPRE derivados do estado real.
 * Caixa, prestígio e tradição não são contadores soltos: são a soma do livro-caixa
 * (`estado.livro`), onde cada lançamento tem rodada, tipo e motivo.
 * A ocupação de cada pessoa também é derivada (responsáveis e equipes dos cards,
 * revisões da rodada, doença, temporários).
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  class ErroDeRegra extends Error {
    constructor(mensagem) {
      super(mensagem);
      this.name = 'ErroDeRegra';
    }
  }

  function exigir(condicao, mensagem) {
    if (!condicao) throw new ErroDeRegra(mensagem);
  }

  function R() { return OG.regras; }

  // ---------- Partida ----------

  function totalRodadas(estado) {
    return estado.config.duracao;
  }

  function ultimaRodada(estado) {
    return estado.rodada >= estado.config.duracao;
  }

  // ---------- Dados ----------

  function projeto(id) {
    return OG.dados.projetosPorId[id] || null;
  }

  function projetoDaCarta(carta) {
    return projeto(carta.projetoId);
  }

  function missaoPorId(id) {
    return OG.dados.missoesPorId[id] || null;
  }

  let mapaPessoas = null;
  function indicePessoas() {
    if (!mapaPessoas) {
      mapaPessoas = {};
      OG.dados.coordenadores.forEach(function (p) {
        mapaPessoas[p.id] = Object.assign({ papel: 'coordenador' }, p);
      });
      OG.dados.voluntarios.forEach(function (p) {
        mapaPessoas[p.id] = Object.assign({ papel: 'voluntario' }, p);
      });
    }
    return mapaPessoas;
  }

  function pessoa(id) {
    return indicePessoas()[id] || null;
  }

  function todasPessoas() {
    const idx = indicePessoas();
    return Object.keys(idx).map(function (id) { return idx[id]; });
  }

  function coordenadores() {
    return OG.dados.coordenadores.map(function (p) { return pessoa(p.id); });
  }

  function voluntarios() {
    return OG.dados.voluntarios.map(function (p) { return pessoa(p.id); });
  }

  function ehCoordenador(id) {
    const p = pessoa(id);
    return !!p && p.papel === 'coordenador';
  }

  function ehVoluntario(id) {
    const p = pessoa(id);
    return !!p && p.papel === 'voluntario';
  }

  // ---------- Área do coordenador e especialidade do voluntário ----------

  /** O projeto está na área do coordenador? (Sumindo, o Geral, sempre está.) */
  function naArea(coordId, proj) {
    const c = pessoa(coordId);
    if (!c || c.papel !== 'coordenador' || !proj) return false;
    return !!c.area.coringa || c.area.categorias.indexOf(proj.categoria) !== -1;
  }

  /** Voluntário especialista na categoria do projeto (ou em algum risco dele, ou coringa). */
  function ehEspecialista(p, proj) {
    if (!p || !proj || p.papel !== 'voluntario') return false;
    const e = p.especialidade || {};
    if (e.coringa) return true;
    if (e.categorias && e.categorias.indexOf(proj.categoria) !== -1) return true;
    if (e.riscos && e.riscos.some(function (r) { return proj.riscos.indexOf(r) !== -1; })) return true;
    return false;
  }

  // ---------- Força de trabalho e tempo ----------

  function forcaNecessaria(proj) {
    return proj.trabalhadores + R().FORCA_EXTRA;
  }

  function forcaVoluntario(pessoaId, proj) {
    const p = pessoa(pessoaId);
    if (!p || p.papel !== 'voluntario') return 0;
    return ehEspecialista(p, proj) ? R().FORCA_ESPECIALISTA : R().FORCA_VOLUNTARIO;
  }

  /** Força de uma equipe (coordenador responsável + voluntários). */
  function forcaDaEquipe(proj, temCoordenador, equipe) {
    let total = temCoordenador ? R().FORCA_COORDENADOR : 0;
    (equipe || []).forEach(function (id) { total += forcaVoluntario(id, proj); });
    return total;
  }

  function forcaDaCarta(carta) {
    return forcaDaEquipe(projetoDaCarta(carta), !!carta.responsavel, carta.equipe);
  }

  /**
   * Voluntários "sobrando": quem poderia sair da equipe e a força continuaria suficiente.
   * Equipe enxuta = ninguém sobrando.
   */
  function voluntariosSobrando(proj, equipe) {
    const total = forcaDaEquipe(proj, true, equipe);
    const precisa = forcaNecessaria(proj);
    return (equipe || []).filter(function (id) {
      return total - forcaVoluntario(id, proj) >= precisa;
    });
  }

  /** Rodadas de execução do card com este coordenador responsável. */
  function tempoComCoordenador(proj, coordId) {
    return proj.tempo + (naArea(coordId, proj) ? 0 : R().TEMPO_FORA_DA_AREA);
  }

  /** Rodadas de execução do card (usa o tempo fixado no início, se já começou). */
  function tempoTotal(carta, coordId) {
    if (carta.tempoTotal) return carta.tempoTotal;
    const coord = coordId || carta.responsavel;
    return coord ? tempoComCoordenador(projetoDaCarta(carta), coord) : projetoDaCarta(carta).tempo;
  }

  // ---------- Cards ----------

  function carta(estado, id) {
    for (let i = 0; i < estado.cartas.length; i++) {
      if (estado.cartas[i].id === id) return estado.cartas[i];
    }
    return null;
  }

  function cartasNaColuna(estado, coluna) {
    return estado.cartas
      .filter(function (c) { return c.coluna === coluna; })
      .sort(function (a, b) { return a.ordem - b.ordem; });
  }

  function entreguesNoPrazo(estado) {
    return estado.cartas.filter(function (c) { return c.coluna === 'concluido' && c.noPrazo === true; });
  }

  // ---------- Recursos (derivados do livro-caixa) ----------

  function recursos(estado) {
    const r = { dinheiro: 0, prestigio: 0, tradicao: 0 };
    estado.livro.forEach(function (l) { r[l.recurso] += l.valor; });
    return r;
  }

  // ---------- Missões ----------

  function entradaAgenda(estado, missaoId) {
    for (let i = 0; i < estado.agenda.length; i++) {
      if (estado.agenda[i].missaoId === missaoId) return estado.agenda[i];
    }
    return null;
  }

  /** Projetos da missão concluídos dentro do prazo (os que contam para o objetivo). */
  function progressoMissao(estado, missaoId) {
    return estado.cartas.filter(function (c) {
      return c.missaoId === missaoId && c.coluna === 'concluido' && c.noPrazo === true;
    }).length;
  }

  /** 'futura' | 'aberta' | 'cumprida' | 'perdida' */
  function situacaoMissao(estado, entrada) {
    if (entrada.cumprida) return 'cumprida';
    if (entrada.perdida) return 'perdida';
    if (entrada.abre > estado.rodada) return 'futura';
    return 'aberta';
  }

  function missoesAbertas(estado) {
    return estado.agenda.filter(function (a) { return situacaoMissao(estado, a) === 'aberta'; });
  }

  // ---------- Evento da rodada ----------

  function definicaoEvento(id) {
    return OG.dados.eventosPorId[id] || null;
  }

  function eventoAtual(estado) {
    return estado.eventoAtual ? definicaoEvento(estado.eventoAtual.id) : null;
  }

  /** O evento vale para a rodada depois de confirmado (fase de planejamento em diante). */
  function eventoAtivo(estado, id) {
    return !!estado.eventoAtual &&
      estado.eventoAtual.id === id &&
      estado.eventoAtual.rodada === estado.rodada &&
      estado.eventoAtual.resolvido === true;
  }

  /** Motivo pelo qual o card está congelado nesta rodada (Impressora / Quadra), ou null. */
  function bloqueioDaCarta(estado, c) {
    const proj = projetoDaCarta(c);
    if (eventoAtivo(estado, 'ev_impressora') && proj.categoria === 'divulgacao') {
      return 'Impressora do T11 pifou: cards de Divulgação não avançam nesta rodada.';
    }
    if (eventoAtivo(estado, 'ev_quadra') && proj.riscos.indexOf('quadra') !== -1) {
      return 'A quadra continua em reforma: projetos que usam a quadra ficam parados nesta rodada.';
    }
    return null;
  }

  // ---------- Pessoas ----------

  function registroTemporario(estado, pessoaId) {
    for (let i = 0; i < estado.temporarios.length; i++) {
      const t = estado.temporarios[i];
      if (t.pessoaId === pessoaId && t.ateRodada >= estado.rodada) return t;
    }
    return null;
  }

  function presente(estado, pessoaId) {
    const p = pessoa(pessoaId);
    if (!p) return false;
    if (p.somentePorEvento) return !!registroTemporario(estado, pessoaId);
    return true;
  }

  /** Quantas rodadas a pessoa ainda fica (contando a atual). Pessoas fixas: Infinity. */
  function rodadasRestantes(estado, pessoaId) {
    const p = pessoa(pessoaId);
    if (!p) return 0;
    if (!p.somentePorEvento) return Infinity;
    const t = registroTemporario(estado, pessoaId);
    return t ? t.ateRodada - estado.rodada + 1 : 0;
  }

  /** Card EM ANDAMENTO tocado por este coordenador (no máximo um). */
  function cartaLideradaPor(estado, coordId) {
    for (let i = 0; i < estado.cartas.length; i++) {
      const c = estado.cartas[i];
      if (c.coluna === 'andamento' && c.responsavel === coordId) return c;
    }
    return null;
  }

  /** Cards em A FAZER sob responsabilidade deste coordenador. */
  function filaDe(estado, coordId) {
    return cartasNaColuna(estado, 'afazer').filter(function (c) { return c.responsavel === coordId; });
  }

  /** Card EM ANDAMENTO em cuja equipe o voluntário está. */
  function cartaDoVoluntario(estado, pessoaId) {
    for (let i = 0; i < estado.cartas.length; i++) {
      const c = estado.cartas[i];
      if (c.coluna === 'andamento' && c.equipe.indexOf(pessoaId) !== -1) return c;
    }
    return null;
  }

  function estaDoente(estado, pessoaId) {
    return estado.doentes.some(function (d) {
      return d.pessoaId === pessoaId && d.rodada === estado.rodada;
    });
  }

  function revisouNestaRodada(estado, coordId) {
    return estado.revisoresDaRodada.indexOf(coordId) !== -1;
  }

  /**
   * Situação de uma pessoa agora.
   *   coordenador: 'doente' | 'tocando' (projeto em andamento) | 'livre'
   *   voluntário:  'ausente' | 'doente' | 'ocupado' (em equipe) | 'livre'
   * Revisar não muda o código: ver revisouNestaRodada.
   */
  function statusPessoa(estado, pessoaId) {
    const p = pessoa(pessoaId);
    if (!p || !presente(estado, pessoaId)) {
      return { codigo: 'ausente', texto: 'Só aparece com o evento “Patrício Ajudou”' };
    }
    if (estaDoente(estado, pessoaId)) {
      return { codigo: 'doente', texto: 'Com influenza nesta rodada' };
    }
    if (p.papel === 'coordenador') {
      const c = cartaLideradaPor(estado, pessoaId);
      if (c) return { codigo: 'tocando', texto: 'Tocando ' + projetoDaCarta(c).nome, cartaId: c.id };
      return { codigo: 'livre', texto: 'Livre para tocar um projeto' };
    }
    const c = cartaDoVoluntario(estado, pessoaId);
    if (c) return { codigo: 'ocupado', texto: 'Na equipe de ' + projetoDaCarta(c).nome, cartaId: c.id };
    return { codigo: 'livre', texto: 'Disponível' };
  }

  function voluntariosLivres(estado) {
    return voluntarios().filter(function (p) { return statusPessoa(estado, p.id).codigo === 'livre'; });
  }

  /** Coordenadores que podem COMEÇAR um projeto agora (sem projeto em andamento e com saúde). */
  function coordenadoresLivres(estado) {
    return coordenadores().filter(function (p) { return statusPessoa(estado, p.id).codigo === 'livre'; });
  }

  /** Pessoas que o evento Influenza pode sortear. */
  function pessoasLivres(estado) {
    return todasPessoas().filter(function (p) { return statusPessoa(estado, p.id).codigo === 'livre'; });
  }

  // ---------- Revisão ----------

  /**
   * Projeto que fica parado nesta rodada se este coordenador revisar:
   * o que ele já tocava antes desta rodada. Quem estava livre no começo da rodada
   * (ou começou o projeto nesta rodada) revisa sem custo.
   */
  function projetoParadoSeRevisar(estado, coordId) {
    const c = cartaLideradaPor(estado, coordId);
    if (c && c.iniciadoNaRodada !== null && c.iniciadoNaRodada < estado.rodada) return c;
    return null;
  }

  /** Motivo pelo qual o coordenador não pode revisar este card agora, ou null. */
  function impedimentoRevisor(estado, coordId, c) {
    const p = pessoa(coordId);
    if (!p) return 'Escolha um coordenador para revisar.';
    if (p.papel !== 'coordenador') return 'Só coordenadores fazem a revisão. ' + p.nome + ' é voluntário.';
    if (c && c.responsavel === coordId) return p.nome + ' tocou este projeto: ninguém revisa o próprio trabalho.';
    if (estaDoente(estado, coordId)) return p.nome + ' está com influenza nesta rodada.';
    if (revisouNestaRodada(estado, coordId)) return p.nome + ' já revisou um projeto nesta rodada.';
    return null;
  }

  // ---------- Prazos ----------

  /**
   * Rodada em que o card pode ser revisado se a execução andar sem parar a partir de agora,
   * com este coordenador (ou com o responsável atual).
   */
  function rodadaDeRevisaoPrevista(estado, c, coordId) {
    if (c.coluna === 'revisao') return estado.rodada;
    if (c.coluna === 'concluido') return c.concluidoNaRodada;
    const coord = coordId || c.responsavel;
    const total = c.coluna === 'andamento' ? c.tempoTotal : tempoTotal(c, coord);
    const restante = total - (c.coluna === 'andamento' ? c.progresso : 0);
    return estado.rodada + restante;
  }

  /** Começando (ou seguindo) agora com este coordenador, dá para concluir no prazo? */
  function terminaNoPrazo(estado, c, coordId) {
    const r = rodadaDeRevisaoPrevista(estado, c, coordId);
    return r <= c.prazo && r <= totalRodadas(estado);
  }

  /** Começando agora, termina antes do fim da partida (mesmo que atrasado)? */
  function terminaAntesDoFim(estado, c, coordId) {
    return rodadaDeRevisaoPrevista(estado, c, coordId) <= totalRodadas(estado);
  }

  /** Melhor tempo possível para o card (com o coordenador mais rápido). */
  function menorTempo(c) {
    const proj = projetoDaCarta(c);
    return coordenadores().reduce(function (m, p) {
      return Math.min(m, tempoComCoordenador(proj, p.id));
    }, Infinity);
  }

  /**
   * Farol do prazo do card (como o "verde" dos quadros Kanban de verdade):
   *   'entregue'  verde     concluído no prazo
   *   'tarde'     cinza     concluído com atraso
   *   'atrasado'  vermelho  passou do prazo e ainda não foi concluído
   *   'impossivel' vermelho não começou e já não dá tempo (vai vencer)
   *   'urgente'   amarelo   tem que começar/andar agora para dar tempo
   *   'ok'        neutro    dentro do prazo, com folga
   */
  function farolDoPrazo(estado, c) {
    if (c.coluna === 'concluido') return c.noPrazo ? 'entregue' : 'tarde';
    if (estado.rodada > c.prazo) return 'atrasado';
    let folga;
    if (c.coluna === 'backlog' || c.coluna === 'afazer') {
      const tempo = c.coluna === 'afazer' && c.responsavel ? tempoTotal(c, c.responsavel) : menorTempo(c);
      folga = c.prazo - (estado.rodada + tempo);
    } else {
      folga = c.prazo - rodadaDeRevisaoPrevista(estado, c);
    }
    if (folga < 0) return c.coluna === 'backlog' || c.coluna === 'afazer' ? 'impossivel' : 'atrasado';
    if (folga === 0) return 'urgente';
    return 'ok';
  }

  OG.estado = {
    ErroDeRegra,
    exigir,
    totalRodadas,
    ultimaRodada,
    projeto,
    projetoDaCarta,
    missaoPorId,
    pessoa,
    todasPessoas,
    coordenadores,
    voluntarios,
    ehCoordenador,
    ehVoluntario,
    naArea,
    ehEspecialista,
    forcaNecessaria,
    forcaVoluntario,
    forcaDaEquipe,
    forcaDaCarta,
    voluntariosSobrando,
    tempoComCoordenador,
    tempoTotal,
    carta,
    cartasNaColuna,
    entreguesNoPrazo,
    recursos,
    entradaAgenda,
    progressoMissao,
    situacaoMissao,
    missoesAbertas,
    definicaoEvento,
    eventoAtual,
    eventoAtivo,
    bloqueioDaCarta,
    registroTemporario,
    presente,
    rodadasRestantes,
    cartaLideradaPor,
    filaDe,
    cartaDoVoluntario,
    estaDoente,
    revisouNestaRodada,
    statusPessoa,
    voluntariosLivres,
    coordenadoresLivres,
    pessoasLivres,
    projetoParadoSeRevisar,
    impedimentoRevisor,
    rodadaDeRevisaoPrevista,
    terminaNoPrazo,
    terminaAntesDoFim,
    menorTempo,
    farolDoPrazo,
  };
})(globalThis);
