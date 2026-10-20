/*
 * pontuacao.js — pontuação final e resumo financeiro.
 *
 * Pontuação = dinheiro restante ÷ 10 (arredondado para baixo)
 *           + prestígio + tradição + projetos concluídos × 5
 * A recompensa da missão já entra no dinheiro/prestígio/tradição quando é conquistada.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function classificar(aproveitamento) {
    const lista = OG.regras.CLASSIFICACOES;
    for (let i = 0; i < lista.length; i++) {
      if (aproveitamento >= lista[i].minimo) return lista[i].nome;
    }
    return lista[lista.length - 1].nome;
  }

  const cacheMeta = {};

  /**
   * Meta da missão: a pontuação do melhor plano possível SEM eventos, com especialistas
   * em todas as vagas. Testa todas as combinações dos 6 cards que cabem nas vagas que
   * ainda dão tempo de concluir (2 vagas × 3 rodadas; projetos de 2 rodadas no máximo 1 por vaga).
   */
  function metaDaMissao(missaoId, caixaInicial) {
    const R = OG.regras;
    const caixa = caixaInicial === undefined ? R.CAIXA_INICIAL : caixaInicial;
    const chave = missaoId + ':' + caixa;
    if (cacheMeta[chave] !== undefined) return cacheMeta[chave];
    const m = OG.dados.missoesPorId[missaoId];
    const projs = m.projetos.map(function (id) { return OG.dados.projetosPorId[id]; });
    const capacidade = R.LIMITE_EM_ANDAMENTO * (R.TOTAL_RODADAS - 1);
    let melhor = 0;
    for (let mask = 0; mask < (1 << projs.length); mask++) {
      let tempo = 0;
      let longos = 0;
      let dinheiro = caixa;
      let prestigio = R.PRESTIGIO_INICIAL;
      let tradicao = R.TRADICAO_INICIAL;
      let n = 0;
      projs.forEach(function (p, i) {
        if (!(mask & (1 << i))) return;
        tempo += p.tempo;
        if (p.tempo > 1) longos++;
        dinheiro += p.retorno - p.custo + R.DESCONTO_ESPECIALISTA * p.trabalhadores;
        prestigio += p.prestigio;
        tradicao += p.tradicao;
        n++;
      });
      if (tempo > capacidade || longos > R.LIMITE_EM_ANDAMENTO) continue;
      if (n >= m.objetivo) {
        dinheiro += m.recompensa.dinheiro;
        prestigio += m.recompensa.prestigio;
        tradicao += m.recompensa.tradicao;
      }
      const pontos = Math.floor(dinheiro / R.REAIS_POR_PONTO) + prestigio + tradicao + n * R.PONTOS_POR_PROJETO;
      if (pontos > melhor) melhor = pontos;
    }
    cacheMeta[chave] = melhor;
    return melhor;
  }

  function caixaInicialDaPartida(estado) {
    return estado.livro
      .filter(function (l) { return l.tipo === 'inicial' && l.recurso === 'dinheiro'; })
      .reduce(function (s, l) { return s + l.valor; }, 0);
  }

  function calcular(estado) {
    const R = OG.regras;
    const rec = OG.estado.recursos(estado);
    const concluidos = OG.estado.totalConcluidos(estado);
    const itens = [
      {
        id: 'dinheiro',
        rotulo: 'Dinheiro restante',
        conta: OG.util.formatarDinheiro(rec.dinheiro) + ' ÷ ' + R.REAIS_POR_PONTO,
        pontos: Math.floor(rec.dinheiro / R.REAIS_POR_PONTO),
      },
      { id: 'prestigio', rotulo: 'Prestígio', conta: rec.prestigio + ' × 1', pontos: rec.prestigio },
      { id: 'tradicao', rotulo: 'Tradição', conta: rec.tradicao + ' × 1', pontos: rec.tradicao },
      {
        id: 'projetos',
        rotulo: 'Projetos concluídos',
        conta: concluidos + ' × ' + R.PONTOS_POR_PROJETO,
        pontos: concluidos * R.PONTOS_POR_PROJETO,
      },
    ];
    const total = itens.reduce(function (s, i) { return s + i.pontos; }, 0);
    const missao = OG.estado.missao(estado);
    const caixaInicial = caixaInicialDaPartida(estado);
    const meta = metaDaMissao(estado.missaoId, caixaInicial);
    // Os pontos que o Grêmio já tem no começo (caixa + prestígio + tradição iniciais)
    // não são mérito: o aproveitamento mede só o que foi CONQUISTADO na partida.
    const pontosIniciais = Math.floor(caixaInicial / R.REAIS_POR_PONTO) + R.PRESTIGIO_INICIAL + R.TRADICAO_INICIAL;
    const conquistado = total - pontosIniciais;
    const metaConquista = meta - pontosIniciais;
    const aproveitamento = Math.floor((conquistado * 100) / metaConquista);
    return {
      itens: itens,
      total: total,
      meta: meta,
      pontosIniciais: pontosIniciais,
      conquistado: conquistado,
      metaConquista: metaConquista,
      aproveitamento: aproveitamento,
      classificacao: classificar(aproveitamento),
      concluidos: concluidos,
      missaoCumprida: !!estado.missaoCumprida,
      objetivo: missao.objetivo,
      recompensa: missao.recompensa,
    };
  }

  /** Números para a aula de educação financeira da tela final. */
  function resumoFinanceiro(estado) {
    const r = {
      caixaInicial: 0,
      investido: 0, // custos pagos para iniciar projetos
      receitaProjetos: 0, // retornos recebidos de projetos concluídos
      outrasReceitas: 0, // patrocínio, professor, recompensa da missão
      despesas: 0, // despesas inesperadas pagas
      investimentoParado: 0, // custo de projetos pagos que não foram concluídos
      lucroProjetosConcluidos: 0,
      caixaFinal: OG.estado.recursos(estado).dinheiro,
    };
    estado.livro.forEach(function (l) {
      if (l.recurso !== 'dinheiro') return;
      if (l.tipo === 'inicial') r.caixaInicial += l.valor;
      else if (l.tipo === 'custo') r.investido += -l.valor;
      else if (l.tipo === 'retorno') r.receitaProjetos += l.valor;
      else if (l.tipo === 'despesa') r.despesas += -l.valor;
      else if (l.tipo === 'receita' || l.tipo === 'recompensa') r.outrasReceitas += l.valor;
    });
    estado.cartas.forEach(function (c) {
      if (c.custoPago === null) return;
      if (c.coluna === 'concluido') {
        r.lucroProjetosConcluidos += OG.estado.projetoDaCarta(c).retorno - c.custoPago;
      } else {
        r.investimentoParado += c.custoPago;
      }
    });
    return r;
  }

  OG.pontuacao = {
    classificar,
    metaDaMissao,
    calcular,
    resumoFinanceiro,
  };
})(globalThis);
