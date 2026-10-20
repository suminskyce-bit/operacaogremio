/*
 * financas.js — livro-caixa, custo de projetos (com descontos) e despesas.
 *
 * Regras:
 *  - Caixa nunca fica negativo (não existe dívida nesta versão).
 *  - Prestígio e tradição nunca ficam abaixo de 0.
 *  - Custo final = custo base − 50% (se houver Doação do Sindicato)
 *                   − R$ 10 por especialista na equipe
 *                   − R$ 40 (se houver Material Encontrado)
 *    nunca abaixo de R$ 0. Descontos pendentes são consumidos pelo PRÓXIMO projeto iniciado.
 *  - Despesa obrigatória sem caixa suficiente: paga-se o que houver e o que faltar
 *    vira desgaste: −1 Prestígio a cada R$ 10 (arredondado para cima).
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function lancar(estado, recurso, valor, tipo, descricao) {
    if (!valor) return 0;
    const atual = OG.estado.recursos(estado)[recurso];
    let aplicado = valor;
    if (atual + valor < 0) {
      if (recurso === 'dinheiro') {
        // Nunca deveria acontecer: toda cobrança valida o caixa antes.
        throw new Error('Erro interno: o caixa ficaria negativo (' + descricao + ').');
      }
      aplicado = -atual;
    }
    if (aplicado === 0) return 0;
    estado.livro.push({
      rodada: estado.rodada,
      recurso: recurso,
      valor: aplicado,
      tipo: tipo,
      descricao: descricao,
    });
    return aplicado;
  }

  function caixa(estado) {
    return OG.estado.recursos(estado).dinheiro;
  }

  /**
   * Calcula o custo de iniciar o card com a equipe informada.
   * Retorna { base, itens: [{rotulo, valor}], final, jaPago, especialistas }
   */
  function calcularCusto(estado, carta, equipe) {
    const E = OG.estado;
    const proj = E.projetoDaCarta(carta);
    const ids = Array.isArray(equipe) ? equipe : [];
    const especialistas = ids.filter(function (id) {
      return E.ehEspecialista(E.pessoa(id), proj);
    });

    if (carta.custoPago !== null) {
      return { base: proj.custo, itens: [], final: 0, jaPago: true, especialistas: especialistas };
    }

    const itens = [];
    let valor = proj.custo;

    estado.descontosPendentes
      .filter(function (d) { return d.tipo === 'percentual'; })
      .forEach(function (d) {
        const desconto = Math.floor((valor * d.valor) / 100);
        if (desconto > 0) {
          itens.push({ rotulo: d.origem + ' (−' + d.valor + '%)', valor: -desconto });
          valor -= desconto;
        }
      });

    especialistas.forEach(function (id) {
      itens.push({ rotulo: 'Especialista: ' + E.pessoa(id).nome, valor: -OG.regras.DESCONTO_ESPECIALISTA });
      valor -= OG.regras.DESCONTO_ESPECIALISTA;
    });

    estado.descontosPendentes
      .filter(function (d) { return d.tipo === 'fixo'; })
      .forEach(function (d) {
        itens.push({ rotulo: d.origem, valor: -d.valor });
        valor -= d.valor;
      });

    return {
      base: proj.custo,
      itens: itens,
      final: Math.max(0, valor),
      jaPago: false,
      especialistas: especialistas,
    };
  }

  /** Despesa sem alternativa: paga o que der; o resto vira desgaste de prestígio. */
  function cobrarDespesaObrigatoria(estado, despesaId) {
    const desp = OG.dados.despesas[despesaId];
    const disponivel = caixa(estado);
    const pago = Math.min(desp.valor, disponivel);
    if (pago > 0) lancar(estado, 'dinheiro', -pago, 'despesa', desp.nome);
    const falta = desp.valor - pago;
    let desgaste = 0;
    if (falta > 0) {
      desgaste = Math.ceil(falta / OG.regras.REAIS_POR_PONTO_DE_DESGASTE);
      desgaste = -lancar(
        estado,
        'prestigio',
        -desgaste,
        'desgaste',
        'Faltou ' + OG.util.formatarDinheiro(falta) + ' para pagar: ' + desp.nome
      );
    }
    return { pago: pago, falta: falta, desgaste: desgaste, despesa: desp };
  }

  /** Despesa que o jogador escolheu pagar: exige caixa suficiente. */
  function pagarDespesaOpcional(estado, despesaId) {
    const desp = OG.dados.despesas[despesaId];
    OG.estado.exigir(
      caixa(estado) >= desp.valor,
      'Caixa insuficiente para pagar ' + desp.nome + ' (' + OG.util.formatarDinheiro(desp.valor) + ').'
    );
    lancar(estado, 'dinheiro', -desp.valor, 'despesa', desp.nome);
    return desp;
  }

  OG.financas = {
    lancar,
    caixa,
    calcularCusto,
    cobrarDespesaObrigatoria,
    pagarDespesaOpcional,
  };
})(globalThis);
