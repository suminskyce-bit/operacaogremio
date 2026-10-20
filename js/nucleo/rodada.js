/*
 * rodada.js — fim de rodada e passagem para a próxima.
 *
 * Ordem do fim de rodada:
 *   1. Resolve o efeito de fim de rodada do evento (pode pedir uma decisão ao jogador).
 *   2. Avança o progresso dos cards EM ANDAMENTO (exceto parados, congelados ou sem equipe).
 *   3. Cards que completaram o progresso vão para REVISÃO e liberam a equipe.
 *   4. Atualiza a disponibilidade: revisores e doentes voltam; temporários vencidos saem.
 *   5. Bônus da rodada não usados expiram (Mutirão).
 *   6. Mostra o resumo. Depois, AVANÇAR vira a próxima carta de evento (ou encerra a partida).
 * Retorno e pontos são creditados na hora da revisão (REVISÃO -> CONCLUÍDO), uma única vez.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  function E() { return OG.estado; }
  function exigir(c, m) { OG.estado.exigir(c, m); }

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

    // 2 e 3. Progresso
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
      if (c.equipe.length < proj.trabalhadores) {
        linhas.push({ tipo: 'parado', texto: proj.nome + ' não avançou: falta gente na equipe.' });
        return;
      }
      c.progresso += 1;
      if (c.progresso >= proj.tempo) {
        c.coluna = 'revisao';
        c.ordem = estado.proximaOrdem++;
        c.equipeFinal = c.equipe.slice();
        c.equipe = [];
        linhas.push({ tipo: 'avancou', texto: proj.nome + ' terminou a execução e foi para REVISÃO.' });
      } else {
        linhas.push({ tipo: 'avancou', texto: proj.nome + ' avançou: ' + c.progresso + '/' + proj.tempo + '.' });
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
      const c = E().cartaDaPessoa(estado, t.pessoaId);
      if (c) {
        c.equipe = c.equipe.filter(function (id) { return id !== t.pessoaId; });
        linhas.push({
          tipo: 'equipe',
          texto: p.nome + ' foi embora e deixou ' + E().projetoDaCarta(c).nome + ' com a equipe incompleta. Complete a equipe para ele voltar a andar.',
        });
      } else if (estado.rodada < OG.regras.TOTAL_RODADAS) {
        linhas.push({ tipo: 'equipe', texto: p.nome + ' terminou a ajuda temporária e foi embora.' });
      }
    });
    estado.temporarios = ficam;

    // 5. Bônus da rodada
    if (estado.mutirao && !estado.mutirao.usado) {
      linhas.push({ tipo: 'evento', texto: 'O Mutirão da Gurizada não foi usado e acabou.' });
    }
    estado.mutirao = null;

    // 6. Resumo
    if (!linhas.length) linhas.push({ tipo: 'info', texto: 'Nada estava em andamento nesta rodada.' });
    estado.resumo = { rodada: estado.rodada, linhas: linhas };
    linhas.forEach(function (l) {
      estado.historico.push({ rodada: estado.rodada, tipo: 'rodada', texto: l.texto });
    });
    estado.pendente = null;
    estado.fase = 'resumo';
  }

  function avancar(estado) {
    exigir(estado.fase === 'resumo', OG.kanban.mensagemFase(estado));
    if (estado.rodada >= OG.regras.TOTAL_RODADAS) {
      estado.fase = 'fim';
      estado.historico.push({ rodada: estado.rodada, tipo: 'sistema', texto: 'Fim da partida.' });
      return;
    }
    estado.rodada += 1;
    estado.cartasMovidasNaRodada = [];
    estado.resumo = null;
    OG.eventos.revelarEvento(estado);
  }

  OG.rodada = {
    encerrarRodada,
    resolverDecisao,
    cancelarEncerramento,
    avancar,
  };
})(globalThis);
