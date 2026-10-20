/*
 * kanban.js — regras de movimentação dos cards.
 *
 * Fluxo: BACKLOG -> A FAZER -> EM ANDAMENTO -> REVISÃO -> CONCLUÍDO
 *   - BACKLOG <-> A FAZER: planejamento (livre).
 *   - A FAZER -> EM ANDAMENTO: exige vaga (máx. 2), equipe completa e caixa. Paga o custo UMA vez.
 *   - EM ANDAMENTO -> REVISÃO: automático no fim da rodada quando o progresso completa
 *     (ou na hora, com o Mutirão). O jogador não consegue "pular" a execução.
 *   - REVISÃO -> CONCLUÍDO: um coordenador livre confere. Credita retorno e pontos UMA vez.
 *   - Cards iniciados não voltam por ação do jogador (só por evento).
 *
 * Toda regra é validada AQUI, no núcleo. A interface só reflete o resultado.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const ORDEM = ['backlog', 'afazer', 'andamento', 'revisao', 'concluido'];

  function E() { return OG.estado; }
  function exigir(c, m) { OG.estado.exigir(c, m); }
  function nomeColuna(id) {
    const col = OG.regras.COLUNAS.find(function (c) { return c.id === id; });
    return col ? col.nome.toUpperCase() : id;
  }

  function mensagemFase(estado) {
    switch (estado.fase) {
      case 'evento': return 'Primeiro confira o evento da rodada.';
      case 'decisao': return 'Primeiro decida o efeito do evento no fim da rodada.';
      case 'resumo': return 'A rodada terminou. Avance para a próxima rodada.';
      case 'fim': return 'A partida acabou.';
      default: return 'Ação indisponível agora.';
    }
  }

  function validarFase(estado) {
    exigir(estado.fase === 'planejamento', mensagemFase(estado));
  }

  function obterCarta(estado, cartaId) {
    const c = E().carta(estado, cartaId);
    exigir(!!c, 'Card não encontrado.');
    return c;
  }

  function validarProvas(estado, c) {
    if (!E().eventoAtivo(estado, 'ev_provas')) return;
    const movidas = estado.cartasMovidasNaRodada;
    if (movidas.length === 0 || movidas.indexOf(c.id) !== -1) return;
    const outra = E().carta(estado, movidas[0]);
    exigir(false, 'Semana de Provas: só um card pode ser movimentado nesta rodada, e já foi “' +
      E().projetoDaCarta(outra).nome + '”.');
  }

  function validarNaoCongelada(estado, c) {
    const motivo = E().bloqueioDaCarta(estado, c);
    exigir(!motivo, motivo);
  }

  function registrarMovimento(estado, c) {
    if (estado.cartasMovidasNaRodada.indexOf(c.id) === -1) estado.cartasMovidasNaRodada.push(c.id);
  }

  function moverPara(estado, c, coluna) {
    c.coluna = coluna;
    c.ordem = estado.proximaOrdem++;
  }

  function historico(estado, tipo, texto) {
    estado.historico.push({ rodada: estado.rodada, tipo: tipo, texto: texto });
  }

  // ---------------- Planejamento (BACKLOG <-> A FAZER) ----------------

  function validarPlanejar(estado, c) {
    validarFase(estado);
    exigir(c.coluna === 'backlog', 'Só cards do BACKLOG podem ir para A FAZER.');
    validarNaoCongelada(estado, c);
    validarProvas(estado, c);
  }

  function planejar(estado, cartaId) {
    const c = obterCarta(estado, cartaId);
    validarPlanejar(estado, c);
    moverPara(estado, c, 'afazer');
    registrarMovimento(estado, c);
    historico(estado, 'acao', E().projetoDaCarta(c).nome + ' foi para A FAZER.');
  }

  function validarDesplanejar(estado, c) {
    validarFase(estado);
    exigir(c.coluna === 'afazer', 'Só cards de A FAZER podem voltar para o BACKLOG.');
    exigir(c.custoPago === null, 'Este projeto já foi pago: ele fica em A FAZER até ser retomado.');
    validarProvas(estado, c);
  }

  function desplanejar(estado, cartaId) {
    const c = obterCarta(estado, cartaId);
    validarDesplanejar(estado, c);
    moverPara(estado, c, 'backlog');
    registrarMovimento(estado, c);
    historico(estado, 'acao', E().projetoDaCarta(c).nome + ' voltou para o BACKLOG.');
  }

  // ---------------- Início (A FAZER -> EM ANDAMENTO) ----------------

  function iniciadosNaRodada(estado) {
    return estado.cartas.filter(function (c) {
      return c.iniciadoNaRodada === estado.rodada && c.coluna !== 'backlog' && c.coluna !== 'afazer';
    });
  }

  /** Pessoas que poderiam entrar na equipe deste card agora. */
  function candidatos(estado, c) {
    const proj = E().projetoDaCarta(c);
    const restante = proj.tempo - c.progresso;
    return E().pessoasLivres(estado).filter(function (p) {
      return E().rodadasRestantes(estado, p.id) >= restante;
    });
  }

  /** Validações que não dependem da equipe escolhida (usadas também no arrastar). */
  function validarPreInicio(estado, c) {
    validarFase(estado);
    exigir(c.coluna === 'afazer',
      c.coluna === 'backlog'
        ? 'Primeiro planeje: mova o card para A FAZER.'
        : 'Só cards em A FAZER podem ser iniciados.');
    if (E().eventoAtivo(estado, 'ev_chimarrao')) {
      const iniciado = iniciadosNaRodada(estado)[0];
      exigir(!iniciado,
        'Acabou o Chimarrão: a equipe só teve força para começar um projeto nesta rodada' +
        (iniciado ? ' (já começou “' + E().projetoDaCarta(iniciado).nome + '”).' : '.'));
    }
    validarProvas(estado, c);
    validarNaoCongelada(estado, c);
    const emAndamento = E().cartasNaColuna(estado, 'andamento').length;
    exigir(emAndamento < OG.regras.LIMITE_EM_ANDAMENTO,
      'Limite atingido: já há ' + OG.regras.LIMITE_EM_ANDAMENTO +
      ' projetos EM ANDAMENTO. Espere um terminar a execução.');

    const proj = E().projetoDaCarta(c);
    const cand = candidatos(estado, c);
    exigir(cand.length >= proj.trabalhadores,
      'Falta gente: este projeto precisa de ' + proj.trabalhadores + ' ' +
      OG.util.plural(proj.trabalhadores, 'pessoa livre', 'pessoas livres') + ' e há ' + cand.length + '.');

    if (c.custoPago === null) {
      // Melhor caso: tantos especialistas quanto possível.
      const especialistas = cand.filter(function (p) { return E().ehEspecialista(p, proj); })
        .slice(0, proj.trabalhadores)
        .map(function (p) { return p.id; });
      const melhor = OG.financas.calcularCusto(estado, c, especialistas);
      const disponivel = OG.financas.caixa(estado);
      exigir(disponivel >= melhor.final,
        'Caixa insuficiente: iniciar ' + proj.nome + ' custa ' + OG.util.formatarDinheiro(melhor.final) +
        ' e o caixa tem ' + OG.util.formatarDinheiro(disponivel) + '.');
    }
  }

  function validarEquipe(estado, c, equipe) {
    const proj = E().projetoDaCarta(c);
    exigir(Array.isArray(equipe), 'Escolha a equipe do projeto.');
    const unicos = equipe.filter(function (id, i) { return equipe.indexOf(id) === i; });
    exigir(unicos.length === equipe.length, 'A mesma pessoa foi escolhida duas vezes.');
    exigir(equipe.length === proj.trabalhadores,
      proj.nome + ' precisa de exatamente ' + proj.trabalhadores + ' ' +
      OG.util.plural(proj.trabalhadores, 'pessoa', 'pessoas') + ' (escolhidas: ' + equipe.length + ').');
    const restante = proj.tempo - c.progresso;
    equipe.forEach(function (id) {
      const p = E().pessoa(id);
      exigir(!!p, 'Pessoa desconhecida na equipe.');
      const st = E().statusPessoa(estado, id);
      exigir(st.codigo === 'livre', p.nome + ' não está disponível: ' + st.texto.toLowerCase() + '.');
      const fica = E().rodadasRestantes(estado, id);
      exigir(fica >= restante,
        p.nome + ' só fica mais ' + fica + ' ' + OG.util.plural(fica, 'rodada', 'rodadas') +
        ', e este projeto precisa de ' + restante + '.');
    });
  }

  function validarInicio(estado, c, equipe) {
    validarPreInicio(estado, c);
    validarEquipe(estado, c, equipe);
    const custo = OG.financas.calcularCusto(estado, c, equipe);
    const disponivel = OG.financas.caixa(estado);
    exigir(disponivel >= custo.final,
      'Caixa insuficiente: com essa equipe o projeto custa ' + OG.util.formatarDinheiro(custo.final) +
      ' e o caixa tem ' + OG.util.formatarDinheiro(disponivel) + '.');
    return custo;
  }

  function iniciar(estado, cartaId, equipe) {
    const c = obterCarta(estado, cartaId);
    const proj = E().projetoDaCarta(c);
    const custo = validarInicio(estado, c, equipe);
    const fmt = OG.util.formatarDinheiro;

    if (custo.jaPago) {
      historico(estado, 'acao', proj.nome + ' foi retomado. O custo já tinha sido pago, nada foi cobrado.');
    } else {
      if (custo.final > 0) {
        OG.financas.lancar(estado, 'dinheiro', -custo.final, 'custo', 'Início: ' + proj.nome);
      }
      c.custoPago = custo.final;
      c.custoItens = custo.itens;
      const usados = estado.descontosPendentes.map(function (d) { return d.origem; });
      estado.descontosPendentes = [];
      let texto = proj.nome + ' começou. Custo pago: ' + fmt(custo.final);
      if (custo.itens.length) texto += ' (base ' + fmt(custo.base) + ')';
      if (usados.length) texto += '. Desconto usado: ' + OG.util.listaPt(usados);
      historico(estado, 'acao', texto + '.');
    }

    moverPara(estado, c, 'andamento');
    c.equipe = equipe.slice();
    c.iniciadoNaRodada = estado.rodada;
    registrarMovimento(estado, c);
  }

  // ---------------- Revisão (REVISÃO -> CONCLUÍDO) ----------------

  function validarPreRevisao(estado, c) {
    validarFase(estado);
    exigir(c.coluna === 'revisao',
      c.coluna === 'andamento'
        ? 'O projeto ainda está em execução. Ele vai para REVISÃO no fim da rodada em que completar o progresso.'
        : 'Só cards em REVISÃO podem ser concluídos.');
    validarProvas(estado, c);
    validarNaoCongelada(estado, c);
    exigir(E().coordenadoresLivres(estado).length > 0,
      'Nenhum coordenador livre para revisar. Coordenadores em projetos, doentes ou que já revisaram nesta rodada não podem revisar.');
  }

  function validarRevisao(estado, c, revisorId) {
    validarPreRevisao(estado, c);
    const p = E().pessoa(revisorId);
    exigir(!!p, 'Escolha um coordenador para revisar.');
    exigir(E().ehCoordenador(revisorId), 'Só coordenadores fazem a revisão final. ' + p.nome + ' é voluntário.');
    const st = E().statusPessoa(estado, revisorId);
    exigir(st.codigo === 'livre', p.nome + ' não está disponível: ' + st.texto.toLowerCase() + '.');
  }

  function verificarMissao(estado) {
    if (estado.missaoCumprida) return;
    const m = E().missao(estado);
    if (E().totalConcluidos(estado) < m.objetivo) return;
    estado.missaoCumprida = true;
    const rec = m.recompensa;
    const partes = [];
    if (rec.dinheiro) {
      OG.financas.lancar(estado, 'dinheiro', rec.dinheiro, 'recompensa', 'Missão cumprida: ' + m.nome);
      partes.push(OG.util.formatarDinheiroComSinal(rec.dinheiro));
    }
    if (rec.prestigio) {
      OG.financas.lancar(estado, 'prestigio', rec.prestigio, 'recompensa', 'Missão cumprida: ' + m.nome);
      partes.push('+' + rec.prestigio + ' Prestígio');
    }
    if (rec.tradicao) {
      OG.financas.lancar(estado, 'tradicao', rec.tradicao, 'recompensa', 'Missão cumprida: ' + m.nome);
      partes.push('+' + rec.tradicao + ' Tradição');
    }
    historico(estado, 'missao', 'MISSÃO CUMPRIDA: ' + m.nome + '! Recompensa: ' + OG.util.listaPt(partes) + '.');
  }

  function revisar(estado, cartaId, revisorId) {
    const c = obterCarta(estado, cartaId);
    validarRevisao(estado, c, revisorId);
    const proj = E().projetoDaCarta(c);

    moverPara(estado, c, 'concluido');
    c.revisor = revisorId;
    c.concluidoNaRodada = estado.rodada;
    estado.revisoresDaRodada.push(revisorId);
    registrarMovimento(estado, c);

    if (!c.recompensado) {
      c.recompensado = true;
      OG.financas.lancar(estado, 'dinheiro', proj.retorno, 'retorno', 'Concluído: ' + proj.nome);
      if (proj.prestigio) OG.financas.lancar(estado, 'prestigio', proj.prestigio, 'pontos', 'Concluído: ' + proj.nome);
      if (proj.tradicao) OG.financas.lancar(estado, 'tradicao', proj.tradicao, 'pontos', 'Concluído: ' + proj.nome);
      const lucro = proj.retorno - (c.custoPago || 0);
      historico(estado, 'acao', proj.nome + ' CONCLUÍDO (revisão: ' + E().pessoa(revisorId).nome + '). Retorno ' +
        OG.util.formatarDinheiro(proj.retorno) + ', lucro do projeto ' + OG.util.formatarDinheiro(lucro) + '.');
    }
    verificarMissao(estado);
  }

  // ---------------- Completar equipe ----------------

  function completarEquipe(estado, cartaId, pessoaId) {
    validarFase(estado);
    const c = obterCarta(estado, cartaId);
    const proj = E().projetoDaCarta(c);
    exigir(c.coluna === 'andamento', 'Só projetos EM ANDAMENTO recebem reforço na equipe.');
    exigir(c.equipe.length < proj.trabalhadores, 'A equipe deste projeto já está completa.');
    const p = E().pessoa(pessoaId);
    exigir(!!p, 'Pessoa desconhecida.');
    const st = E().statusPessoa(estado, pessoaId);
    exigir(st.codigo === 'livre', p.nome + ' não está disponível: ' + st.texto.toLowerCase() + '.');
    const restante = proj.tempo - c.progresso;
    const fica = E().rodadasRestantes(estado, pessoaId);
    exigir(fica >= restante, p.nome + ' só fica mais ' + fica + ' ' + OG.util.plural(fica, 'rodada', 'rodadas') + '.');
    c.equipe.push(pessoaId);
    historico(estado, 'acao', p.nome + ' reforçou a equipe de ' + proj.nome + '.');
  }

  // ---------------- Mutirão ----------------

  function mutiraoDisponivel(estado) {
    return estado.fase === 'planejamento' &&
      !!estado.mutirao &&
      estado.mutirao.rodada === estado.rodada &&
      !estado.mutirao.usado;
  }

  function usarMutirao(estado, cartaId) {
    validarFase(estado);
    exigir(mutiraoDisponivel(estado), 'Não há Mutirão disponível nesta rodada.');
    const c = obterCarta(estado, cartaId);
    exigir(c.coluna === 'andamento', 'O Mutirão só ajuda projetos EM ANDAMENTO.');
    validarNaoCongelada(estado, c);
    const proj = E().projetoDaCarta(c);
    c.progresso += 1;
    estado.mutirao.usado = true;
    if (c.progresso >= proj.tempo) {
      moverPara(estado, c, 'revisao');
      c.equipeFinal = c.equipe.slice();
      c.equipe = [];
      historico(estado, 'acao', 'Mutirão da Gurizada: ' + proj.nome + ' terminou a execução na hora e foi para REVISÃO.');
    } else {
      historico(estado, 'acao', 'Mutirão da Gurizada: ' + proj.nome + ' avançou para ' + c.progresso + '/' + proj.tempo + '.');
    }
  }

  // ---------------- Arrastar e soltar ----------------

  /**
   * Diz se o card pode ir para a coluna e qual ação isso dispara.
   * acao: 'planejar' | 'desplanejar' | 'iniciar' (pede equipe) | 'revisar' (pede revisor)
   */
  function avaliarMovimento(estado, cartaId, destino) {
    const c = E().carta(estado, cartaId);
    if (!c) return { ok: false, motivo: 'Card não encontrado.' };
    if (c.coluna === destino) return { ok: false, motivo: 'O card já está em ' + nomeColuna(destino) + '.', mesmaColuna: true };
    const de = ORDEM.indexOf(c.coluna);
    const para = ORDEM.indexOf(destino);
    if (para === -1) return { ok: false, motivo: 'Coluna inválida.' };
    try {
      if (c.coluna === 'backlog' && destino === 'afazer') { validarPlanejar(estado, c); return { ok: true, acao: 'planejar' }; }
      if (c.coluna === 'afazer' && destino === 'backlog') { validarDesplanejar(estado, c); return { ok: true, acao: 'desplanejar' }; }
      if (c.coluna === 'afazer' && destino === 'andamento') { validarPreInicio(estado, c); return { ok: true, acao: 'iniciar' }; }
      if (c.coluna === 'revisao' && destino === 'concluido') { validarPreRevisao(estado, c); return { ok: true, acao: 'revisar' }; }
    } catch (erro) {
      if (erro instanceof OG.estado.ErroDeRegra) return { ok: false, motivo: erro.message };
      throw erro;
    }
    if (estado.fase !== 'planejamento') return { ok: false, motivo: mensagemFase(estado) };
    if (c.coluna === 'concluido') return { ok: false, motivo: 'Projetos concluídos não mudam mais de coluna.' };
    if (para < de) {
      return { ok: false, motivo: 'Projetos iniciados não voltam: o custo já foi pago e a equipe está trabalhando.' };
    }
    if (c.coluna === 'backlog') return { ok: false, motivo: 'Primeiro planeje: mova o card para A FAZER.' };
    if (c.coluna === 'afazer') return { ok: false, motivo: 'Antes o projeto precisa ser executado: inicie-o em EM ANDAMENTO.' };
    if (c.coluna === 'andamento') {
      return { ok: false, motivo: 'A execução não pode ser pulada: o card vai sozinho para REVISÃO no fim da rodada em que completar o progresso.' };
    }
    return { ok: false, motivo: 'Movimento não permitido.' };
  }

  OG.kanban = {
    ORDEM,
    nomeColuna,
    mensagemFase,
    iniciadosNaRodada,
    candidatos,
    validarPreInicio,
    validarInicio,
    validarPreRevisao,
    validarRevisao,
    planejar,
    desplanejar,
    iniciar,
    revisar,
    completarEquipe,
    mutiraoDisponivel,
    usarMutirao,
    avaliarMovimento,
    verificarMissao,
  };
})(globalThis);
