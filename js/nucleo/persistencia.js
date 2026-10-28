/*
 * persistencia.js — salvar/carregar a partida no navegador (localStorage).
 *
 * Nada que vem do armazenamento é confiável: antes de usar, o estado passa por
 * `validarEstado`, que confere estrutura, referências e as regras de integridade:
 * a agenda e todos os cards são recalculados a partir da semente e comparados
 * (prazos, origem, rodada de chegada), cada coordenador toca no máximo um projeto,
 * ninguém está em duas equipes, caixa >= 0, retorno e recompensa contados uma vez...
 * Se algo estiver errado, a partida salva é descartada.
 * Partidas da versão 1.0 (formato antigo) são descartadas com um aviso próprio.
 * Se o navegador bloquear o armazenamento, o jogo continua funcionando, só não salva.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const CHAVE = 'operacao-gremio-mesquita:partida';
  const FASES = ['evento', 'planejamento', 'decisao', 'resumo', 'fim'];
  const RECURSOS = ['dinheiro', 'prestigio', 'tradicao'];
  const COLUNAS = ['backlog', 'afazer', 'andamento', 'revisao', 'concluido'];

  const TIPOS_LANCAMENTO = ['inicial', 'custo', 'retorno', 'pontos', 'recompensa', 'despesa', 'receita', 'bonus', 'penalidade', 'desgaste'];
  const TIPOS_DE_EVENTO = ['despesa', 'receita', 'bonus', 'penalidade', 'desgaste'];
  const DESPESAS_OBRIGATORIAS = ['ev_reuniao', 'ev_transporte', 'ev_limpeza'];

  function inteiro(v, min, max) {
    return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
  }

  /** O evento desta rodada explica este lançamento (tipo, recurso e valor)? */
  function efeitoExplicado(eventoId, l) {
    const def = OG.dados.eventosPorId[eventoId];
    if (!def) return false;
    const ganho = def.ganho || {};
    switch (l.tipo) {
      case 'receita':
        return l.recurso === 'dinheiro' && l.valor === ganho.dinheiro;
      case 'bonus':
        return l.recurso === 'prestigio' && l.valor === ganho.prestigio;
      case 'penalidade': {
        // Prestígio nunca fica abaixo de 0: a perda pode ter sido menor que a da carta.
        const perda = def.perda || def.perdaSeRecusar;
        return !!perda && l.recurso === 'prestigio' && l.valor < 0 && -l.valor <= perda.prestigio;
      }
      case 'despesa': {
        if (!def.despesa || l.recurso !== 'dinheiro') return false;
        const valor = OG.dados.despesas[def.despesa].valor;
        // Despesa obrigatória sem caixa: paga-se o que havia (o resto vira desgaste).
        if (DESPESAS_OBRIGATORIAS.indexOf(eventoId) !== -1) return l.valor < 0 && -l.valor <= valor;
        return l.valor === -valor;
      }
      case 'desgaste': {
        if (DESPESAS_OBRIGATORIAS.indexOf(eventoId) === -1 || l.recurso !== 'prestigio') return false;
        const valor = OG.dados.despesas[def.despesa].valor;
        return l.valor < 0 && -l.valor <= Math.ceil(valor / OG.regras.REAIS_POR_PONTO_DE_DESGASTE);
      }
      default:
        return false;
    }
  }

  /**
   * Livro-caixa: todo lançamento precisa de uma origem que o explique.
   *  - inicial: um por recurso, na rodada 1, com os valores das regras;
   *  - custo / retorno / pontos: amarrados a um card (cartaId), uma vez por card e no valor certo;
   *  - recompensa: amarrada a uma missão (conferida junto com a agenda);
   *  - despesa / receita / bônus / penalidade / desgaste: o evento da rodada precisa explicar
   *    o lançamento, e cada efeito aparece no máximo uma vez por rodada.
   * Os saldos nunca ficam negativos em nenhum ponto do livro, que está em ordem de rodada.
   */
  function conferirLivro(e, onde, checar) {
    const R = OG.regras;
    const cfg = e.config;

    const esperadoInicial = {
      dinheiro: cfg.caixaApertado ? R.CAIXA_APERTADO : R.CAIXA_INICIAL,
      prestigio: R.PRESTIGIO_INICIAL,
      tradicao: R.TRADICAO_INICIAL,
    };
    const iniciais = e.livro.filter(function (l) { return l.tipo === 'inicial'; });
    checar(iniciais.length === 3 && RECURSOS.every(function (k) {
      return iniciais.filter(function (l) { return l.recurso === k && l.valor === esperadoInicial[k] && l.rodada === 1; }).length === 1;
    }), 'caixa inicial adulterado');

    const saldo = { dinheiro: 0, prestigio: 0, tradicao: 0 };
    let nuncaNegativo = true;
    let emOrdem = true;
    let rodadaAnterior = 1;
    e.livro.forEach(function (l) {
      saldo[l.recurso] += l.valor;
      if (saldo[l.recurso] < 0) nuncaNegativo = false;
      if (l.rodada < rodadaAnterior) emOrdem = false;
      rodadaAnterior = l.rodada;
    });
    checar(nuncaNegativo, 'recurso negativo');
    checar(emOrdem, 'livro-caixa fora de ordem');
    if (e.fase === 'evento') {
      checar(e.livro.every(function (l) { return l.rodada < e.rodada || l.tipo === 'inicial'; }), 'lançamento antes do evento da rodada');
    }

    // Por card.
    const porCarta = {};
    e.livro.forEach(function (l) {
      const deCarta = l.tipo === 'custo' || l.tipo === 'retorno' || l.tipo === 'pontos';
      if (!deCarta) {
        checar(l.cartaId === undefined, 'lançamento com card indevido');
        return;
      }
      if (!checar(typeof l.cartaId === 'string' && (onde[l.cartaId] === 'quadro' || onde[l.cartaId] === 'arquivo'),
        'lançamento de card desconhecido')) return;
      (porCarta[l.cartaId] = porCarta[l.cartaId] || []).push(l);
    });
    function doTipo(id, tipo) {
      return (porCarta[id] || []).filter(function (l) { return l.tipo === tipo; });
    }
    function conferirCusto(id, custoPago) {
      const custos = doTipo(id, 'custo');
      if (!custoPago) checar(custos.length === 0, 'custo cobrado sem início: ' + id);
      else checar(custos.length === 1 && custos[0].recurso === 'dinheiro' && custos[0].valor === -custoPago, 'custo cobrado errado: ' + id);
    }
    e.cartas.forEach(function (c) {
      conferirCusto(c.id, c.custoPago);
      const retornos = doTipo(c.id, 'retorno');
      const pontos = doTipo(c.id, 'pontos');
      if (c.coluna !== 'concluido') {
        checar(!retornos.length && !pontos.length, 'retorno pago sem conclusão: ' + c.id);
        return;
      }
      checar(retornos.length === 1 && retornos[0].recurso === 'dinheiro' && retornos[0].valor === c.retornoRecebido &&
        retornos[0].rodada === c.concluidoNaRodada, 'retorno pago errado: ' + c.id);
      const proj = OG.dados.projetosPorId[c.projetoId];
      ['prestigio', 'tradicao'].forEach(function (k) {
        const devido = c.noPrazo ? proj[k] : 0;
        const l = pontos.filter(function (x) { return x.recurso === k; });
        checar(devido ? l.length === 1 && l[0].valor === devido : l.length === 0, 'pontos do projeto errados: ' + c.id);
      });
      checar(pontos.every(function (x) { return x.recurso !== 'dinheiro'; }), 'pontos do projeto errados: ' + c.id);
    });
    e.arquivo.forEach(function (a) {
      conferirCusto(a.id, a.custoPago);
      checar(!doTipo(a.id, 'retorno').length && !doTipo(a.id, 'pontos').length, 'retorno de card vencido: ' + a.id);
    });

    // Efeitos de evento: explicados pelo evento da rodada, no máximo um de cada por rodada.
    const vistos = {};
    e.livro.forEach(function (l) {
      if (TIPOS_DE_EVENTO.indexOf(l.tipo) === -1) return;
      checar(l.cartaId === undefined && l.missaoId === undefined, 'lançamento com card indevido');
      const chave = l.rodada + '|' + l.tipo + '|' + l.recurso;
      checar(!vistos[chave], 'efeito de evento repetido na rodada ' + l.rodada);
      vistos[chave] = true;
      checar(efeitoExplicado(e.baralho[l.rodada - 1], l), 'lançamento que o evento da rodada ' + l.rodada + ' não explica');
    });
    e.baralho.forEach(function (id, i) {
      if (id !== 'ev_impressoes') return;
      const r = i + 1;
      checar(!(vistos[r + '|despesa|dinheiro'] && vistos[r + '|penalidade|prestigio']), 'Impressões pagas e recusadas na mesma rodada');
    });
  }

  function validarEstado(e) {
    const falhas = [];
    function checar(cond, msg) {
      if (!cond) falhas.push(msg);
      return !!cond;
    }
    function resultado() {
      return falhas.length ? { ok: false, motivo: falhas.join('; ') } : { ok: true };
    }

    try {
      if (!checar(e && typeof e === 'object' && !Array.isArray(e), 'estado não é um objeto')) return resultado();
      const R = OG.regras;
      const E = OG.estado;
      if (!checar(e.versao === R.VERSAO_ESTADO, 'versão diferente')) return resultado();

      // ---------- Configuração ----------
      const cfg = e.config;
      if (!checar(cfg && typeof cfg === 'object', 'configuração ausente')) return resultado();
      checar(!!OG.dados.missoesPorId[cfg.missaoId], 'missão desconhecida');
      checar(!!OG.regrasUtil.duracao(cfg.duracao), 'duração inválida');
      checar(inteiro(cfg.semente, 1, 4294967295), 'semente inválida');
      checar(typeof cfg.caixaApertado === 'boolean', 'modo de caixa inválido');
      if (falhas.length) return resultado();
      const n = cfg.duracao;
      checar(inteiro(e.rng, 0, 4294967295), 'sorteio inválido');
      if (!checar(inteiro(e.rodada, 1, n), 'rodada inválida')) return resultado();
      checar(FASES.indexOf(e.fase) !== -1, 'fase inválida');

      // ---------- Agenda (recalculada a partir da semente) ----------
      const agendaEsperada = OG.agenda.montarAgenda(cfg);
      if (checar(Array.isArray(e.agenda) && e.agenda.length === agendaEsperada.length, 'agenda inválida')) {
        e.agenda.forEach(function (a, i) {
          const esp = agendaEsperada[i];
          checar(a && a.missaoId === esp.missaoId && a.abre === esp.abre && a.data === esp.data, 'agenda adulterada');
          checar(a && typeof a.cumprida === 'boolean' && typeof a.perdida === 'boolean' && !(a.cumprida && a.perdida), 'situação de missão inválida');
          if (a && a.cumprida) checar(inteiro(a.cumpridaNaRodada, esp.abre, esp.data), 'rodada de missão cumprida inválida');
          else if (a) checar(a.cumpridaNaRodada === null, 'rodada de missão cumprida inválida');
        });
      }
      if (falhas.length) return resultado();

      // ---------- Cards: cada um precisa bater com a programação recalculada ----------
      const programacao = OG.agenda.montarProgramacao(cfg, agendaEsperada);
      const definicao = {};
      programacao.forEach(function (p) { definicao[p.id] = p; });
      const onde = {};
      function registrar(x, lugar) {
        const def = x && typeof x === 'object' ? definicao[x.id] : null;
        if (!checar(!!def, 'card desconhecido (' + lugar + ')')) return null;
        checar(!onde[x.id], 'card repetido: ' + x.id);
        onde[x.id] = lugar;
        return def;
      }
      if (!checar(Array.isArray(e.programacao) && Array.isArray(e.cartas) && Array.isArray(e.arquivo), 'listas de cards ausentes')) {
        return resultado();
      }
      e.programacao.forEach(function (p) {
        const def = registrar(p, 'programação');
        if (!def) return;
        checar(p.rodada === def.rodada && p.projetoId === def.projetoId && p.prazo === def.prazo &&
          p.origem === def.origem && p.missaoId === def.missaoId && def.rodada > e.rodada, 'programação adulterada');
      });
      e.arquivo.forEach(function (a) {
        const def = registrar(a, 'arquivo');
        if (!def) return;
        checar(a.projetoId === def.projetoId && a.prazo === def.prazo && a.origem === def.origem &&
          a.missaoId === def.missaoId && a.motivo === 'vencido' && inteiro(a.rodada, def.prazo, e.rodada) &&
          (a.custoPago === null || inteiro(a.custoPago, 0, OG.dados.projetosPorId[def.projetoId].custo)) &&
          (a.coluna === 'backlog' || a.coluna === 'afazer') &&
          (a.responsavel === null || E.ehCoordenador(a.responsavel)), 'card vencido adulterado');
      });

      const ocupados = {};
      const tocando = {};
      const filas = {};
      let maiorOrdem = -1;
      e.cartas.forEach(function (c) {
        const def = registrar(c, 'quadro');
        if (!def) return;
        const proj = OG.dados.projetosPorId[c.projetoId];
        checar(c.projetoId === def.projetoId && c.origem === def.origem && c.missaoId === def.missaoId &&
          c.prazo === def.prazo && c.chegada === def.rodada && def.rodada <= e.rodada, 'card adulterado: ' + c.id);
        if (!checar(COLUNAS.indexOf(c.coluna) !== -1, 'coluna inválida')) return;
        checar(typeof c.ordem === 'number' && isFinite(c.ordem), 'ordem inválida');
        maiorOrdem = Math.max(maiorOrdem, c.ordem);
        if (!checar(Array.isArray(c.equipe) && Array.isArray(c.equipeFinal) && Array.isArray(c.custoItens), 'listas do card')) return;
        // Descontos só diminuem o custo: nunca se paga mais do que o card custa.
        checar(c.custoPago === null || inteiro(c.custoPago, 0, proj.custo), 'custo pago inválido');
        checar(typeof c.recompensado === 'boolean' && c.recompensado === (c.coluna === 'concluido'), 'recompensa inconsistente: ' + c.id);
        checar(c.responsavel === null || E.ehCoordenador(c.responsavel), 'responsável inválido');

        if (c.coluna === 'backlog') {
          checar(c.responsavel === null && c.custoPago === null && c.progresso === 0 && c.tempoTotal === null &&
            c.iniciadoNaRodada === null && c.equipe.length === 0, 'card do backlog inconsistente');
        }
        if (c.coluna === 'afazer') {
          checar(!!c.responsavel && c.progresso === 0 && c.tempoTotal === null && c.iniciadoNaRodada === null &&
            c.equipe.length === 0, 'card de A FAZER inconsistente');
          if (c.responsavel) filas[c.responsavel] = (filas[c.responsavel] || 0) + 1;
        }
        const iniciado = c.coluna === 'andamento' || c.coluna === 'revisao' || c.coluna === 'concluido';
        if (iniciado) {
          checar(!!c.responsavel && c.custoPago !== null, 'projeto sem responsável ou sem custo pago: ' + c.id);
          checar(!!c.responsavel && c.tempoTotal === E.tempoComCoordenador(proj, c.responsavel), 'tempo do projeto adulterado');
          checar(inteiro(c.iniciadoNaRodada, c.chegada, e.rodada), 'rodada de início inválida');
        }
        if (c.coluna === 'andamento') {
          checar(inteiro(c.progresso, 0, (c.tempoTotal || 1) - 1), 'progresso inválido');
          checar(!tocando[c.responsavel], 'coordenador tocando dois projetos');
          tocando[c.responsavel] = true;
          c.equipe.forEach(function (id) {
            checar(E.ehVoluntario(id), 'coordenador ou pessoa desconhecida na equipe');
            checar(!ocupados[id], 'pessoa em duas equipes: ' + id);
            ocupados[id] = true;
          });
        } else {
          checar(c.equipe.length === 0, 'equipe fora de EM ANDAMENTO');
        }
        if (c.coluna === 'revisao' || c.coluna === 'concluido') checar(c.progresso === c.tempoTotal, 'revisão sem execução completa');
        if (c.coluna === 'concluido') {
          checar(E.ehCoordenador(c.revisor) && c.revisor !== c.responsavel, 'revisor inválido');
          checar(inteiro(c.concluidoNaRodada, 1, e.rodada) && c.noPrazo === (c.concluidoNaRodada <= c.prazo), 'conclusão inconsistente');
          const esperado = c.noPrazo ? proj.retorno : Math.floor(proj.retorno * R.FRACAO_RETORNO_ATRASADO);
          checar(c.retornoRecebido === esperado, 'retorno adulterado');
        } else {
          checar(c.revisor === null && c.noPrazo === null && c.retornoRecebido === null && c.concluidoNaRodada === null,
            'card aberto com dados de conclusão');
        }
      });
      programacao.forEach(function (p) {
        if (p.rodada <= e.rodada) checar(onde[p.id] === 'quadro' || onde[p.id] === 'arquivo', 'card sumiu: ' + p.id);
        else checar(onde[p.id] === 'programação', 'programação incompleta');
      });
      Object.keys(filas).forEach(function (id) {
        checar(filas[id] <= R.FILA_POR_COORDENADOR + 2, 'fila de A FAZER grande demais');
      });
      checar(typeof e.proximaOrdem === 'number' && e.proximaOrdem > maiorOrdem, 'ordem dos cards');

      // ---------- Baralho e evento ----------
      const idsBaralho = OG.dados.eventos.map(function (ev) { return ev.id; });
      checar(Array.isArray(e.baralho) && e.baralho.length === n && e.baralho.every(function (id) {
        return idsBaralho.indexOf(id) !== -1;
      }), 'baralho inválido');
      if (checar(e.eventoAtual && typeof e.eventoAtual === 'object', 'evento atual ausente')) {
        checar(e.eventoAtual.id === e.baralho[e.rodada - 1] && e.eventoAtual.rodada === e.rodada, 'evento fora de ordem');
        if (e.fase === 'evento') checar(e.eventoAtual.resolvido === false, 'evento já resolvido');
        else checar(e.eventoAtual.resolvido === true, 'evento não resolvido');
        checar(e.eventoAtual.alvo === null || !!E.pessoa(e.eventoAtual.alvo), 'alvo do evento inválido');
      }

      // ---------- Pessoas ----------
      checar(Array.isArray(e.cartasMovidasNaRodada) && e.cartasMovidasNaRodada.every(function (id) {
        return onde[id] === 'quadro';
      }), 'movimentos inválidos');
      checar(Array.isArray(e.revisoresDaRodada) && e.revisoresDaRodada.every(function (id, i, a) {
        return E.ehCoordenador(id) && a.indexOf(id) === i;
      }), 'revisores inválidos');
      checar(Array.isArray(e.doentes) && e.doentes.every(function (d) {
        return d && !!E.pessoa(d.pessoaId) && inteiro(d.rodada, 1, n);
      }), 'doentes inválidos');
      checar(Array.isArray(e.temporarios) && e.temporarios.every(function (t, i, a) {
        const p = t && E.pessoa(t.pessoaId);
        return !!p && p.somentePorEvento === true && inteiro(t.ateRodada, 1, n + R.DURACAO_TEMPORARIO) &&
          a.findIndex(function (x) { return x.pessoaId === t.pessoaId; }) === i;
      }), 'temporários inválidos');
      if (Array.isArray(e.temporarios)) {
        Object.keys(ocupados).forEach(function (id) {
          const p = E.pessoa(id);
          if (p && p.somentePorEvento) checar(!!E.registroTemporario(e, id), 'temporário ausente trabalhando');
        });
      }
      checar(Array.isArray(e.descontosPendentes) && e.descontosPendentes.every(function (d) {
        return d && (d.tipo === 'percentual' || d.tipo === 'fixo') && typeof d.valor === 'number' && d.valor > 0 && typeof d.origem === 'string';
      }), 'descontos inválidos');
      checar(e.mutirao === null || (e.mutirao && inteiro(e.mutirao.rodada, 1, n) && typeof e.mutirao.usado === 'boolean'), 'mutirão inválido');

      // ---------- Livro-caixa e recursos ----------
      if (checar(Array.isArray(e.livro), 'livro-caixa ausente')) {
        e.livro.forEach(function (l) {
          checar(l && RECURSOS.indexOf(l.recurso) !== -1 && typeof l.valor === 'number' && Number.isInteger(l.valor) &&
            l.valor !== 0 && TIPOS_LANCAMENTO.indexOf(l.tipo) !== -1 && typeof l.descricao === 'string' &&
            inteiro(l.rodada, 1, e.rodada), 'lançamento inválido');
        });
        if (!falhas.length) conferirLivro(e, onde, checar);
      }

      // ---------- Missões ----------
      if (!falhas.length) {
        e.agenda.forEach(function (a) {
          const m = OG.dados.missoesPorId[a.missaoId];
          const progresso = E.progressoMissao(e, a.missaoId);
          checar(a.cumprida === (progresso >= m.objetivo), 'missão cumprida inconsistente');
          const passou = a.data < e.rodada || (a.data === e.rodada && (e.fase === 'resumo' || e.fase === 'fim'));
          checar(a.perdida === (!a.cumprida && passou), 'missão perdida inconsistente');
          const lancamentos = e.livro.filter(function (l) { return l.tipo === 'recompensa' && l.missaoId === a.missaoId; });
          const esperado = a.cumprida ? RECURSOS.filter(function (k) { return m.recompensa[k]; }) : [];
          checar(lancamentos.length === esperado.length && esperado.every(function (k) {
            return lancamentos.filter(function (l) { return l.recurso === k && l.valor === m.recompensa[k]; }).length === 1;
          }), 'recompensa de missão inconsistente');
        });
        checar(e.livro.every(function (l) {
          return l.tipo !== 'recompensa' || e.agenda.some(function (a) { return a.missaoId === l.missaoId; });
        }), 'recompensa de missão fora da agenda');
      }

      checar(Array.isArray(e.historico), 'histórico ausente');
      if (e.fase === 'decisao') checar(!!e.pendente && !!OG.eventos.decisaoFimRodada(e), 'decisão pendente perdida');
      if (e.fase === 'resumo' || e.fase === 'fim') checar(!!e.resumo && Array.isArray(e.resumo.linhas), 'resumo ausente');
    } catch (erro) {
      falhas.push('erro ao validar: ' + erro.message);
    }
    return resultado();
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

  /** Retorna { estado, problema } — problema: null | 'vazio' | 'indisponivel' | 'antigo' | 'corrompido' */
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
    if (estado && typeof estado === 'object' && typeof estado.versao === 'number' && estado.versao < OG.regras.VERSAO_ESTADO) {
      apagar(a);
      return { estado: null, problema: 'antigo', motivo: 'partida da versão ' + estado.versao };
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
