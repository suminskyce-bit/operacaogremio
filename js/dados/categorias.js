/*
 * categorias.js — categorias de projeto (usadas pelas especialidades) e riscos
 * (usados pelos eventos). Um projeto tem 1 categoria e 0 ou mais riscos.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});
  OG.dados = OG.dados || {};

  OG.dados.categorias = Object.freeze({
    cultura: Object.freeze({ id: 'cultura', nome: 'Cultura', icone: 'cultura' }),
    estrutura: Object.freeze({ id: 'estrutura', nome: 'Estrutura', icone: 'estrutura' }),
    divulgacao: Object.freeze({ id: 'divulgacao', nome: 'Divulgação', icone: 'divulgacao' }),
    esporte: Object.freeze({ id: 'esporte', nome: 'Esporte', icone: 'esporte' }),
    games: Object.freeze({ id: 'games', nome: 'Games', icone: 'games' }),
    logistica: Object.freeze({ id: 'logistica', nome: 'Logística e Vendas', icone: 'logistica' }),
  });

  OG.dados.riscos = Object.freeze({
    quadra: Object.freeze({
      id: 'quadra',
      nome: 'Usa a quadra',
      icone: 'quadra',
      evento: 'A Quadra Continua em Reforma',
    }),
    equipamento: Object.freeze({
      id: 'equipamento',
      nome: 'Depende de equipamento',
      icone: 'equipamento',
      evento: 'Aluguel de Equipamento',
    }),
    fornecedor: Object.freeze({
      id: 'fornecedor',
      nome: 'Depende de fornecedor',
      icone: 'fornecedor',
      evento: 'Fornecedor Foi Dar Banda',
    }),
    mesas: Object.freeze({
      id: 'mesas',
      nome: 'Precisa de mesas',
      icone: 'mesas',
      evento: 'Faltaram Mesas',
    }),
  });
})(globalThis);
