/*
 * pontuacao.js — pontuação final, meta da partida e resumo financeiro.
 *
 * Pontuação = dinheiro restante ÷ 10 (arredondado para baixo)
 *           + prestígio + tradição + projetos entregues NO PRAZO × 5
 * Recompensas de missão já entram no dinheiro/prestígio/tradição quando são conquistadas.
 *
 * Classificação (aproveitamento): pontos conquistados na partida ÷ pontos que o
 * planejador do jogo conquistaria na MESMA partida (mesma agenda e mesmos pedidos),
 * sem imprevistos. "Conquistados" = pontuação − pontos com que o Grêmio começou.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function R() { return OG.regras; }
  function E() { return OG.estado; }

  function classificar(aproveitamento) {
    const lista = R().CLASSIFICACOES;
    for (let i = 0; i < lista.length; i++) {
      if (aproveitamento >= lista[i].minimo) return lista[i].nome;
    }
    return lista[lista.length - 1].nome;
  }

  function caixaInicial(config) {
    return config.caixaApertado ? R().CAIXA_APERTADO : R().CAIXA_INICIAL;
  }

  function pontosIniciais(config) {
    return Math.floor(caixaInicial(config) / R().REAIS_POR_PONTO) + R().PRESTIGIO_INICIAL + R().TRADICAO_INICIAL;
  }

  /** Pontos de um estado (sem a meta). */
  function pontosDe(estado) {
    const rec = E().recursos(estado);
    const entregues = E().entreguesNoPrazo(estado).length;
    return Math.floor(rec.dinheiro / R().REAIS_POR_PONTO) + rec.prestigio + rec.tradicao + entregues * R().PONTOS_POR_PROJETO;
  }

  const cacheMeta = {};

  /**
   * Meta da partida: o planejador joga a mesma partida sem imprevistos.
   * Depende só da configuração (missão, duração, semente, caixa), então dá para recalcular
   * a qualquer momento e o valor salvo no navegador não precisa ser confiável.
   */
  function metaDaPartida(config) {
    const chave = [config.missaoId, config.duracao, config.semente, config.caixaApertado ? 1 : 0].join('|');
    if (cacheMeta[chave]) return cacheMeta[chave];
    const fim = OG.planejador.simular(config, { eventosNeutros: true });
    const total = pontosDe(fim);
    const meta = {
      total: total,
      conquistado: total - pontosIniciais(config),
      entregues: E().entreguesNoPrazo(fim).length,
      missoesCumpridas: fim.agenda.filter(function (a) { return a.cumprida; }).length,
    };
    cacheMeta[chave] = meta;
    return meta;
  }

  function calcular(estado) {
    const rec = E().recursos(estado);
    const entregues = E().entreguesNoPrazo(estado).length;
    const atrasados = estado.cartas.filter(function (c) { return c.coluna === 'concluido' && c.noPrazo === false; }).length;
    const itens = [
      {
        id: 'dinheiro',
        rotulo: 'Dinheiro restante',
        conta: OG.util.formatarDinheiro(rec.dinheiro) + ' ÷ ' + R().REAIS_POR_PONTO,
        pontos: Math.floor(rec.dinheiro / R().REAIS_POR_PONTO),
      },
      { id: 'prestigio', rotulo: 'Prestígio', conta: rec.prestigio + ' × 1', pontos: rec.prestigio },
      { id: 'tradicao', rotulo: 'Tradição', conta: rec.tradicao + ' × 1', pontos: rec.tradicao },
      {
        id: 'projetos',
        rotulo: 'Projetos entregues no prazo',
        conta: entregues + ' × ' + R().PONTOS_POR_PROJETO,
        pontos: entregues * R().PONTOS_POR_PROJETO,
      },
    ];
    const total = itens.reduce(function (s, i) { return s + i.pontos; }, 0);
    const iniciais = pontosIniciais(estado.config);
    const conquistado = total - iniciais;
    const meta = metaDaPartida(estado.config);
    const metaConquista = Math.max(1, meta.conquistado);
    const aproveitamento = Math.floor((conquistado * 100) / metaConquista);
    const missoes = estado.agenda.map(function (a) {
      const m = E().missaoPorId(a.missaoId);
      return {
        missaoId: a.missaoId,
        nome: m.nome,
        abre: a.abre,
        data: a.data,
        situacao: E().situacaoMissao(estado, a),
        progresso: E().progressoMissao(estado, a.missaoId),
        objetivo: m.objetivo,
        recompensa: m.recompensa,
      };
    });
    return {
      itens: itens,
      total: total,
      entregues: entregues,
      atrasados: atrasados,
      pontosIniciais: iniciais,
      conquistado: conquistado,
      meta: meta,
      metaConquista: metaConquista,
      aproveitamento: aproveitamento,
      classificacao: classificar(aproveitamento),
      missoes: missoes,
      missoesCumpridas: missoes.filter(function (m) { return m.situacao === 'cumprida'; }).length,
    };
  }

  /** Números para a aula de educação financeira (tela final e aba Finanças). */
  function resumoFinanceiro(estado) {
    const r = {
      caixaInicial: 0,
      investido: 0, // custos pagos para iniciar projetos
      receitaProjetos: 0, // retornos recebidos (inclui metade dos atrasados)
      outrasReceitas: 0, // patrocínio, professor, recompensas de missão
      despesas: 0, // despesas inesperadas pagas
      investimentoParado: 0, // pago e não concluído (em andamento, revisão, devolvido ou vencido)
      lucroProjetosConcluidos: 0,
      perdaPorAtraso: 0, // retorno que deixou de entrar por entregar depois do prazo
      caixaFinal: E().recursos(estado).dinheiro,
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
        r.lucroProjetosConcluidos += c.retornoRecebido - c.custoPago;
        if (!c.noPrazo) r.perdaPorAtraso += E().projetoDaCarta(c).retorno - c.retornoRecebido;
      } else {
        r.investimentoParado += c.custoPago;
      }
    });
    estado.arquivo.forEach(function (a) {
      if (a.custoPago) r.investimentoParado += a.custoPago;
    });
    return r;
  }

  OG.pontuacao = {
    classificar,
    pontosIniciais,
    pontosDe,
    metaDaPartida,
    calcular,
    resumoFinanceiro,
  };
})(globalThis);
