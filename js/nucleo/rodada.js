/*
 * rodada.js — fim de rodada e passagem para a próxima.
 *
 * Ordem do fim de rodada:
 *   1. Resolve o efeito de fim de rodada do evento (pode pedir uma decisão ao jogador).
 *   2. Avança a execução dos cards EM ANDAMENTO, menos os que ficaram parados:
 *      pelo evento, congelados (impressora/quadra), sem força suficiente, ou porque o
 *      responsável parou para revisar (só se o projeto já vinha de rodada anterior).
 *   3. Cards que completaram a execução vão para REVISÃO e liberam a equipe.
 *   4. Atualiza a disponibilidade: revisores e doentes voltam; temporários vencidos saem.
 *   5. Bônus da rodada não usados expiram (Mutirão).
 *   6. Prazos: card que não começou e cujo prazo acabou sai do quadro (vencido).
 *   7. Missões: a que chegou à data sem cumprir o objetivo é perdida.
 *   8. Resumo. Depois, AVANÇAR traz o que chega na próxima rodada e vira o evento
 *      (ou encerra a partida).
 * Retorno e pontos são creditados na hora da revisão (REVISÃO -> CONCLUÍDO), uma única vez.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function E() { return OG.estado; }
  function R() { return OG.regras; }
  function exigir(c, m) { OG.estado.exigir(c, m); }
  function fmt(v) { return OG.util.formatarDinheiro(v); }

  function encerrarRodada(estado) {
    exigir(estado.fase === 'planejamento', OG.kanban.mensagemFase(estado));
    const dec = OG.eventos.decisaoFimRodada(estado);
    if (dec) {
      const habilitadas = dec.opcoes.filter(function (o) { return o.habilitado; });
      if (habilitadas.length > 1) {
        estado.fase = 'decisao';
        estado.pendente = { eventoId: dec.eventoId, rodada: estado.rodada };
        return;
      }
      // Só existe um caminho possível: aplica direto e conta no resumo.
      processarFimDeRodada(estado, habilitadas[0].id);
      return;
    }
    processarFimDeRodada(estado, null);
  }

  function resolverDecisao(estado, escolha) {
    exigir(estado.fase === 'decisao', 'Não há decisão pendente.');
    processarFimDeRodada(estado, escolha);
  }

  /** Volta para o quadro sem encerrar (nada foi alterado ao abrir a decisão). */
  function cancelarEncerramento(estado) {
    exigir(estado.fase === 'decisao', 'Não há encerramento de rodada para cancelar.');
    estado.fase = 'planejamento';
    estado.pendente = null;
  }

  function processarFimDeRodada(estado, escolha) {
    const linhas = [];
    let paradas = [];
    let motivoParada = '';

    // 1. Evento
    if (escolha) {
      const r = OG.eventos.aplicarDecisaoFimRodada(estado, escolha);
      paradas = r.paradas;
      motivoParada = r.motivo;
      r.mensagens.forEach(function (m) { linhas.push({ tipo: 'evento', texto: m }); });
    }

    // Quem parou para revisar no meio de um projeto (calculado antes de mexer nos cards).
    const paradosPorRevisao = {};
    estado.revisoresDaRodada.forEach(function (coordId) {
      const c = E().projetoParadoSeRevisar(estado, coordId);
      if (c) paradosPorRevisao[c.id] = coordId;
    });

    // 2 e 3. Execução
    E().cartasNaColuna(estado, 'andamento').forEach(function (c) {
      const proj = E().projetoDaCarta(c);
      if (paradas.indexOf(c.id) !== -1) {
        linhas.push({ tipo: 'parado', texto: proj.nome + ' ficou parado (' + motivoParada + ').' });
        return;
      }
      const bloqueio = E().bloqueioDaCarta(estado, c);
      if (bloqueio) {
        linhas.push({ tipo: 'parado', texto: proj.nome + ' ficou parado — ' + bloqueio });
        return;
      }
      if (paradosPorRevisao[c.id]) {
        linhas.push({
          tipo: 'parado',
          texto: proj.nome + ' ficou parado: ' + E().pessoa(paradosPorRevisao[c.id]).nome + ' parou para revisar outro projeto.',
        });
        return;
      }
      const forca = E().forcaDaCarta(c);
      const precisa = E().forcaNecessaria(proj);
      if (forca < precisa) {
        linhas.push({ tipo: 'parado', texto: proj.nome + ' não avançou: a equipe tem força ' + forca + ' de ' + precisa + '. Complete a equipe.' });
        return;
      }
      c.progresso += 1;
      if (c.progresso >= c.tempoTotal) {
        c.coluna = 'revisao';
        c.ordem = estado.proximaOrdem++;
        c.equipeFinal = c.equipe.slice();
        c.equipe = [];
        linhas.push({ tipo: 'avancou', texto: proj.nome + ' terminou a execução e foi para REVISÃO.' });
      } else {
        linhas.push({ tipo: 'avancou', texto: proj.nome + ' avançou: ' + c.progresso + '/' + c.tempoTotal + '.' });
      }
    });

    // 4. Disponibilidade
    estado.revisoresDaRodada = [];
    estado.doentes.forEach(function (d) {
      if (d.rodada === estado.rodada) {
        linhas.push({ tipo: 'equipe', texto: E().pessoa(d.pessoaId).nome + ' se recuperou da influenza.' });
      }
    });
    estado.doentes = [];

    const ficam = [];
    estado.temporarios.forEach(function (t) {
      if (t.ateRodada > estado.rodada) {
        ficam.push(t);
        return;
      }
      const p = E().pessoa(t.pessoaId);
      const c = E().cartaDoVoluntario(estado, t.pessoaId);
      if (c) {
        c.equipe = c.equipe.filter(function (id) { return id !== t.pessoaId; });
        const proj = E().projetoDaCarta(c);
        const falta = E().forcaDaCarta(c) < E().forcaNecessaria(proj);
        linhas.push({
          tipo: 'equipe',
          texto: p.nome + ' foi embora e saiu da equipe de ' + proj.nome + '.' +
            (falta ? ' Complete a equipe para o projeto voltar a andar.' : ''),
        });
      } else if (estado.rodada < E().totalRodadas(estado)) {
        linhas.push({ tipo: 'equipe', texto: p.nome + ' terminou a ajuda temporária e foi embora.' });
      }
    });
    estado.temporarios = ficam;

    // 5. Bônus da rodada
    if (estado.mutirao && !estado.mutirao.usado) {
      linhas.push({ tipo: 'evento', texto: 'O Mutirão da Gurizada não foi usado e acabou.' });
    }
    estado.mutirao = null;

    // 6. Prazos
    const vencidos = estado.cartas.filter(function (c) {
      return (c.coluna === 'backlog' || c.coluna === 'afazer') && c.prazo <= estado.rodada;
    });
    vencidos.forEach(function (c) {
      const proj = E().projetoDaCarta(c);
      estado.arquivo.push({
        id: c.id, projetoId: c.projetoId, origem: c.origem, missaoId: c.missaoId,
        chegada: c.chegada, prazo: c.prazo, coluna: c.coluna, responsavel: c.responsavel,
        custoPago: c.custoPago, rodada: estado.rodada, motivo: 'vencido',
      });
      let texto = proj.nome + ' venceu sem começar e saiu do quadro' + (c.origem === 'pedido' ? ' (pedido cancelado).' : '.');
      if (c.custoPago) texto += ' O que já tinha sido pago (' + fmt(c.custoPago) + ') foi perdido.';
      linhas.push({ tipo: 'vencido', texto: texto });
    });
    if (vencidos.length) {
      estado.cartas = estado.cartas.filter(function (c) { return vencidos.indexOf(c) === -1; });
      // Nenhuma lista pode apontar para card que saiu do quadro (senão a partida salva
      // no resumo da rodada seria recusada ao recarregar a página).
      const saiu = vencidos.map(function (c) { return c.id; });
      estado.cartasMovidasNaRodada = estado.cartasMovidasNaRodada.filter(function (id) { return saiu.indexOf(id) === -1; });
    }
    estado.cartas.forEach(function (c) {
      if ((c.coluna === 'andamento' || c.coluna === 'revisao') && c.prazo === estado.rodada) {
        linhas.push({
          tipo: 'vencido',
          texto: E().projetoDaCarta(c).nome + ' passou do prazo. Ainda dá para concluir, mas rende só metade do retorno, sem prestígio nem tradição.',
        });
      }
    });

    // 7. Missões
    estado.agenda.forEach(function (a) {
      if (a.data !== estado.rodada || a.cumprida || a.perdida) return;
      a.perdida = true;
      const m = E().missaoPorId(a.missaoId);
      linhas.push({
        tipo: 'missao',
        texto: 'Missão perdida: ' + m.nome + ' chegou à data com ' + E().progressoMissao(estado, a.missaoId) +
          ' de ' + m.objetivo + ' projetos concluídos no prazo. A recompensa ficou de fora.',
      });
    });

    // 8. Resumo
    if (!linhas.length) linhas.push({ tipo: 'info', texto: 'Nada estava em andamento nesta rodada.' });
    estado.resumo = { rodada: estado.rodada, linhas: linhas };
    linhas.forEach(function (l) {
      estado.historico.push({ rodada: estado.rodada, tipo: l.tipo === 'missao' ? 'missao' : 'rodada', texto: l.texto });
    });
    estado.pendente = null;
    estado.fase = 'resumo';
  }

  function avancar(estado) {
    exigir(estado.fase === 'resumo', OG.kanban.mensagemFase(estado));
    if (estado.rodada >= E().totalRodadas(estado)) {
      estado.fase = 'fim';
      estado.historico.push({ rodada: estado.rodada, tipo: 'sistema', texto: 'Fim da partida.' });
      return;
    }
    estado.rodada += 1;
    estado.cartasMovidasNaRodada = [];
    estado.resumo = null;
    OG.agenda.receberChegadas(estado);
    OG.eventos.revelarEvento(estado);
  }

  OG.rodada = {
    encerrarRodada,
    resolverDecisao,
    cancelarEncerramento,
    avancar,
  };
})(globalThis);
