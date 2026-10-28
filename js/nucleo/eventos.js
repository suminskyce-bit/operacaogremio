/*
 * eventos.js (núcleo) — baralho, revelação, efeitos imediatos e efeitos de fim de rodada.
 *
 * Ciclo de um evento:
 *   1. revelarEvento: no início da rodada, a carta é virada (fase 'evento').
 *      Sorteios (ex.: quem pegou influenza) acontecem aqui e ficam salvos.
 *   2. confirmarEvento: aplica o efeito imediato UMA vez (guardado por `resolvido`).
 *   3. Durante a rodada valem as restrições (chimarrão, provas, impressora, quadra).
 *   4. No fim da rodada, decisaoFimRodada/aplicarDecisaoFimRodada resolvem os efeitos
 *      que dependem dos projetos em andamento (reunião, fornecedor, equipamento, mesas).
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function E() { return OG.estado; }
  function F() { return OG.financas; }
  function fmt(v) { return OG.util.formatarDinheiro(v); }
  function exigir(c, m) { OG.estado.exigir(c, m); }

  function historico(estado, tipo, texto) {
    estado.historico.push({ rodada: estado.rodada, tipo: tipo, texto: texto });
  }

  // ---------------- Baralho ----------------

  // Eventos que travam a rodada inteira. Na rodada 1 eles seriam só punição (ainda não
  // há nada para terminar) e dois no mesmo bloco de 4 rodadas tornavam a missão quase impossível.
  const SEVEROS = ['ev_chimarrao', 'ev_provas'];
  const BLOCO = 4;

  /**
   * Monta um evento para cada rodada da partida. Regras de composição:
   *  - os 20 eventos aparecem antes de qualquer repetição (partidas longas reembaralham);
   *  - nunca o mesmo evento em duas rodadas seguidas;
   *  - em cada bloco de 4 rodadas: pelo menos 1 evento positivo e no máximo 1 severo
   *    (Chimarrão ou Provas);
   *  - nunca evento severo na rodada 1.
   */
  function montarBaralho(estado) {
    const n = estado.config.duracao;
    const todos = OG.dados.eventos.map(function (ev) { return ev.id; });
    const tipo = function (id) { return OG.dados.eventosPorId[id].tipo; };
    let pilha = OG.util.embaralhar(estado, todos);
    const mao = [];

    for (let i = 0; i < n; i++) {
      const inicioBloco = Math.floor(i / BLOCO) * BLOCO;
      const ultimoDoBloco = Math.min(inicioBloco + BLOCO, n) - 1;
      const bloco = mao.slice(inicioBloco, i);
      const severosNoBloco = bloco.filter(function (id) { return SEVEROS.indexOf(id) !== -1; }).length;
      const precisaPositivo = i === ultimoDoBloco && !bloco.some(function (id) { return tipo(id) === 'positivo'; });
      const serve = function (id) {
        if (i > 0 && mao[i - 1] === id) return false;
        if (SEVEROS.indexOf(id) !== -1 && (i === 0 || severosNoBloco >= 1)) return false;
        if (precisaPositivo && tipo(id) !== 'positivo') return false;
        return true;
      };
      let indice = pilha.findIndex(serve);
      if (indice === -1) {
        pilha = pilha.concat(OG.util.embaralhar(estado, todos));
        indice = pilha.findIndex(serve);
      }
      mao.push(pilha.splice(indice, 1)[0]);
      if (!pilha.length) pilha = OG.util.embaralhar(estado, todos);
    }
    return mao;
  }

  // ---------------- Revelação ----------------

  function revelarEvento(estado) {
    const id = estado.baralho[estado.rodada - 1];
    const def = E().definicaoEvento(id);
    exigir(!!def, 'Evento desconhecido no baralho.');
    const ev = { id: id, rodada: estado.rodada, resolvido: false, alvo: null, escolha: null, escolhaFim: null };

    if (id === 'ev_influenza') {
      const livres = E().pessoasLivres(estado);
      if (livres.length) ev.alvo = livres[OG.util.inteiroAleatorio(estado, livres.length)].id;
    }

    estado.eventoAtual = ev;
    estado.fase = 'evento';
    historico(estado, 'evento', 'Rodada ' + estado.rodada + ' — evento: ' + def.nome + '.');
  }

  // ---------------- Opções da carta ----------------

  function opcaoDespesaObrigatoria(estado, despesaId) {
    const desp = OG.dados.despesas[despesaId];
    const caixa = F().caixa(estado);
    if (caixa >= desp.valor) {
      return [{ id: 'ok', rotulo: 'Pagar ' + fmt(desp.valor), habilitado: true }];
    }
    const falta = desp.valor - caixa;
    const desgaste = Math.ceil(falta / OG.regras.REAIS_POR_PONTO_DE_DESGASTE);
    return [{
      id: 'ok',
      rotulo: 'Pagar ' + fmt(caixa) + ' (faltam ' + fmt(falta) + ': −' + desgaste + ' Prestígio)',
      habilitado: true,
    }];
  }

  /** Botões da carta revelada. Sempre há pelo menos uma opção habilitada. */
  function opcoesEvento(estado) {
    const ev = estado.eventoAtual;
    if (!ev || estado.fase !== 'evento') return [];
    const def = E().definicaoEvento(ev.id);

    switch (ev.id) {
      case 'ev_impressoes': {
        const valor = OG.dados.despesas.impressoes.valor;
        const pode = F().caixa(estado) >= valor;
        return [
          { id: 'pagar', rotulo: 'Pagar ' + fmt(valor), habilitado: pode, motivo: pode ? null : 'Caixa insuficiente.' },
          { id: 'recusar', rotulo: 'Recusar (−' + def.perdaSeRecusar.prestigio + ' Prestígio)', habilitado: true },
        ];
      }
      case 'ev_reuniao':
        return opcaoDespesaObrigatoria(estado, 'reuniao');
      case 'ev_transporte':
        return opcaoDespesaObrigatoria(estado, 'transporte');
      case 'ev_limpeza':
        return opcaoDespesaObrigatoria(estado, 'limpeza');
      default:
        return [{ id: 'ok', rotulo: def.tipo === 'positivo' ? 'Bah, que beleza!' : 'Entendi', habilitado: true }];
    }
  }

  // ---------------- Efeito imediato ----------------

  function confirmarEvento(estado, escolha) {
    exigir(estado.fase === 'evento', 'Não há evento esperando confirmação.');
    const ev = estado.eventoAtual;
    exigir(!!ev && !ev.resolvido && ev.rodada === estado.rodada, 'Este evento já foi resolvido.');
    const opcoes = opcoesEvento(estado);
    const escolhaFinal = escolha || (opcoes.length === 1 ? opcoes[0].id : null);
    const opcao = opcoes.find(function (o) { return o.id === escolhaFinal; });
    exigir(!!opcao, 'Escolha uma das opções do evento.');
    exigir(opcao.habilitado, opcao.motivo || 'Opção indisponível.');

    const def = E().definicaoEvento(ev.id);
    const R = OG.regras;

    switch (ev.id) {
      case 'ev_reuniao':
      case 'ev_transporte':
      case 'ev_limpeza': {
        const r = F().cobrarDespesaObrigatoria(estado, def.despesa);
        let texto = 'Despesa — ' + r.despesa.nome + ': pago ' + fmt(r.pago) + '.';
        if (r.falta > 0) texto += ' Faltou ' + fmt(r.falta) + ' no caixa: −' + r.desgaste + ' Prestígio.';
        historico(estado, 'dinheiro', texto);
        break;
      }
      case 'ev_impressoes': {
        if (escolhaFinal === 'pagar') {
          F().pagarDespesaOpcional(estado, 'impressoes');
          historico(estado, 'dinheiro', 'Despesa — Impressões de Última Hora: pago ' + fmt(OG.dados.despesas.impressoes.valor) + '.');
        } else {
          const perdeu = -F().lancar(estado, 'prestigio', -def.perdaSeRecusar.prestigio, 'penalidade', 'Recusou: Impressões de Última Hora');
          historico(estado, 'evento', 'Impressões de Última Hora recusadas: −' + perdeu + ' Prestígio.');
        }
        break;
      }
      case 'ev_influenza': {
        if (ev.alvo) {
          estado.doentes.push({ pessoaId: ev.alvo, rodada: estado.rodada });
          historico(estado, 'evento', E().pessoa(ev.alvo).nome + ' pegou influenza e não trabalha nesta rodada.');
        } else {
          historico(estado, 'evento', 'Ninguém estava livre para pegar influenza. Ufa!');
        }
        break;
      }
      case 'ev_post': {
        const perdeu = -F().lancar(estado, 'prestigio', -def.perda.prestigio, 'penalidade', 'Divulgação Deu Ruim');
        historico(estado, 'evento', 'Divulgação deu ruim: −' + perdeu + ' Prestígio.');
        break;
      }
      case 'ev_patrocinio':
        F().lancar(estado, 'dinheiro', def.ganho.dinheiro, 'receita', 'Patrocínio da Concolores');
        historico(estado, 'dinheiro', 'Patrocínio da Concolores: +' + fmt(def.ganho.dinheiro) + '.');
        break;
      case 'ev_viral':
        F().lancar(estado, 'prestigio', def.ganho.prestigio, 'bonus', 'Divulgação Viral');
        historico(estado, 'evento', 'Divulgação viral: +' + def.ganho.prestigio + ' Prestígio.');
        break;
      case 'ev_professor':
        F().lancar(estado, 'dinheiro', def.ganho.dinheiro, 'receita', 'Professor Resolveu Ajudar');
        F().lancar(estado, 'prestigio', def.ganho.prestigio, 'bonus', 'Professor Resolveu Ajudar');
        historico(estado, 'dinheiro', 'Professor resolveu ajudar: +' + fmt(def.ganho.dinheiro) + ' e +' + def.ganho.prestigio + ' Prestígio.');
        break;
      case 'ev_patricio': {
        // Se ele já estava (evento repetido numa partida longa), a estadia é renovada.
        const ate = estado.rodada + R.DURACAO_TEMPORARIO - 1;
        estado.temporarios = estado.temporarios.filter(function (t) { return t.pessoaId !== 'patricio'; });
        estado.temporarios.push({ pessoaId: 'patricio', ateRodada: ate });
        historico(estado, 'evento', 'Patrício chegou como temporário e fica até o fim da rodada ' +
          Math.min(ate, E().totalRodadas(estado)) + '.');
        break;
      }
      case 'ev_sindicato':
      case 'ev_material': {
        const origem = ev.id === 'ev_sindicato' ? 'Doação do Sindicato' : 'Material Encontrado';
        estado.descontosPendentes.push({ tipo: def.desconto.tipo, valor: def.desconto.valor, origem: origem });
        historico(estado, 'evento', origem + ': o próximo projeto iniciado ganha desconto.');
        break;
      }
      case 'ev_mutirao':
        estado.mutirao = { rodada: estado.rodada, usado: false };
        historico(estado, 'evento', 'Mutirão disponível nesta rodada: +1 de progresso em um card EM ANDAMENTO.');
        break;
      default:
        // Restrições de rodada (chimarrão, provas, impressora, quadra) e efeitos de fim
        // de rodada (fornecedor, equipamento, mesas) não mexem em nada agora.
        break;
    }

    ev.resolvido = true;
    ev.escolha = escolhaFinal;
    estado.fase = 'planejamento';
  }

  // ---------------- Fim de rodada ----------------

  function alvosComRisco(estado, risco) {
    return E().cartasNaColuna(estado, 'andamento').filter(function (c) {
      return E().projetoDaCarta(c).riscos.indexOf(risco) !== -1;
    });
  }

  function opcaoPagar(estado, despesaId, descricao) {
    const valor = OG.dados.despesas[despesaId].valor;
    const pode = F().caixa(estado) >= valor;
    return {
      id: 'pagar',
      rotulo: 'Pagar ' + fmt(valor),
      descricao: descricao,
      habilitado: pode,
      motivo: pode ? null : 'Caixa insuficiente (' + fmt(F().caixa(estado)) + ').',
    };
  }

  /**
   * Decisão pendente do evento para o fim da rodada, ou null se não há nada a decidir.
   * { eventoId, titulo, pergunta, opcoes: [{id, rotulo, descricao, habilitado, motivo}] }
   */
  function decisaoFimRodada(estado) {
    const ev = estado.eventoAtual;
    if (!ev || ev.rodada !== estado.rodada || !ev.resolvido) return null;
    const def = E().definicaoEvento(ev.id);
    const nome = function (c) { return E().projetoDaCarta(c).nome; };

    switch (ev.id) {
      case 'ev_reuniao': {
        const alvos = E().cartasNaColuna(estado, 'andamento');
        if (!alvos.length) return null;
        return {
          eventoId: ev.id,
          titulo: def.nome,
          pergunta: 'A reunião tomou o tempo da equipe. Qual projeto fica parado nesta rodada?',
          opcoes: alvos.map(function (c) {
            return { id: 'parar:' + c.id, rotulo: nome(c) + ' fica parado', descricao: 'Não ganha progresso nesta rodada.', habilitado: true };
          }),
        };
      }
      case 'ev_fornecedor': {
        const alvos = alvosComRisco(estado, 'fornecedor');
        if (!alvos.length) return null;
        return {
          eventoId: ev.id,
          titulo: def.nome,
          pergunta: 'O fornecedor não entregou. Pagar o extra ou deixar o projeto voltar?',
          opcoes: [opcaoPagar(estado, 'fornecedor', 'O material chega e tudo segue normal.')].concat(
            alvos.map(function (c) {
              return {
                id: 'voltar:' + c.id,
                rotulo: 'Não pagar: ' + nome(c) + ' volta para A FAZER',
                descricao: 'Perde o progresso e libera a equipe. O custo não é cobrado de novo quando recomeçar.',
                habilitado: true,
              };
            })
          ),
        };
      }
      case 'ev_equipamento': {
        const alvos = alvosComRisco(estado, 'equipamento');
        if (!alvos.length) return null;
        const nomes = OG.util.listaPt(alvos.map(nome));
        return {
          eventoId: ev.id,
          titulo: def.nome,
          pergunta: 'Sem o equipamento da escola, ' + nomes + ' não ' + (alvos.length > 1 ? 'andam' : 'anda') + '. Alugar?',
          opcoes: [
            opcaoPagar(estado, 'equipamento', 'Aluga o equipamento e tudo segue normal.'),
            { id: 'parar', rotulo: 'Não alugar: ' + nomes + (alvos.length > 1 ? ' ficam parados' : ' fica parado'), descricao: 'Sem progresso nesta rodada.', habilitado: true },
          ],
        };
      }
      case 'ev_mesas': {
        const alvos = alvosComRisco(estado, 'mesas');
        if (!alvos.length) return null;
        return {
          eventoId: ev.id,
          titulo: def.nome,
          pergunta: 'Faltaram mesas. Pagar o aluguel ou um projeto perde a rodada?',
          opcoes: [opcaoPagar(estado, 'mesas', 'As mesas chegam e tudo segue normal.')].concat(
            alvos.map(function (c) {
              return { id: 'parar:' + c.id, rotulo: 'Não pagar: ' + nome(c) + ' fica parado', descricao: 'Sem progresso nesta rodada.', habilitado: true };
            })
          ),
        };
      }
      default:
        return null;
    }
  }

  /** Aplica a escolha de fim de rodada. Retorna os cards parados e mensagens do resumo. */
  function aplicarDecisaoFimRodada(estado, escolha) {
    const dec = decisaoFimRodada(estado);
    exigir(!!dec, 'Não há decisão de evento pendente.');
    const opcao = dec.opcoes.find(function (o) { return o.id === escolha; });
    exigir(!!opcao, 'Escolha uma das opções.');
    exigir(opcao.habilitado, opcao.motivo || 'Opção indisponível.');

    const def = E().definicaoEvento(dec.eventoId);
    const paradas = [];
    const mensagens = [];

    if (escolha === 'pagar') {
      const desp = F().pagarDespesaOpcional(estado, def.despesa);
      mensagens.push(def.nome + ': pago ' + fmt(desp.valor) + '. Tudo seguiu normal.');
      historico(estado, 'dinheiro', 'Despesa — ' + desp.nome + ': pago ' + fmt(desp.valor) + '.');
    } else if (escolha === 'parar') {
      alvosComRisco(estado, def.risco).forEach(function (c) { paradas.push(c.id); });
    } else if (escolha.indexOf('parar:') === 0) {
      paradas.push(escolha.slice(6));
    } else if (escolha.indexOf('voltar:') === 0) {
      const c = E().carta(estado, escolha.slice(7));
      const proj = E().projetoDaCarta(c);
      c.coluna = 'afazer';
      c.ordem = estado.proximaOrdem++;
      c.progresso = 0;
      c.tempoTotal = null;
      c.iniciadoNaRodada = null;
      c.equipe = [];
      mensagens.push(def.nome + ': ' + proj.nome + ' voltou para A FAZER com ' + E().pessoa(c.responsavel).nome +
        ' (o custo já pago continua valendo).');
      historico(estado, 'evento', def.nome + ': ' + proj.nome + ' voltou para A FAZER.');
    }

    estado.eventoAtual.escolhaFim = escolha;
    return { paradas: paradas, mensagens: mensagens, motivo: def.nome };
  }

  OG.eventos = {
    SEVEROS,
    montarBaralho,
    revelarEvento,
    opcoesEvento,
    confirmarEvento,
    decisaoFimRodada,
    aplicarDecisaoFimRodada,
  };
})(globalThis);
