/*
 * estado.js — leitura do estado da partida (seletores) e erros de regra.
 *
 * Princípio: os números exibidos são SEMPRE derivados do estado real.
 * Caixa, prestígio e tradição não são contadores soltos: são a soma do livro-caixa
 * (`estado.livro`), onde cada lançamento tem rodada, tipo e motivo.
 * A ocupação de cada pessoa também é derivada (equipes dos cards, revisões, doença).
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

  // ---------- Dados ----------

  function projeto(id) {
    return OG.dados.projetosPorId[id] || null;
  }

  function projetoDaCarta(carta) {
    return projeto(carta.projetoId);
  }

  function missao(estado) {
    return OG.dados.missoesPorId[estado.missaoId] || null;
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
    return Object.keys(idx).map(function (id) {
      return idx[id];
    });
  }

  function ehCoordenador(id) {
    const p = pessoa(id);
    return !!p && p.papel === 'coordenador';
  }

  function ehEspecialista(p, proj) {
    if (!p || !proj) return false;
    const e = p.especialidade || {};
    if (e.coringa) return true;
    if (e.categorias && e.categorias.indexOf(proj.categoria) !== -1) return true;
    if (e.riscos && e.riscos.some(function (r) { return proj.riscos.indexOf(r) !== -1; })) return true;
    return false;
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

  function totalConcluidos(estado) {
    return cartasNaColuna(estado, 'concluido').length;
  }

  // ---------- Recursos (derivados do livro-caixa) ----------

  function recursos(estado) {
    const r = { dinheiro: 0, prestigio: 0, tradicao: 0 };
    estado.livro.forEach(function (l) {
      r[l.recurso] += l.valor;
    });
    return r;
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

  function cartaDaPessoa(estado, pessoaId) {
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

  /**
   * Situação de uma pessoa agora.
   * codigo: 'ausente' | 'doente' | 'ocupado' | 'revisando' | 'livre'
   */
  function statusPessoa(estado, pessoaId) {
    const p = pessoa(pessoaId);
    if (!p || !presente(estado, pessoaId)) {
      return { codigo: 'ausente', texto: 'Só aparece com o evento “Patrício Ajudou”' };
    }
    if (estaDoente(estado, pessoaId)) {
      return { codigo: 'doente', texto: 'Com influenza nesta rodada' };
    }
    const c = cartaDaPessoa(estado, pessoaId);
    if (c) {
      return { codigo: 'ocupado', texto: 'Em ' + projetoDaCarta(c).nome, cartaId: c.id };
    }
    if (estado.revisoresDaRodada.indexOf(pessoaId) !== -1) {
      return { codigo: 'revisando', texto: 'Revisou um projeto nesta rodada' };
    }
    return { codigo: 'livre', texto: 'Disponível' };
  }

  function pessoasLivres(estado) {
    return todasPessoas().filter(function (p) {
      return statusPessoa(estado, p.id).codigo === 'livre';
    });
  }

  function coordenadoresLivres(estado) {
    return pessoasLivres(estado).filter(function (p) {
      return p.papel === 'coordenador';
    });
  }

  /** Rodada em que um projeto iniciado agora ficaria pronto para revisão e se ainda dá tempo de concluir. */
  function terminaATempo(estado, c) {
    const proj = projetoDaCarta(c);
    const restante = proj.tempo - c.progresso;
    // Executa nas rodadas atual..atual+restante-1 e é revisado na rodada seguinte.
    return estado.rodada + restante <= OG.regras.TOTAL_RODADAS;
  }

  OG.estado = {
    ErroDeRegra,
    exigir,
    projeto,
    projetoDaCarta,
    missao,
    pessoa,
    todasPessoas,
    ehCoordenador,
    ehEspecialista,
    carta,
    cartasNaColuna,
    totalConcluidos,
    recursos,
    definicaoEvento,
    eventoAtual,
    eventoAtivo,
    bloqueioDaCarta,
    registroTemporario,
    presente,
    rodadasRestantes,
    cartaDaPessoa,
    estaDoente,
    statusPessoa,
    pessoasLivres,
    coordenadoresLivres,
    terminaATempo,
  };
})(globalThis);
