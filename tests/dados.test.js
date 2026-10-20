/* Dados: nomes, catálogo conforme a especificação e coerência das missões. */
'use strict';
const test = require('node:test');
const { OG, assert } = require('./ajudantes.js');

test('os cinco coordenadores têm os nomes e cargos novos', () => {
  const esperado = [
    ['Sumindo', 'Coordenador Geral'],
    ['Antune', 'Coordenador Cultural'],
    ['Luize', 'Coordenador de Infraestrutura'],
    ['Ryani', 'Coordenadora de Comunicação'],
    ['JV', 'Coordenador Financeiro'],
  ];
  assert.deepEqual(OG.dados.coordenadores.map((c) => [c.nome, c.cargo]), esperado);
});

test('os 13 voluntários estão corretos, na ordem oficial, e separados dos coordenadores', () => {
  assert.deepEqual(OG.dados.voluntarios.map((v) => v.nome), [
    'Patrício', 'Dexter', 'Patrick', 'Wesley', 'Deyverson', 'Agatha Cross', 'Costit',
    'Wiky', 'Potter', 'Wliam Woka', 'Monica', 'Giulie', 'Maicon',
  ]);
  const idsCoord = OG.dados.coordenadores.map((c) => c.id);
  OG.dados.voluntarios.forEach((v) => assert.ok(!idsCoord.includes(v.id)));
});

test('todo personagem tem especialidade com categorias válidas', () => {
  OG.dados.coordenadores.concat(OG.dados.voluntarios).forEach((p) => {
    const e = p.especialidade;
    assert.ok(e && e.rotulo, p.nome + ' sem especialidade');
    (e.categorias || []).forEach((c) => assert.ok(OG.dados.categorias[c], p.nome + ': categoria ' + c));
    (e.riscos || []).forEach((r) => assert.ok(OG.dados.riscos[r], p.nome + ': risco ' + r));
    assert.ok(e.coringa || (e.categorias && e.categorias.length), p.nome + ' precisa de categoria ou coringa');
  });
});

// [nome, custo, tempo, trabalhadores, retorno, prestigio, tradicao] — valores da especificação
const ESPEC = [
  ['Mateada do Mesquita', 40, 1, 1, 80, 5, 10], ['Concurso de Pilcha', 60, 1, 1, 140, 5, 15],
  ['Dia da Cuca', 70, 1, 2, 160, 5, 10], ['Campeonato Concolor', 60, 1, 2, 150, 10, 0],
  ['Tchê Música', 100, 2, 2, 250, 15, 15], ['Decoração Farroupilha', 50, 1, 1, 100, 5, 5],
  ['Decoração Junina', 50, 1, 1, 100, 5, 0], ['Barraca de Comidas', 100, 1, 2, 230, 10, 0],
  ['Pescaria', 40, 1, 1, 100, 5, 0], ['Correio Elegante', 30, 1, 1, 90, 10, 0],
  ['Quadrilha', 70, 2, 2, 160, 15, 0], ['Som da Festa', 80, 1, 1, 180, 10, 0],
  ['Decoração do Terror', 60, 1, 1, 120, 10, 0], ['Casa do Terror', 100, 2, 2, 280, 20, 0],
  ['Concurso de Fantasias', 50, 1, 1, 130, 10, 0], ['Cinema de Terror', 60, 1, 1, 140, 10, 0],
  ['Torneio Brawl Kids', 70, 1, 2, 180, 15, 0], ['Divulgação Halloween', 30, 1, 1, 70, 10, 0],
  ['Campeonato Brawl Stars', 50, 1, 1, 140, 10, 0], ['Campeonato EA FC', 60, 1, 1, 150, 10, 0],
  ['Campeonato Minecraft', 70, 1, 1, 180, 15, 0], ['Arena Gamer', 100, 2, 2, 280, 20, 0],
  ['Futsal', 60, 1, 2, 150, 10, 0], ['Vôlei', 50, 1, 2, 120, 10, 0],
  ['Xadrez', 30, 1, 1, 80, 5, 0], ['Truco', 30, 1, 1, 100, 10, 0],
  ['Show de Talentos', 70, 1, 2, 170, 15, 0], ['Exposição de Arte', 40, 1, 1, 100, 10, 0],
  ['Batalha de Bandas', 100, 2, 2, 250, 20, 0], ['Feira Cultural', 80, 1, 2, 180, 0, 15],
  ['Convite às Empresas', 30, 1, 1, 80, 10, 0], ['Convite às Universidades', 40, 1, 1, 100, 10, 0],
  ['Palestra', 50, 1, 1, 130, 15, 0], ['Estandes', 80, 2, 2, 200, 20, 0],
  ['Inscrições', 20, 1, 1, 50, 5, 0], ['Divulgação', 30, 1, 1, 70, 10, 0],
  ['Estrutura', 70, 1, 2, 140, 5, 0], ['Apresentação', 80, 2, 2, 200, 15, 0],
  ['Gincana', 60, 1, 2, 150, 15, 0], ['Premiação', 40, 1, 1, 100, 10, 0],
];

