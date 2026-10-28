/*
 * eventos.js — despesas e baralho de eventos.
 *
 * Um evento é sorteado no INÍCIO de cada rodada e vale para a rodada inteira:
 *   quando: 'agora'  -> o efeito acontece ao confirmar a carta
 *   quando: 'rodada' -> restrição que vale durante toda a rodada
 *   quando: 'fim'    -> o efeito é resolvido no fim da rodada (dá para se preparar)
 * A lógica de cada efeito fica em js/nucleo/eventos.js (procure pelo id).
 * ganho / perda / perdaSeRecusar: valores do efeito imediato (usados pelo núcleo e
 * pela validação da partida salva, que confere se cada lançamento tem um evento que o explica).
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});
  OG.dados = OG.dados || {};

  OG.dados.despesas = Object.freeze({
    reuniao: Object.freeze({
      id: 'reuniao',
      nome: 'Reunião com a Diretora',
      texto: 'A Direção convocou o Grêmio para uma reunião urgente.',
      valor: 30,
    }),
    impressoes: Object.freeze({
      id: 'impressoes',
      nome: 'Impressões de Última Hora',
      texto: 'Precisamos de mais cartazes para divulgar o evento.',
      valor: 40,
    }),
    equipamento: Object.freeze({
      id: 'equipamento',
      nome: 'Aluguel de Equipamento',
      texto: 'O equipamento da escola não está disponível.',
      valor: 60,
    }),
    mesas: Object.freeze({
      id: 'mesas',
      nome: 'Faltaram Mesas',
      texto: 'Alguém esqueceu de reservar as mesas.',
      valor: 50,
    }),
    transporte: Object.freeze({
      id: 'transporte',
      nome: 'Transporte',
      texto: 'Precisamos buscar os materiais do evento.',
      valor: 40,
    }),
    limpeza: Object.freeze({
      id: 'limpeza',
      nome: 'Limpeza Extra',
      texto: 'Depois da festa, alguém precisa limpar tudo.',
      valor: 30,
    }),
    // Não é carta de despesa: é o pagamento opcional do evento negativo
    // "Fornecedor Foi Dar Banda". Fica aqui só para o histórico financeiro.
    fornecedor: Object.freeze({
      id: 'fornecedor',
      nome: 'Fornecedor Foi Dar Banda',
      texto: 'Pagamento extra para o fornecedor finalmente entregar.',
      valor: 50,
      carta: false,
    }),
  });

  function e(id, tipo, nome, texto, efeito, quando, extra) {
    const x = extra || {};
    Object.keys(x).forEach(function (k) {
      if (x[k] && typeof x[k] === 'object') Object.freeze(x[k]);
    });
    return Object.freeze(Object.assign({ id: id, tipo: tipo, nome: nome, texto: texto, efeito: efeito, quando: quando }, x));
  }

  const lista = [
    // ---------------- Negativos ----------------
    e('ev_reuniao', 'negativo', 'Reunião com a Diretora',
      'A Direção convocou o Grêmio para uma reunião.',
      'Pague R$ 30 agora. No fim da rodada, um projeto EM ANDAMENTO fica parado (não ganha progresso). Se houver mais de um, você escolhe qual.',
      'fim', { despesa: 'reuniao' }),
    e('ev_influenza', 'negativo', 'Funcionário Pegou Influenza',
      'O atestado chegou antes do trabalhador.',
      'Uma pessoa livre, sorteada (voluntário fora de equipe ou coordenador sem projeto em andamento), fica indisponível nesta rodada: não entra em equipe, não começa projeto e não revisa.',
      'agora'),
    e('ev_fornecedor', 'negativo', 'Fornecedor Foi Dar Banda',
      'O fornecedor disse que estava chegando. Não chegou.',
      'No fim da rodada, se houver projeto que depende de fornecedor EM ANDAMENTO: pague R$ 50 ou um deles volta para A FAZER (perde o progresso; o custo não é cobrado de novo).',
      'fim', { despesa: 'fornecedor', risco: 'fornecedor' }),
    // Ajuste de balanceamento: o original travava TODOS os inícios da rodada (na 1.0,
    // zerava a missão em 100% das simulações quando caía na rodada 3). Com até 5
    // projetos ao mesmo tempo, o limite passou a 2 (regras.LIMITE_INICIOS_CHIMARRAO).
    e('ev_chimarrao', 'negativo', 'Acabou o Chimarrão',
      'A equipe perdeu completamente a força.',
      'Só DOIS cards podem entrar em EM ANDAMENTO nesta rodada. Revisões e planejamento continuam liberados.',
      'rodada'),
    e('ev_provas', 'negativo', 'Semana de Provas',
      'Todo mundo lembrou que também precisa estudar.',
      'Só DOIS cards podem ser movimentados nesta rodada (cada um pode avançar mais de uma etapa). Revisar também conta como movimento.',
      'rodada'),
    e('ev_impressora', 'negativo', 'Impressora do T11 Pifou',
      'Justo quando precisávamos imprimir os cartazes.',
      'Cards de Divulgação não avançam nesta rodada: não mudam de coluna e não ganham progresso.',
      'rodada', { categoria: 'divulgacao' }),
    e('ev_quadra', 'negativo', 'A Quadra Continua em Reforma',
      'Surpresa: a quadra ainda não está disponível.',
      'Projetos esportivos que usam a quadra ficam parados nesta rodada: não mudam de coluna e não ganham progresso.',
      'rodada', { risco: 'quadra' }),
    e('ev_post', 'negativo', 'Divulgação Deu Ruim',
      'O post foi publicado no horário errado.',
      '−5 Prestígio.',
      'agora', { perda: { prestigio: 5 } }),

    // ---------------- Positivos ----------------
    e('ev_patrocinio', 'positivo', 'Patrocínio da Concolores',
      'A Concolores ganhou um campeonato e resolveu ajudar o Grêmio.',
      '+R$ 150 no caixa.',
      'agora', { ganho: { dinheiro: 150 } }),
    e('ev_mutirao', 'positivo', 'Mutirão da Gurizada',
      'Todo mundo resolveu ajudar de última hora.',
      'Uma vez nesta rodada: escolha um card EM ANDAMENTO para ganhar +1 rodada de progresso na hora. Se terminar, ele vai direto para REVISÃO.',
      'rodada'),
    e('ev_viral', 'positivo', 'Divulgação Viral',
      'O post do Grêmio explodiu.',
      '+10 Prestígio.',
      'agora', { ganho: { prestigio: 10 } }),
    e('ev_patricio', 'positivo', 'Patrício Ajudou',
      'Patrício apareceu para ajudar o Grêmio.',
      'Patrício (coringa: especialista em tudo) entra na equipe como temporário por 2 rodadas: esta e a próxima.',
      'agora'),
    e('ev_sindicato', 'positivo', 'Doação do Presidente do Sindicato',
      'O presidente do sindicato resolveu apoiar o projeto.',
      'O próximo projeto iniciado custa 50% menos.',
      'agora', { desconto: { tipo: 'percentual', valor: 50 } }),
    e('ev_material', 'positivo', 'Material Encontrado',
      'Alguém descobriu que a escola já tinha parte dos materiais.',
      'O próximo projeto iniciado custa R$ 40 a menos.',
      'agora', { desconto: { tipo: 'fixo', valor: 40 } }),
    e('ev_professor', 'positivo', 'Professor Resolveu Ajudar',
      'A organização ficou tão boa que um professor resolveu ajudar.',
      '+R$ 50 e +5 Prestígio.',
      'agora', { ganho: { dinheiro: 50, prestigio: 5 } }),

    // ---------------- Despesas ----------------
    e('ev_impressoes', 'despesa', 'Impressões de Última Hora',
      'Precisamos de mais cartazes para divulgar o evento.',
      'Pague R$ 40 ou recuse a despesa e perca 5 Prestígio.',
      'agora', { despesa: 'impressoes', perdaSeRecusar: { prestigio: 5 } }),
    e('ev_equipamento', 'despesa', 'Aluguel de Equipamento',
      'O equipamento da escola não está disponível.',
      'No fim da rodada, se houver projeto que depende de equipamento EM ANDAMENTO: pague R$ 60 para mantê-los andando, ou eles ficam parados nesta rodada.',
      'fim', { despesa: 'equipamento', risco: 'equipamento' }),
    e('ev_mesas', 'despesa', 'Faltaram Mesas',
      'Alguém esqueceu de reservar as mesas.',
      'No fim da rodada, se houver projeto que precisa de mesas EM ANDAMENTO: pague R$ 50, ou um deles perde a rodada (fica parado).',
      'fim', { despesa: 'mesas', risco: 'mesas' }),
    e('ev_transporte', 'despesa', 'Transporte',
      'Precisamos buscar os materiais do evento.',
      'Pague R$ 40.',
      'agora', { despesa: 'transporte' }),
    e('ev_limpeza', 'despesa', 'Limpeza Extra',
      'Depois da festa, alguém precisa limpar tudo.',
      'Pague R$ 30.',
      'agora', { despesa: 'limpeza' }),
  ];

  const porId = {};
  lista.forEach(function (ev) {
    if (porId[ev.id]) throw new Error('Evento duplicado: ' + ev.id);
    porId[ev.id] = ev;
  });

  // Evento interno, fora do baralho: usado só pelo planejador do jogo para calcular a
  // meta da partida "sem imprevistos". Nunca aparece para o jogador.
  OG.dados.eventoNeutro = e('ev_tranquila', 'neutro', 'Semana Tranquila',
    'Nada fora do normal.', 'Nenhum efeito.', 'agora');
  porId[OG.dados.eventoNeutro.id] = OG.dados.eventoNeutro;

  OG.dados.eventos = Object.freeze(lista);
  OG.dados.eventosPorId = Object.freeze(porId);
})(globalThis);
