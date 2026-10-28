/*
 * motor.js — ponto único de entrada das regras.
 *
 *   const estado = OG.motor.criarPartida({ missaoId: 'farroupilha', duracao: 8, semente: 42 });
 *   const r = OG.motor.aplicar(estado, { tipo: 'PLANEJAR', cartaId: 'c1', responsavel: 'antune' });
 *   if (r.ok) estado = r.estado; else mostrar(r.erro);
 *
 * `aplicar` nunca altera o estado recebido: trabalha numa cópia e só devolve a cópia
 * se a ação inteira deu certo. Ação inválida = estado intacto + mensagem explicando.
 * `aplicarNoLugar` altera o próprio estado (uso interno do planejador, que valida antes).
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  /**
   * config: { missaoId, duracao (4, 8, 10 ou 26), semente, caixaApertado }
   * opcoes.eventosNeutros: true troca o baralho por "semanas tranquilas" (só para a meta).
   */
  function criarPartida(config, opcoes) {
    const R = OG.regras;
    const cfg = config || {};
    const missao = OG.dados.missoesPorId[cfg.missaoId];
    if (!missao) throw new Error('Missão desconhecida: ' + cfg.missaoId);
    const duracao = cfg.duracao === undefined ? R.DURACAO_PADRAO : cfg.duracao;
    if (!OG.regrasUtil.duracao(duracao)) throw new Error('Duração inválida: ' + duracao);
    const semente = (Number(cfg.semente) >>> 0) || 1;
    const apertado = !!cfg.caixaApertado;
    const caixaInicial = apertado ? R.CAIXA_APERTADO : R.CAIXA_INICIAL;
    const configFinal = { missaoId: cfg.missaoId, duracao: duracao, semente: semente, caixaApertado: apertado };
    const agenda = OG.agenda.montarAgenda(configFinal);

    const estado = {
      versao: R.VERSAO_ESTADO,
      config: configFinal,
      rng: semente,
      rodada: 1,
      fase: 'evento',
      agenda: agenda,
      programacao: OG.agenda.montarProgramacao(configFinal, agenda),
      cartas: [],
      arquivo: [],
      proximaOrdem: 0,
      baralho: [],
      eventoAtual: null,
      cartasMovidasNaRodada: [],
      revisoresDaRodada: [],
      doentes: [],
      temporarios: [],
      descontosPendentes: [],
      mutirao: null,
      pendente: null,
      resumo: null,
      livro: [
        { rodada: 1, recurso: 'dinheiro', valor: caixaInicial, tipo: 'inicial', descricao: 'Caixa inicial do Grêmio' },
        { rodada: 1, recurso: 'prestigio', valor: R.PRESTIGIO_INICIAL, tipo: 'inicial', descricao: 'Prestígio inicial' },
        { rodada: 1, recurso: 'tradicao', valor: R.TRADICAO_INICIAL, tipo: 'inicial', descricao: 'Tradição inicial' },
      ],
      historico: [
        {
          rodada: 1, tipo: 'sistema',
          texto: 'Partida iniciada: ' + duracao + ' rodadas, abrindo com ' + missao.nome + '.',
        },
      ],
    };

    if (opcoes && opcoes.eventosNeutros) {
      estado.baralho = new Array(duracao).fill(OG.dados.eventoNeutro.id);
    } else {
      estado.baralho = OG.eventos.montarBaralho(estado);
    }
    OG.agenda.receberChegadas(estado);
    OG.eventos.revelarEvento(estado);
    return estado;
  }

  function executar(estado, acao) {
    switch (acao.tipo) {
      case 'CONFIRMAR_EVENTO': return OG.eventos.confirmarEvento(estado, acao.escolha);
      case 'PLANEJAR': return OG.kanban.planejar(estado, acao.cartaId, acao.responsavel);
      case 'TROCAR_RESPONSAVEL': return OG.kanban.trocarResponsavel(estado, acao.cartaId, acao.responsavel);
      case 'DESPLANEJAR': return OG.kanban.desplanejar(estado, acao.cartaId);
      case 'INICIAR': return OG.kanban.iniciar(estado, acao.cartaId, acao.equipe);
      case 'REVISAR': return OG.kanban.revisar(estado, acao.cartaId, acao.revisorId);
      case 'COMPLETAR_EQUIPE': return OG.kanban.completarEquipe(estado, acao.cartaId, acao.pessoaId);
      case 'USAR_MUTIRAO': return OG.kanban.usarMutirao(estado, acao.cartaId);
      case 'ENCERRAR_RODADA': return OG.rodada.encerrarRodada(estado);
      case 'RESOLVER_DECISAO': return OG.rodada.resolverDecisao(estado, acao.escolha);
      case 'CANCELAR_ENCERRAMENTO': return OG.rodada.cancelarEncerramento(estado);
      case 'AVANCAR': return OG.rodada.avancar(estado);
      default: throw new OG.estado.ErroDeRegra('Ação desconhecida: ' + acao.tipo);
    }
  }

  function aplicar(estado, acao) {
    if (!acao || typeof acao.tipo !== 'string') {
      return { ok: false, erro: 'Ação inválida.', estado: estado };
    }
    // Proteção contra cliques "atrasados" (ex.: botão de uma rodada que já passou).
    if (acao.rodada !== undefined && acao.rodada !== estado.rodada) {
      return { ok: false, erro: 'Essa ação era da rodada ' + acao.rodada + '. O quadro já está na rodada ' + estado.rodada + '.', estado: estado };
    }
    const novo = OG.util.clonar(estado);
    try {
      executar(novo, acao);
      return { ok: true, estado: novo };
    } catch (erro) {
      if (erro instanceof OG.estado.ErroDeRegra) return { ok: false, erro: erro.message, estado: estado };
      throw erro;
    }
  }

  /** Aplica a ação no próprio estado. Lança ErroDeRegra se for inválida (o estado pode ficar pela metade). */
  function aplicarNoLugar(estado, acao) {
    executar(estado, acao);
    return estado;
  }

  OG.motor = {
    criarPartida,
    aplicar,
    aplicarNoLugar,
  };
})(globalThis);
