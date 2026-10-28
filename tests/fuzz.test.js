/*
 * Fuzzing: um "jogador caótico" manda milhares de ações aleatórias (válidas e
 * inválidas, repetidas, fora de hora, com pessoas ocupadas ou inexistentes) e, depois
 * de CADA ação, conferimos as invariantes do jogo. Se alguma regra puder ser furada,
 * este teste pega.
 */
'use strict';
const test = require('node:test');
const { OG, E, assert, novo } = require('./ajudantes.js');
const { criarRng } = require('./politicas.js');

function invariantes(e, contexto) {
  const v = OG.persistencia.validarEstado(JSON.parse(JSON.stringify(e)));
  assert.ok(v.ok, contexto + ': estado inválido -> ' + v.motivo);
  assert.ok(E.recursos(e).dinheiro >= 0, contexto + ': caixa negativo');

  const andamento = E.cartasNaColuna(e, 'andamento');
  const tocando = {};
  const ocupadas = {};
  andamento.forEach((c) => {
    assert.ok(!tocando[c.responsavel], contexto + ': ' + c.responsavel + ' tocando dois projetos');
    tocando[c.responsavel] = true;
    assert.equal(E.statusPessoa(e, c.responsavel).codigo, 'tocando', contexto);
    c.equipe.forEach((pid) => {
      assert.ok(E.ehVoluntario(pid), contexto + ': coordenador na equipe');
      assert.ok(!ocupadas[pid], contexto + ': ' + pid + ' em duas equipes');
      ocupadas[pid] = true;
      assert.equal(E.statusPessoa(e, pid).codigo, 'ocupado', contexto + ': status de ' + pid);
    });
  });
  E.coordenadores().forEach((p) => {
    assert.ok(E.filaDe(e, p.id).length <= OG.regras.FILA_POR_COORDENADOR + 1, contexto + ': fila de ' + p.id);
  });
  // Cada card: custo cobrado no máximo uma vez; retorno só se concluído, exatamente uma vez.
  e.cartas.forEach((c) => {
    const custos = e.livro.filter((l) => l.tipo === 'custo' && l.cartaId === c.id).length;
    assert.ok(custos <= 1, contexto + ': custo cobrado ' + custos + 'x em ' + c.id);
    const retornos = e.livro.filter((l) => l.tipo === 'retorno' && l.cartaId === c.id).length;
    assert.equal(retornos, c.coluna === 'concluido' ? 1 : 0, contexto + ': retorno de ' + c.id);
  });
  // Recompensa de cada missão no máximo uma vez.
  e.agenda.forEach((a) => {
    const n = e.livro.filter((l) => l.tipo === 'recompensa' && l.missaoId === a.missaoId).length;
    assert.ok(n <= 3, contexto + ': recompensa repetida de ' + a.missaoId);
  });
}

/** Equipe ao acaso que respeita as regras (para o fuzzing avançar de verdade). */
function equipeValida(e, c, rnd) {
  const proj = E.projetoDaCarta(c);
  const precisa = E.forcaNecessaria(proj);
  const cand = OG.kanban.candidatos(e, c).map((p) => p.id).sort(() => rnd() - 0.5);
  const equipe = [];
  cand.forEach((pid) => { if (E.forcaDaEquipe(proj, true, equipe) < precisa) equipe.push(pid); });
  let sobra = E.voluntariosSobrando(proj, equipe);
  while (sobra.length) {
    equipe.splice(equipe.indexOf(sobra[0]), 1);
    sobra = E.voluntariosSobrando(proj, equipe);
  }
  return equipe;
}

