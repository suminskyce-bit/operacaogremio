/*
 * missoes.js — cada missão oferece exatamente 6 cards (uma seleção do catálogo).
 * objetivo: quantos projetos da missão precisam chegar em CONCLUÍDO.
 * recompensa: aplicada UMA vez, no momento em que o objetivo é atingido.
 *
 * Ajuste de balanceamento (ver README): as missões que pediam 3 projetos eram
 * cumpridas em 98–100% das partidas simuladas — virava formalidade. Todas passaram a
 * pedir 4 de 6, e todas têm exatamente um projeto de 2 rodadas (o "projeto grande").
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});
  OG.dados = OG.dados || {};

  function m(id, nome, descricao, objetivo, recompensa, projetos, objetivoOriginal) {
    return Object.freeze({
      id: id,
      nome: nome,
      descricao: descricao,
      objetivo: objetivo,
      objetivoOriginal: objetivoOriginal || objetivo,
      recompensa: Object.freeze({
        dinheiro: recompensa.dinheiro || 0,
        prestigio: recompensa.prestigio || 0,
        tradicao: recompensa.tradicao || 0,
      }),
      projetos: Object.freeze(projetos),
    });
  }

  const lista = [
    m('farroupilha', 'Festa Farroupilha',
      'Setembro chegou e o Mesquita vai celebrar a tradição gaúcha do jeito certo: com chimarrão, pilcha e música.',
      4, { dinheiro: 100, tradicao: 10 },
      ['mateada', 'pilcha', 'cuca', 'camp_concolor', 'tche_musica', 'deco_farroupilha']),

    m('junina', 'Festa Junina',
      'Bandeirinha, quentão sem álcool e a quadrilha mais ensaiada da história do Mesquita.',
      4, { dinheiro: 100, prestigio: 10 },
      ['deco_junina', 'barraca', 'pescaria', 'correio', 'quadrilha', 'som_festa']),

    m('halloween', 'Halloween Mesquita',
      'Os corredores do T11 vão ficar assustadores. O desafio é organizar tudo sem levar susto no caixa.',
      4, { prestigio: 15 },
      ['deco_terror', 'casa_terror', 'fantasias', 'cinema_terror', 'brawl_kids', 'divulga_halloween']),

    m('gamer', 'Torneio Gamer',
      'O laboratório vira arena. Brawl, EA FC e Minecraft — e muita extensão elétrica.',
      4, { prestigio: 15 },
      ['brawl_stars', 'ea_fc', 'minecraft', 'arena_gamer', 'transmissao', 'inscricoes'], 3),

    m('liga', 'Liga Mesquita',
      'A liga esportiva da escola, da quadra ao tabuleiro. Cuidado: a quadra vive em reforma.',
      4, { prestigio: 20, dinheiro: 100 },
      ['futsal', 'volei', 'xadrez', 'truco', 'queimada', 'atletismo'], 3),

    m('cultural', 'Semana Cultural',
      'Arte, música e tradição tomando conta da escola por uma semana inteira.',
      4, { tradicao: 15 },
      ['show_talentos', 'exposicao_arte', 'batalha_bandas', 'feira_cultural', 'sarau', 'danca_gaucha']),

    m('profissoes', 'Feira de Profissões',
      'Empresas, universidades e ex-alunos mostrando os caminhos depois do técnico.',
      4, { prestigio: 20 },
      ['convite_empresas', 'convite_universidades', 'palestra', 'estandes', 'oficina_curriculo', 'divulgacao'], 3),

    m('talentos', 'Show de Talentos',
      'Inscrições abertas para os talentos escondidos da gurizada. Palco, luz e coragem.',
      4, { prestigio: 20 },
      ['inscricoes', 'divulgacao', 'estrutura', 'apresentacao', 'premiacao', 'ensaio_geral']),

    m('estudante', 'Semana do Estudante',
      'Gincana, campeonato, festa e show: a semana mais esperada do ano letivo.',
      4, { prestigio: 20 },
      ['gincana', 'campeonato', 'festa', 'show', 'divulgacao', 'premiacao']),

    m('concolor', 'Campeonato Concolor',
      'O campeonato que para a escola. Preparação, inscrições, estrutura, divulgação e taça na mão.',
      4, { prestigio: 15, dinheiro: 100 },
      ['camp_concolor', 'preparacao', 'inscricoes', 'divulgacao', 'estrutura', 'premiacao'], 3),
  ];

  const porId = {};
  lista.forEach(function (missao) {
    if (porId[missao.id]) throw new Error('Missão duplicada: ' + missao.id);
    if (missao.projetos.length !== 6) throw new Error('A missão ' + missao.id + ' precisa ter 6 cards.');
    porId[missao.id] = missao;
  });

  OG.dados.missoes = Object.freeze(lista);
  OG.dados.missoesPorId = Object.freeze(porId);
})(globalThis);
