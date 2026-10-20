/*
 * projetos.js — catálogo de cards de projeto.
 *
 * custo: pago UMA vez ao entrar em EM ANDAMENTO
 * tempo: rodadas de execução (1 ou 2)
 * trabalhadores: pessoas necessárias para executar
 * retorno: dinheiro recebido UMA vez ao chegar em CONCLUÍDO (receita, não lucro!)
 * prestigio / tradicao: pontos recebidos UMA vez ao chegar em CONCLUÍDO
 * novo: true = card de apoio criado para completar 6 cards na missão
 *       (valores seguem a mesma curva de custo/retorno dos cards originais)
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});
  OG.dados = OG.dados || {};

  function p(id, nome, categoria, riscos, custo, tempo, trabalhadores, retorno, prestigio, tradicao, descricao, novo) {
    return Object.freeze({
      id: id,
      nome: nome,
      categoria: categoria,
      riscos: Object.freeze(riscos),
      custo: custo,
      tempo: tempo,
      trabalhadores: trabalhadores,
      retorno: retorno,
      prestigio: prestigio,
      tradicao: tradicao,
      descricao: descricao,
      novo: !!novo,
    });
  }

  const lista = [
    // ---------------- Festa Farroupilha ----------------
    p('mateada', 'Mateada do Mesquita', 'cultura', ['fornecedor'], 40, 1, 1, 80, 5, 10,
      'Roda de chimarrão no pátio: erva boa, água no ponto e prosa solta.'),
    p('pilcha', 'Concurso de Pilcha', 'cultura', [], 60, 1, 1, 140, 5, 15,
      'Desfile de pilchas com bombacha, vestido de prenda e jurados exigentes.'),
    p('cuca', 'Dia da Cuca', 'logistica', ['fornecedor', 'mesas'], 70, 1, 2, 160, 5, 10,
      'Venda de cuca caseira no intervalo. A de uva acaba primeiro.'),
    p('camp_concolor', 'Campeonato Concolor', 'esporte', ['quadra'], 60, 1, 2, 150, 10, 0,
      'O campeonato mais disputado da quadra do Mesquita.'),
    p('tche_musica', 'Tchê Música', 'cultura', ['equipamento'], 100, 2, 2, 250, 15, 15,
      'Palco com música gaúcha ao vivo: vanera, chamamé e caixa de som no talo.'),
    p('deco_farroupilha', 'Decoração Farroupilha', 'estrutura', [], 50, 1, 1, 100, 5, 5,
      'Bandeiras do RS, lenços vermelhos e fardos de feno pelos corredores.'),

    // ---------------- Festa Junina ----------------
    p('deco_junina', 'Decoração Junina', 'estrutura', [], 50, 1, 1, 100, 5, 0,
      'Bandeirinhas, balões de papel e fogueira cenográfica no pátio.'),
    p('barraca', 'Barraca de Comidas', 'logistica', ['fornecedor', 'mesas'], 100, 1, 2, 230, 10, 0,
      'Pinhão, pipoca, cachorro-quente e quentão sem álcool.'),
    p('pescaria', 'Pescaria', 'logistica', ['mesas'], 40, 1, 1, 100, 5, 0,
      'A clássica barraca da pescaria, com prenda para todo mundo.'),
    p('correio', 'Correio Elegante', 'divulgacao', [], 30, 1, 1, 90, 10, 0,
      'Bilhetinhos anônimos entregues de sala em sala. Muito drama.'),
    p('quadrilha', 'Quadrilha', 'cultura', [], 70, 2, 2, 160, 15, 0,
      'Ensaios com marcação, anarriê e o clássico "olha a chuva!".'),
    p('som_festa', 'Som da Festa', 'estrutura', ['equipamento'], 80, 1, 1, 180, 10, 0,
      'Caixas de som, microfone e playlist de forró e sertanejo.'),

    // ---------------- Halloween Mesquita ----------------
    p('deco_terror', 'Decoração do Terror', 'estrutura', [], 60, 1, 1, 120, 10, 0,
      'Teias, abóboras e luz vermelha nos corredores do T11.'),
    p('casa_terror', 'Casa do Terror', 'estrutura', ['equipamento'], 100, 2, 2, 280, 20, 0,
      'Uma sala vira labirinto assombrado, com susto de verdade.'),
    p('fantasias', 'Concurso de Fantasias', 'cultura', [], 50, 1, 1, 130, 10, 0,
      'Desfile de fantasias com júri de professores corajosos.'),
    p('cinema_terror', 'Cinema de Terror', 'cultura', ['equipamento'], 60, 1, 1, 140, 10, 0,
      'Sessão de terror no auditório, com pipoca e gritaria.'),
    p('brawl_kids', 'Torneio Brawl Kids', 'games', [], 70, 1, 2, 180, 15, 0,
      'Torneio de Brawl Stars para a gurizada dos primeiros anos.'),
    p('divulga_halloween', 'Divulgação Halloween', 'divulgacao', [], 30, 1, 1, 70, 10, 0,
      'Cartazes e posts assustadores para lotar o evento.'),

    // ---------------- Torneio Gamer ----------------
    p('brawl_stars', 'Campeonato Brawl Stars', 'games', [], 50, 1, 1, 140, 10, 0,
      'Chaves de 3x3 e a torcida gritando no fundo da sala.'),
    p('ea_fc', 'Campeonato EA FC', 'games', ['equipamento'], 60, 1, 1, 150, 10, 0,
      'Final no telão: quem leva a taça do futebol virtual?'),
    p('minecraft', 'Campeonato Minecraft', 'games', ['equipamento'], 70, 1, 1, 180, 15, 0,
      'Construção em equipe no laboratório de informática.'),
    p('arena_gamer', 'Arena Gamer', 'estrutura', ['equipamento', 'mesas'], 100, 2, 2, 280, 20, 0,
      'Montar a arena com PCs, consoles, cadeiras e extensões.'),
    p('transmissao', 'Transmissão ao Vivo', 'games', ['equipamento'], 40, 1, 1, 100, 10, 0,
      'Live do campeonato no canal do Grêmio, com narração e tudo.', true),

    // ---------------- Liga Mesquita ----------------
    p('futsal', 'Futsal', 'esporte', ['quadra'], 60, 1, 2, 150, 10, 0,
      'Torneio de futsal entre as turmas, com súmula e tudo.'),
    p('volei', 'Vôlei', 'esporte', ['quadra'], 50, 1, 2, 120, 10, 0,
      'Rede armada, saque viagem e discussão se a bola foi dentro.'),
    p('xadrez', 'Xadrez', 'esporte', ['mesas'], 30, 1, 1, 80, 5, 0,
      'Tabuleiros na biblioteca e silêncio absoluto (quase).'),
    p('truco', 'Truco', 'esporte', ['mesas'], 30, 1, 1, 100, 10, 0,
      'Campeonato de truco: quem grita mais alto nem sempre ganha.'),
    p('queimada', 'Queimada', 'esporte', ['quadra'], 40, 1, 2, 100, 10, 0,
      'O clássico da Educação Física, agora valendo taça.', true),
    p('atletismo', 'Atletismo', 'esporte', [], 90, 2, 2, 220, 20, 0,
      'Corrida, salto e arremesso no pátio. Dá trabalho, mas a escola inteira para pra ver.', true),

    // ---------------- Semana Cultural ----------------
    p('show_talentos', 'Show de Talentos', 'cultura', ['equipamento'], 70, 1, 2, 170, 15, 0,
      'Canto, dança, mágica e aquele colega que faz beatbox.'),
    p('exposicao_arte', 'Exposição de Arte', 'cultura', [], 40, 1, 1, 100, 10, 0,
      'Quadros, fotos e esculturas dos alunos no saguão.'),
    p('batalha_bandas', 'Batalha de Bandas', 'cultura', ['equipamento'], 100, 2, 2, 250, 20, 0,
      'As bandas da escola disputam o palco no volume máximo.'),
    p('feira_cultural', 'Feira Cultural', 'cultura', ['mesas'], 80, 1, 2, 180, 0, 15,
      'Estandes sobre as culturas do RS e do mundo.'),
    p('sarau', 'Sarau do Mesquita', 'cultura', [], 30, 1, 1, 80, 5, 5,
      'Poesia, violão e microfone aberto no intervalo.', true),
    p('danca_gaucha', 'Oficina de Danças Gaúchas', 'cultura', [], 50, 1, 2, 120, 5, 10,
      'Aula aberta de chula e vanera com o CTG do bairro.', true),

    // ---------------- Feira de Profissões ----------------
    p('convite_empresas', 'Convite às Empresas', 'divulgacao', [], 30, 1, 1, 80, 10, 0,
      'E-mails, ligações e muita cara de pau para trazer empresas.'),
    p('convite_universidades', 'Convite às Universidades', 'divulgacao', [], 40, 1, 1, 100, 10, 0,
      'Chamar universidades e cursos técnicos da região.'),
    p('palestra', 'Palestra', 'cultura', ['equipamento'], 50, 1, 1, 130, 15, 0,
      'Ex-aluno conta como foi sair do Mesquita para o mercado de trabalho.'),
    p('estandes', 'Estandes', 'estrutura', ['mesas'], 80, 2, 2, 200, 20, 0,
      'Montagem dos estandes das empresas no ginásio.'),
    p('oficina_curriculo', 'Oficina de Currículo', 'cultura', [], 30, 1, 1, 80, 10, 0,
      'Professores ajudam a turma a montar o primeiro currículo.', true),

    // ---------------- Semana do Estudante ----------------
    p('campeonato', 'Campeonato', 'esporte', ['quadra'], 60, 1, 2, 150, 10, 0,
      'Campeonato interturmas, o ponto alto da Semana do Estudante.', true),
    p('festa', 'Festa', 'logistica', ['fornecedor', 'mesas'], 80, 1, 2, 180, 10, 0,
      'Festa no pátio com comida, música e muita gente.', true),
    p('show', 'Show', 'cultura', ['equipamento'], 100, 2, 2, 250, 20, 0,
      'Show de encerramento com os artistas da escola.', true),

    // ---------------- Campeonato Concolor ----------------
    p('preparacao', 'Preparação dos Times', 'esporte', ['quadra'], 80, 2, 2, 200, 20, 0,
      'Semanas de treino, uniformes novos e tabela de jogos fechada.', true),

    // ---------------- Show de Talentos ----------------
    p('ensaio_geral', 'Ensaio Geral', 'cultura', [], 40, 1, 2, 100, 10, 0,
      'Passagem de som e ensaio de todas as apresentações.', true),

    // ---------------- Cards genéricos (outros projetos) ----------------
    p('inscricoes', 'Inscrições', 'divulgacao', [], 20, 1, 1, 50, 5, 0,
      'Formulário, lista de chamada e prazo estourando.'),
    p('divulgacao', 'Divulgação', 'divulgacao', [], 30, 1, 1, 70, 10, 0,
      'Cartazes no T11, stories e aviso de sala em sala.'),
    p('estrutura', 'Estrutura', 'estrutura', ['mesas'], 70, 1, 2, 140, 5, 0,
      'Mesas, cadeiras, palco e extensões no lugar certo.'),
    p('apresentacao', 'Apresentação', 'cultura', ['equipamento'], 80, 2, 2, 200, 15, 0,
      'O grande momento no palco do auditório.'),
    p('gincana', 'Gincana', 'esporte', ['quadra'], 60, 1, 2, 150, 15, 0,
      'Provas malucas entre as turmas, valendo pontos.'),
    p('premiacao', 'Premiação', 'logistica', ['fornecedor'], 40, 1, 1, 100, 10, 0,
      'Troféus, medalhas e discurso emocionado no final.'),
  ];

  const porId = {};
  lista.forEach(function (proj) {
    if (porId[proj.id]) throw new Error('Projeto duplicado no catálogo: ' + proj.id);
    porId[proj.id] = proj;
  });

  OG.dados.projetos = Object.freeze(lista);
  OG.dados.projetosPorId = Object.freeze(porId);
})(globalThis);