function acaoAleatoria(e, rnd) {
  const pick = (lista) => lista[Math.floor(rnd() * lista.length)];
  const pessoas = E.todasPessoas().map((p) => p.id).concat(['ninguem', undefined]);
  const coords = OG.dados.coordenadores.map((p) => p.id);
  const cartas = e.cartas.map((c) => c.id).concat(['inexistente', 'c1', 'c999']);
  const tipos = ['CONFIRMAR_EVENTO', 'PLANEJAR', 'PLANEJAR', 'PLANEJAR', 'TROCAR_RESPONSAVEL', 'DESPLANEJAR',
    'INICIAR', 'INICIAR', 'INICIAR', 'INICIAR', 'REVISAR', 'REVISAR', 'REVISAR', 'COMPLETAR_EQUIPE', 'USAR_MUTIRAO',
    'ENCERRAR_RODADA', 'ENCERRAR_RODADA', 'RESOLVER_DECISAO', 'CANCELAR_ENCERRAMENTO', 'AVANCAR', 'AVANCAR'];
  // Na maior parte das vezes, algo que faz sentido na fase (para as partidas irem longe);
  // no resto, qualquer coisa (para testar as recusas fora de hora).
  const porFase = {
    evento: ['CONFIRMAR_EVENTO'],
    decisao: ['RESOLVER_DECISAO', 'RESOLVER_DECISAO', 'RESOLVER_DECISAO', 'CANCELAR_ENCERRAMENTO'],
    resumo: ['AVANCAR'],
    planejamento: ['PLANEJAR', 'PLANEJAR', 'PLANEJAR', 'PLANEJAR', 'TROCAR_RESPONSAVEL', 'DESPLANEJAR',
      'INICIAR', 'INICIAR', 'INICIAR', 'INICIAR', 'INICIAR', 'REVISAR', 'REVISAR', 'REVISAR', 'REVISAR',
      'COMPLETAR_EQUIPE', 'USAR_MUTIRAO', 'USAR_MUTIRAO'],
  };
  let tipo;
  if (e.fase === 'planejamento') {
    // Encerrar a rodada é raro: cada rodada recebe dezenas de tentativas.
    if (rnd() < 0.03) tipo = 'ENCERRAR_RODADA';
    else tipo = rnd() < 0.8 ? pick(porFase.planejamento) : pick(tipos.filter((t) => t !== 'ENCERRAR_RODADA'));
  } else {
    tipo = rnd() < 0.75 && porFase[e.fase] ? pick(porFase[e.fase]) : pick(tipos);
  }
  const acao = { tipo: tipo };
  if (rnd() < 0.08) acao.rodada = 1 + Math.floor(rnd() * 6);
  switch (tipo) {
    case 'CONFIRMAR_EVENTO': {
      const op = OG.eventos.opcoesEvento(e);
      acao.escolha = rnd() < 0.85 && op.length ? pick(op).id : pick(['pagar', 'recusar', 'x', undefined]);
      break;
    }
    case 'RESOLVER_DECISAO': {
      const dec = OG.eventos.decisaoFimRodada(e);
      acao.escolha = rnd() < 0.85 && dec ? pick(dec.opcoes).id : pick(['pagar', 'parar', 'voltar:c1', 'parar:c2', 'x']);
      break;
    }
    case 'PLANEJAR':
    case 'TROCAR_RESPONSAVEL': {
      const backlog = e.cartas.filter((c) => c.coluna === (tipo === 'PLANEJAR' ? 'backlog' : 'afazer'));
      acao.cartaId = rnd() < 0.8 && backlog.length ? pick(backlog).id : pick(cartas);
      acao.responsavel = rnd() < 0.85 ? pick(coords) : pick(pessoas);
      break;
    }
    case 'INICIAR': {
      const afazer = e.cartas.filter((c) => c.coluna === 'afazer');
      const c = rnd() < 0.8 && afazer.length ? pick(afazer) : E.carta(e, pick(cartas));
      acao.cartaId = c ? c.id : 'inexistente';
      const sorte = rnd();
      if (c && sorte < 0.55) {
        acao.equipe = equipeValida(e, c, rnd);
      } else if (c && sorte < 0.75) {
        const t = OG.planejador.montarEquipe(e, c);
        acao.equipe = t ? t.equipe : [];
      } else if (sorte < 0.97) {
        acao.equipe = [];
        const n = Math.floor(rnd() * 5);
        for (let i = 0; i < n; i++) acao.equipe.push(pick(pessoas));
      } else {
        acao.equipe = pick([null, 'agatha', { x: 1 }, undefined]);
      }
      break;
    }
    case 'REVISAR': {
      const rev = e.cartas.filter((c) => c.coluna === 'revisao');
      acao.cartaId = rnd() < 0.85 && rev.length ? pick(rev).id : pick(cartas);
      acao.revisorId = rnd() < 0.8 ? pick(coords) : pick(pessoas);
      break;
    }
    case 'COMPLETAR_EQUIPE': {
      // Equipe desfalcada é rara (temporário que foi embora com o projeto parado): mira nela quando existe.
      const fracas = e.cartas.filter((c) => c.coluna === 'andamento' && E.forcaDaCarta(c) < E.forcaNecessaria(E.projetoDaCarta(c)));
      const alvo = rnd() < 0.8 && fracas.length ? pick(fracas) : null;
      acao.cartaId = alvo ? alvo.id : pick(cartas);
      const cand = alvo ? OG.kanban.candidatos(e, alvo) : [];
      acao.pessoaId = cand.length && rnd() < 0.8 ? pick(cand).id : pick(pessoas);
      break;
    }
    default:
      acao.cartaId = pick(cartas);
  }
  return acao;
}