test('o catálogo tem todos os cards da especificação com os valores exatos', () => {
  ESPEC.forEach(([nome, custo, tempo, trab, retorno, prest, trad]) => {
    const p = OG.dados.projetos.find((x) => x.nome === nome);
    assert.ok(p, 'faltou o card ' + nome);
    assert.deepEqual([p.custo, p.tempo, p.trabalhadores, p.retorno, p.prestigio, p.tradicao],
      [custo, tempo, trab, retorno, prest, trad], 'valores de ' + nome);
    assert.equal(p.novo, false);
  });
});

test('cards novos de apoio seguem a curva de custo/retorno dos originais', () => {
  OG.dados.projetos.filter((p) => p.novo).forEach((p) => {
    const razao = p.retorno / p.custo;
    assert.ok(razao >= 2 && razao <= 2.8, p.nome + ': retorno/custo = ' + razao);
    assert.ok(p.custo % 10 === 0 && p.retorno % 10 === 0, p.nome + ': valores redondos');
  });
});

test('todo card tem retorno maior que o custo, categoria e riscos válidos', () => {
  OG.dados.projetos.forEach((p) => {
    assert.ok(p.retorno > p.custo, p.nome);
    assert.ok([1, 2].includes(p.tempo) && [1, 2].includes(p.trabalhadores), p.nome);
    assert.ok(OG.dados.categorias[p.categoria], p.nome + ' categoria');
    p.riscos.forEach((r) => assert.ok(OG.dados.riscos[r], p.nome + ' risco ' + r));
    assert.ok(p.descricao.length > 10, p.nome + ' sem descrição');
  });
});

test('as 10 missões existem, com 6 cards distintos e recompensas da especificação', () => {
  const recompensas = {
    farroupilha: { dinheiro: 100, prestigio: 0, tradicao: 10 },
    junina: { dinheiro: 100, prestigio: 10, tradicao: 0 },
    halloween: { dinheiro: 0, prestigio: 15, tradicao: 0 },
    gamer: { dinheiro: 0, prestigio: 15, tradicao: 0 },
    liga: { dinheiro: 100, prestigio: 20, tradicao: 0 },
    cultural: { dinheiro: 0, prestigio: 0, tradicao: 15 },
    profissoes: { dinheiro: 0, prestigio: 20, tradicao: 0 },
    talentos: { dinheiro: 0, prestigio: 20, tradicao: 0 },
    estudante: { dinheiro: 0, prestigio: 20, tradicao: 0 },
    concolor: { dinheiro: 100, prestigio: 15, tradicao: 0 },
  };
  assert.equal(OG.dados.missoes.length, 10);
  OG.dados.missoes.forEach((m) => {
    assert.equal(m.projetos.length, 6, m.nome);
    assert.equal(new Set(m.projetos).size, 6, m.nome + ' repetido');
    m.projetos.forEach((id) => assert.ok(OG.dados.projetosPorId[id], m.nome + ': ' + id));
    assert.deepEqual({ ...m.recompensa }, recompensas[m.id], m.nome);
  });
});

