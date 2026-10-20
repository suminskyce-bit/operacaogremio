/*
 * persistencia.js — salvar/carregar a partida no navegador (localStorage).
 *
 * Nada que vem do armazenamento é confiável: antes de usar, o estado passa por
 * `validarEstado`, que confere estrutura, referências e as regras de integridade
 * (limite de 2 em andamento, ninguém em dois projetos, caixa >= 0, recompensa única...).
 * Se algo estiver errado, a partida salva é descartada.
 * Se o navegador bloquear o armazenamento, o jogo continua funcionando, só não salva.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const CHAVE = 'operacao-gremio-mesquita:partida';
  const FASES = ['evento', 'planejamento', 'decisao', 'resumo', 'fim'];
  const RECURSOS = ['dinheiro', 'prestigio', 'tradicao'];

  function inteiro(v, min, max) {
    return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  }

  function validarEstado(e) {
    const falhas = [];
    function checar(cond, msg) { if (!cond) falhas.push(msg); return cond; }

    try {
      if (!checar(e && typeof e === 'object', 'estado não é um objeto')) return { ok: false, motivo: falhas[0] };
      const R = OG.regras;
      const E = OG.estado;
      checar(e.versao === R.VERSAO_ESTADO, 'versão diferente');
      checar(inteiro(e.semente, 0, 4294967295) && inteiro(e.rng, 0, 4294967295), 'sorteio inválido');
      checar(typeof e.caixaApertado === 'boolean', 'modo de caixa inválido');
      if (Array.isArray(e.livro)) {
        const iniciais = e.livro.filter(function (l) { return l && l.tipo === 'inicial' && l.recurso === 'dinheiro'; });
        checar(iniciais.length === 1 && iniciais[0].valor === (e.caixaApertado ? R.CAIXA_APERTADO : R.CAIXA_INICIAL),
          'caixa inicial adulterado');
      }
      const missao = OG.dados.missoesPorId[e.missaoId];
      if (!checar(!!missao, 'missão desconhecida')) return { ok: false, motivo: falhas.join('; ') };
      checar(inteiro(e.rodada, 1, R.TOTAL_RODADAS), 'rodada inválida');
      checar(FASES.indexOf(e.fase) !== -1, 'fase inválida');

      // Cards
      if (!checar(Array.isArray(e.cartas) && e.cartas.length === missao.projetos.length, 'quantidade de cards')) {
        return { ok: false, motivo: falhas.join('; ') };
      }
      const vistos = {};
      const ocupados = {};
      let emAndamento = 0;
      let maiorOrdem = -1;
      e.cartas.forEach(function (c) {
        if (!checar(c && typeof c === 'object', 'card inválido')) return;
        const proj = OG.dados.projetosPorId[c.projetoId];
        checar(!!proj && missao.projetos.indexOf(c.projetoId) !== -1 && c.id === c.projetoId, 'card de outra missão: ' + c.id);
        if (!proj) return;
        checar(!vistos[c.id], 'card repetido: ' + c.id);
        vistos[c.id] = true;
        checar(OG.kanban.ORDEM.indexOf(c.coluna) !== -1, 'coluna inválida');
        checar(typeof c.ordem === 'number' && isFinite(c.ordem), 'ordem inválida');
        maiorOrdem = Math.max(maiorOrdem, c.ordem);
        checar(inteiro(c.progresso, 0, proj.tempo), 'progresso inválido: ' + c.id);
        checar(Array.isArray(c.equipe) && Array.isArray(c.equipeFinal) && Array.isArray(c.custoItens), 'listas do card');
        checar(c.custoPago === null || inteiro(c.custoPago, 0, 100000), 'custo pago inválido');
        checar(typeof c.recompensado === 'boolean', 'flag de recompensa');
        checar(c.recompensado === (c.coluna === 'concluido'), 'recompensa inconsistente: ' + c.id);
        if (c.coluna === 'backlog') checar(c.custoPago === null && c.progresso === 0, 'backlog com custo/progresso');
        if (c.coluna === 'afazer') checar(c.progresso === 0, 'A FAZER com progresso');
        if (['andamento', 'revisao', 'concluido'].indexOf(c.coluna) !== -1) checar(c.custoPago !== null, 'projeto sem custo pago: ' + c.id);
        if (c.coluna === 'andamento') {
          emAndamento++;
          checar(c.progresso < proj.tempo, 'andamento com progresso completo');
          checar(c.equipe.length <= proj.trabalhadores, 'equipe grande demais');
        } else {
          checar(Array.isArray(c.equipe) && c.equipe.length === 0, 'equipe fora de EM ANDAMENTO');
        }
        if (c.coluna === 'revisao' || c.coluna === 'concluido') checar(c.progresso === proj.tempo, 'revisão sem execução completa');
        (c.equipe || []).forEach(function (id) {
          checar(!!E.pessoa(id), 'pessoa desconhecida');
          checar(!ocupados[id], 'pessoa em dois projetos: ' + id);
          ocupados[id] = true;
        });
        if (c.coluna === 'concluido') checar(!!E.pessoa(c.revisor) && E.ehCoordenador(c.revisor), 'revisor inválido');
      });
      checar(emAndamento <= R.LIMITE_EM_ANDAMENTO, 'mais de 2 em andamento');
      checar(typeof e.proximaOrdem === 'number' && e.proximaOrdem > maiorOrdem, 'ordem dos cards');

      // Baralho e evento
      checar(Array.isArray(e.baralho) && e.baralho.length === R.EVENTOS_POR_PARTIDA, 'baralho inválido');
      (e.baralho || []).forEach(function (id, i) {
        checar(!!OG.dados.eventosPorId[id], 'evento desconhecido');
        checar(e.baralho.indexOf(id) === i, 'evento repetido');
      });
      if (checar(e.eventoAtual && typeof e.eventoAtual === 'object', 'evento atual ausente')) {
        checar(e.eventoAtual.id === e.baralho[e.rodada - 1] && e.eventoAtual.rodada === e.rodada, 'evento fora de ordem');
        if (e.fase === 'evento') checar(e.eventoAtual.resolvido === false, 'evento já resolvido');
        else checar(e.eventoAtual.resolvido === true, 'evento não resolvido');
      }

      // Pessoas
      checar(Array.isArray(e.cartasMovidasNaRodada) && e.cartasMovidasNaRodada.every(function (id) { return vistos[id]; }), 'movimentos inválidos');
      checar(Array.isArray(e.revisoresDaRodada) && e.revisoresDaRodada.every(function (id, i, a) {
        return E.ehCoordenador(id) && a.indexOf(id) === i && !ocupados[id];
      }), 'revisores inválidos');
      checar(Array.isArray(e.doentes) && e.doentes.every(function (d) {
        return d && !!E.pessoa(d.pessoaId) && inteiro(d.rodada, 1, R.TOTAL_RODADAS);
      }), 'doentes inválidos');
      checar(Array.isArray(e.temporarios) && e.temporarios.every(function (t) {
        const p = t && E.pessoa(t.pessoaId);
        return !!p && p.somentePorEvento === true && inteiro(t.ateRodada, 1, R.TOTAL_RODADAS + R.DURACAO_TEMPORARIO);
      }), 'temporários inválidos');
      Object.keys(ocupados).forEach(function (id) {
        const p = E.pessoa(id);
        if (p && p.somentePorEvento) checar(!!E.registroTemporario(e, id), 'temporário ausente trabalhando');
      });
      checar(Array.isArray(e.descontosPendentes) && e.descontosPendentes.every(function (d) {
        return d && (d.tipo === 'percentual' || d.tipo === 'fixo') && typeof d.valor === 'number' && d.valor > 0 && typeof d.origem === 'string';
      }), 'descontos inválidos');
      checar(e.mutirao === null || (e.mutirao && inteiro(e.mutirao.rodada, 1, R.TOTAL_RODADAS) && typeof e.mutirao.usado === 'boolean'), 'mutirão inválido');

      // Livro-caixa e recursos
      if (checar(Array.isArray(e.livro), 'livro-caixa ausente')) {
        e.livro.forEach(function (l) {
          checar(l && RECURSOS.indexOf(l.recurso) !== -1 && typeof l.valor === 'number' && isFinite(l.valor) &&
            typeof l.tipo === 'string' && typeof l.descricao === 'string' && inteiro(l.rodada, 1, R.TOTAL_RODADAS), 'lançamento inválido');
        });
        const rec = E.recursos(e);
        checar(rec.dinheiro >= 0 && rec.prestigio >= 0 && rec.tradicao >= 0, 'recurso negativo');
        const retornos = e.livro.filter(function (l) { return l.tipo === 'retorno'; }).length;
        checar(retornos === E.totalConcluidos(e), 'retorno creditado mais de uma vez');
        const recompensas = e.livro.filter(function (l) { return l.tipo === 'recompensa'; }).length;
        checar(e.missaoCumprida ? recompensas >= 1 : recompensas === 0, 'recompensa da missão inconsistente');
      }
      checar(typeof e.missaoCumprida === 'boolean' && e.missaoCumprida === (E.totalConcluidos(e) >= missao.objetivo), 'missão inconsistente');
      checar(Array.isArray(e.historico), 'histórico ausente');
      if (e.fase === 'decisao') checar(!!e.pendente && !!OG.eventos.decisaoFimRodada(e), 'decisão pendente perdida');
      if (e.fase === 'resumo') checar(!!e.resumo && Array.isArray(e.resumo.linhas), 'resumo ausente');
    } catch (erro) {
      falhas.push('erro ao validar: ' + erro.message);
    }
    return falhas.length ? { ok: false, motivo: falhas.join('; ') } : { ok: true };
  }

  function armazenamentoPadrao() {
    try {
      return global.localStorage || null;
    } catch (erro) {
      return null;
    }
  }

  function salvar(estado, armazenamento) {
    const a = armazenamento || armazenamentoPadrao();
    if (!a) return false;
    try {
      a.setItem(CHAVE, JSON.stringify(estado));
      return true;
    } catch (erro) {
      return false;
    }
  }

  /** Retorna { estado, problema } — problema: null | 'vazio' | 'indisponivel' | 'corrompido' */
  function carregar(armazenamento) {
    const a = armazenamento || armazenamentoPadrao();
    if (!a) return { estado: null, problema: 'indisponivel' };
    let texto = null;
    try {
      texto = a.getItem(CHAVE);
    } catch (erro) {
      return { estado: null, problema: 'indisponivel' };
    }
    if (!texto) return { estado: null, problema: 'vazio' };
    let estado = null;
    try {
      estado = JSON.parse(texto);
    } catch (erro) {
      apagar(a);
      return { estado: null, problema: 'corrompido', motivo: 'JSON inválido' };
    }
    const v = validarEstado(estado);
    if (!v.ok) {
      apagar(a);
      return { estado: null, problema: 'corrompido', motivo: v.motivo };
    }
    return { estado: estado, problema: null };
  }

  function apagar(armazenamento) {
    const a = armazenamento || armazenamentoPadrao();
    if (!a) return false;
    try {
      a.removeItem(CHAVE);
      return true;
    } catch (erro) {
      return false;
    }
  }

  OG.persistencia = {
    CHAVE,
    validarEstado,
    salvar,
    carregar,
    apagar,
  };
})(globalThis);