test('fuzzing: ações aleatórias nunca quebram as regras do jogo (todas as durações)', () => {
  let totalAcoes = 0;
  let aceitas = 0;
  let partidasCompletas = 0;
  const aceitasPorTipo = {};
  const planos = [[4, 60], [8, 16], [10, 12], [26, 4]];
  planos.forEach(([duracao, partidas], pi) => {
    for (let s = 1; s <= partidas; s++) {
      const rnd = criarRng(s * 7 + pi * 1000 + duracao);
      const missao = OG.dados.missoes[(s + pi) % OG.dados.missoes.length].id;
      let e = OG.motor.criarPartida({ missaoId: missao, duracao: duracao, semente: s * 13 + pi, caixaApertado: s % 3 === 0 });
      invariantes(e, duracao + '/' + missao + '#' + s + ' início');
      const limite = 150 * duracao;
      for (let i = 0; i < limite && e.fase !== 'fim'; i++) {
        const acao = acaoAleatoria(e, rnd);
        const antes = JSON.stringify(e);
        let r;
        assert.doesNotThrow(() => { r = OG.motor.aplicar(e, acao); }, 'exceção com ' + JSON.stringify(acao));
        totalAcoes++;
        if (r.ok) {
          aceitas++;
          aceitasPorTipo[acao.tipo] = (aceitasPorTipo[acao.tipo] || 0) + 1;
          assert.equal(JSON.stringify(e), antes, 'o estado antigo foi alterado por ' + JSON.stringify(acao));
          e = r.estado;
          invariantes(e, duracao + '/' + missao + '#' + s + ' após ' + JSON.stringify(acao));
        } else {
          assert.equal(r.estado, e);
          assert.equal(JSON.stringify(e), antes, 'ação recusada alterou o estado: ' + JSON.stringify(acao));
          assert.equal(typeof r.erro, 'string');
        }
      }
      if (e.fase === 'fim') partidasCompletas++;
    }
  });
  console.log('fuzzing: ' + totalAcoes + ' ações (' + aceitas + ' aceitas), ' + partidasCompletas + ' partidas completas; aceitas por tipo: ' + JSON.stringify(aceitasPorTipo));
  // O fuzzing precisa de fato exercitar o jogo inteiro.
  assert.ok(totalAcoes > 15000, 'ações: ' + totalAcoes);
  assert.ok(aceitas > 5000, 'aceitas: ' + aceitas);
  assert.ok(partidasCompletas > 80, 'partidas completas: ' + partidasCompletas);
  // (COMPLETAR_EQUIPE depende de um temporário ir embora no meio de um projeto parado:
  // é raro aqui e tem teste próprio em equipe.test.js.)
  ['PLANEJAR', 'TROCAR_RESPONSAVEL', 'DESPLANEJAR', 'INICIAR', 'REVISAR', 'USAR_MUTIRAO',
    'RESOLVER_DECISAO', 'CANCELAR_ENCERRAMENTO'].forEach((t) => {
    assert.ok((aceitasPorTipo[t] || 0) > 0, 'o fuzzing nunca conseguiu ' + t);
  });
});

test('clique repetido: repetir a mesma ação não duplica o efeito', () => {
  let e = novo({ missaoId: 'junina' }); // baralho só com Divulgação Viral: nada atrapalha
  e = OG.motor.aplicar(e, { tipo: 'CONFIRMAR_EVENTO' }).estado;
  const pescaria = e.cartas.find((c) => c.projetoId === 'pescaria').id;
  const planejar = { tipo: 'PLANEJAR', cartaId: pescaria, responsavel: 'jv' };
  const p1 = OG.motor.aplicar(e, planejar);
  assert.ok(p1.ok, p1.erro);
  assert.equal(OG.motor.aplicar(p1.estado, planejar).ok, false);
  const iniciar = { tipo: 'INICIAR', cartaId: pescaria, equipe: ['wesley', 'wliam'] };
  const r1 = OG.motor.aplicar(p1.estado, iniciar);
  assert.ok(r1.ok, r1.erro);
  assert.equal(OG.motor.aplicar(r1.estado, iniciar).ok, false);
  assert.equal(OG.motor.aplicar(r1.estado, iniciar).ok, false);
  assert.equal(r1.estado.livro.filter((l) => l.tipo === 'custo').length, 1);
  // Revisar duas vezes: o retorno entra uma vez.
  let f = OG.motor.aplicar(r1.estado, { tipo: 'ENCERRAR_RODADA' }).estado;
  if (f.fase === 'decisao') f = OG.motor.aplicar(f, { tipo: 'RESOLVER_DECISAO', escolha: OG.eventos.decisaoFimRodada(f).opcoes.find((o) => o.habilitado).id }).estado;
  f = OG.motor.aplicar(f, { tipo: 'AVANCAR' }).estado;
  f = OG.motor.aplicar(f, { tipo: 'CONFIRMAR_EVENTO', escolha: OG.eventos.opcoesEvento(f).find((o) => o.habilitado).id }).estado;
  const revisar = { tipo: 'REVISAR', cartaId: pescaria, revisorId: 'sumindo' };
  const v1 = OG.motor.aplicar(f, revisar);
  assert.ok(v1.ok, v1.erro);
  assert.equal(OG.motor.aplicar(v1.estado, revisar).ok, false);
  assert.equal(OG.motor.aplicar(v1.estado, Object.assign({}, revisar, { revisorId: 'antune' })).ok, false);
  assert.equal(v1.estado.livro.filter((l) => l.tipo === 'retorno').length, 1);
});