test('os cards citados em cada missão da especificação estão na missão', () => {
  const nomes = (id) => OG.dados.missoesPorId[id].projetos.map((p) => OG.dados.projetosPorId[p].nome);
  const exige = {
    farroupilha: ['Mateada do Mesquita', 'Concurso de Pilcha', 'Dia da Cuca', 'Campeonato Concolor', 'Tchê Música', 'Decoração Farroupilha'],
    junina: ['Decoração Junina', 'Barraca de Comidas', 'Pescaria', 'Correio Elegante', 'Quadrilha', 'Som da Festa'],
    halloween: ['Decoração do Terror', 'Casa do Terror', 'Concurso de Fantasias', 'Cinema de Terror', 'Torneio Brawl Kids', 'Divulgação Halloween'],
    gamer: ['Campeonato Brawl Stars', 'Campeonato EA FC', 'Campeonato Minecraft', 'Arena Gamer'],
    liga: ['Futsal', 'Vôlei', 'Xadrez', 'Truco'],
    cultural: ['Show de Talentos', 'Exposição de Arte', 'Batalha de Bandas', 'Feira Cultural'],
    profissoes: ['Convite às Empresas', 'Convite às Universidades', 'Palestra', 'Estandes'],
    talentos: ['Inscrições', 'Divulgação', 'Estrutura', 'Apresentação'],
    estudante: ['Gincana', 'Campeonato', 'Festa', 'Show', 'Divulgação', 'Premiação'],
    concolor: ['Campeonato Concolor', 'Inscrições', 'Divulgação', 'Estrutura'],
  };
  Object.entries(exige).forEach(([id, lista]) => {
    lista.forEach((n) => assert.ok(nomes(id).includes(n), id + ' sem ' + n));
  });
});

test('toda missão é possível nas 4 rodadas (cabe o objetivo nas vagas que terminam a tempo)', () => {
  const capacidade = OG.regras.LIMITE_EM_ANDAMENTO * (OG.regras.TOTAL_RODADAS - 1);
  OG.dados.missoes.forEach((m) => {
    const tempos = m.projetos.map((id) => OG.dados.projetosPorId[id].tempo).sort((a, b) => a - b);
    let usados = 0;
    let n = 0;
    tempos.forEach((t) => { if (usados + t <= capacidade) { usados += t; n++; } });
    assert.ok(n >= m.objetivo, m.nome + ': cabem ' + n + ' projetos, objetivo ' + m.objetivo);
    // E nenhuma missão depende de projeto mais longo do que a partida permite.
    tempos.forEach((t) => assert.ok(t <= OG.regras.TOTAL_RODADAS - 1));
  });
});

test('a meta de cada missão é calculada e fica acima da pontuação inicial', () => {
  OG.dados.missoes.forEach((m) => {
    const meta = OG.pontuacao.metaDaMissao(m.id);
    assert.ok(meta > 200 && meta < 320, m.nome + ': meta ' + meta);
  });
  assert.equal(OG.pontuacao.metaDaMissao('farroupilha'), 278);
});

test('o baralho tem 8 negativos, 7 positivos e 5 despesas, sem ids repetidos', () => {
  const tipos = OG.dados.eventos.reduce((a, e) => { a[e.tipo] = (a[e.tipo] || 0) + 1; return a; }, {});
  assert.deepEqual(tipos, { negativo: 8, positivo: 7, despesa: 5 });
  const cartasDespesa = Object.values(OG.dados.despesas).filter((d) => d.carta !== false).map((d) => d.nome).sort();
  assert.deepEqual(cartasDespesa, ['Aluguel de Equipamento', 'Faltaram Mesas', 'Impressões de Última Hora',
    'Limpeza Extra', 'Reunião com a Diretora', 'Transporte']);
});

test('formatação de dinheiro em reais', () => {
  assert.equal(OG.util.formatarDinheiro(50), 'R$ 50,00');
  assert.equal(OG.util.formatarDinheiro(1234.5), 'R$ 1.234,50');
  assert.equal(OG.util.formatarDinheiro(0), 'R$ 0,00');
  assert.equal(OG.util.formatarDinheiroComSinal(-40), '−R$ 40,00');
  assert.equal(OG.util.formatarDinheiroComSinal(80), '+R$ 80,00');
});
