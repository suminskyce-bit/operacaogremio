/*
 * kanban.js — regras de movimentação dos cards.
 *
 * Fluxo: BACKLOG -> A FAZER -> EM ANDAMENTO -> REVISÃO -> CONCLUÍDO
 *   - BACKLOG -> A FAZER (planejar): escolhe o coordenador RESPONSÁVEL.
 *     Cada coordenador tem até 2 cards em A Fazer. Dá para trocar o responsável
 *     enquanto o card está em A Fazer, ou devolvê-lo ao Backlog.
 *   - A FAZER -> EM ANDAMENTO (iniciar): o responsável precisa estar livre (toca um
 *     projeto por vez) e a equipe de voluntários precisa completar a FORÇA do card,
 *     sem ninguém sobrando. Paga o custo UMA vez. O tempo fica fixado: o do card,
 *     +1 rodada se o projeto estiver fora da área do responsável.
 *   - EM ANDAMENTO -> REVISÃO: automático no fim da rodada quando a execução completa
 *     (ou na hora, com o Mutirão). O jogador não consegue "pular" a execução.
 *   - REVISÃO -> CONCLUÍDO (revisar): outro coordenador confere (ninguém revisa o
 *     próprio projeto; cada um revisa 1 por rodada). Credita retorno e pontos UMA vez;
 *     depois do prazo, só metade do retorno e nada de prestígio/tradição.
 *   - Cards iniciados não voltam por ação do jogador (só por evento).
 *
 * Toda regra é validada AQUI, no núcleo. A interface só reflete o resultado.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const ORDEM = ['backlog', 'afazer', 'andamento', 'revisao', 'concluido'];

  function E() { return OG.estado; }
  function R() { return OG.regras; }
  function exigir(c, m) { OG.estado.exigir(c, m); }
  function fmt(v) { return OG.util.formatarDinheiro(v); }
  function plural(n, s, p) { return OG.util.plural(n, s, p); }

  function nomeColuna(id) {
    const col = R().COLUNAS.find(function (c) { return c.id === id; });
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

  function nome(c) {
    return E().projetoDaCarta(c).nome;
  }

  function validarProvas(estado, c) {
    if (!E().eventoAtivo(estado, 'ev_provas')) return;
    const movidas = estado.cartasMovidasNaRodada;
    if (movidas.indexOf(c.id) !== -1) return;
    if (movidas.length < R().LIMITE_MOVIMENTOS_PROVAS) return;
    exigir(false, 'Semana de Provas: só ' + R().LIMITE_MOVIMENTOS_PROVAS + ' cards podem ser movimentados nesta rodada, e já foram ' +
      OG.util.listaPt(movidas.map(function (id) { return '“' + nome(E().carta(estado, id)) + '”'; })) + '.');
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

  // ---------------- Responsável (coordenador) ----------------

  function validarResponsavel(estado, c, coordId) {
    const p = E().pessoa(coordId);
    exigir(!!p, 'Escolha o coordenador responsável.');
    exigir(p.papel === 'coordenador', 'Só coordenadores são responsáveis por projetos. ' + p.nome + ' é voluntário.');
    const fila = E().filaDe(estado, coordId).filter(function (x) { return x.id !== c.id; });
    exigir(fila.length < R().FILA_POR_COORDENADOR,
      p.nome + ' já tem ' + fila.length + ' projetos em A FAZER (máximo ' + R().FILA_POR_COORDENADOR +
      '). Inicie ou devolva um deles antes, ou escolha outro coordenador.');
  }

  // ---------------- Planejar (BACKLOG -> A FAZER) ----------------

  /** coordId opcional: sem ele, valida só se o card pode sair do Backlog agora. */
  function validarPlanejar(estado, c, coordId) {
    validarFase(estado);
    exigir(c.coluna === 'backlog', 'Só cards do BACKLOG podem ir para A FAZER.');
    validarNaoCongelada(estado, c);
    validarProvas(estado, c);
    if (coordId !== undefined) validarResponsavel(estado, c, coordId);
    else {
      const algum = E().coordenadores().some(function (p) {
        return E().filaDe(estado, p.id).length < R().FILA_POR_COORDENADOR;
      });
      exigir(algum, 'Todos os coordenadores já têm ' + R().FILA_POR_COORDENADOR + ' projetos em A FAZER. Inicie ou devolva algum antes.');
    }
  }

  function planejar(estado, cartaId, coordId) {
    const c = obterCarta(estado, cartaId);
    validarPlanejar(estado, c);
    // O responsável é obrigatório: ação sem ele (ou com id inválido) é recusada aqui.
    validarResponsavel(estado, c, coordId);
    c.responsavel = coordId;
    moverPara(estado, c, 'afazer');
    registrarMovimento(estado, c);
    const proj = E().projetoDaCarta(c);
    const fora = !E().naArea(coordId, proj);
    historico(estado, 'acao', nome(c) + ' foi para A FAZER com ' + E().pessoa(coordId).nome + ' como responsável' +
      (fora ? ' (fora da área: +' + R().TEMPO_FORA_DA_AREA + ' rodada).' : '.'));
  }

  function trocarResponsavel(estado, cartaId, coordId) {
    validarFase(estado);
    const c = obterCarta(estado, cartaId);
    exigir(c.coluna === 'afazer', 'Só dá para trocar o responsável de cards em A FAZER. Depois de iniciado, o projeto segue com quem começou.');
    exigir(c.responsavel !== coordId, E().pessoa(coordId) ? E().pessoa(coordId).nome + ' já é o responsável.' : 'Escolha um coordenador.');
    validarResponsavel(estado, c, coordId);
    const antes = E().pessoa(c.responsavel).nome;
    c.responsavel = coordId;
    historico(estado, 'acao', nome(c) + ': responsável trocado de ' + antes + ' para ' + E().pessoa(coordId).nome + '.');
  }

  function validarDesplanejar(estado, c) {
    validarFase(estado);
    exigir(c.coluna === 'afazer', 'Só cards de A FAZER podem voltar para o BACKLOG.');
    exigir(c.custoPago === null, 'Este projeto já foi pago: ele fica em A FAZER até ser retomado.');
    validarNaoCongelada(estado, c);
    validarProvas(estado, c);
  }

  function desplanejar(estado, cartaId) {
    const c = obterCarta(estado, cartaId);
    validarDesplanejar(estado, c);
    c.responsavel = null;
    moverPara(estado, c, 'backlog');
    registrarMovimento(estado, c);
    historico(estado, 'acao', nome(c) + ' voltou para o BACKLOG.');
  }

  // ---------------- Início (A FAZER -> EM ANDAMENTO) ----------------

  function iniciadosNaRodada(estado) {
    return estado.cartas.filter(function (c) {
      return c.iniciadoNaRodada === estado.rodada && c.coluna !== 'backlog' && c.coluna !== 'afazer';
    });
  }

  /** Rodadas de execução que ainda faltam para o card (com o responsável atual). */
  function rodadasRestantesDoCard(c) {
    const total = c.coluna === 'andamento' ? c.tempoTotal : E().tempoTotal(c, c.responsavel);
    return total - (c.coluna === 'andamento' ? c.progresso : 0);
  }

  /** Voluntários que poderiam entrar na equipe deste card agora. */
  function candidatos(estado, c) {
    const restante = rodadasRestantesDoCard(c);
    return E().voluntariosLivres(estado).filter(function (p) {
      return E().rodadasRestantes(estado, p.id) >= restante;
    });
  }

  /** Maior força que dá para juntar agora com os voluntários livres (coordenador incluído). */
  function forcaPossivel(estado, c) {
    const proj = E().projetoDaCarta(c);
    return candidatos(estado, c).reduce(function (s, p) { return s + E().forcaVoluntario(p.id, proj); }, R().FORCA_COORDENADOR);
  }

  function textoStatusCoordenador(estado, coordId) {
    const p = E().pessoa(coordId);
    const st = E().statusPessoa(estado, coordId);
    if (st.codigo === 'tocando') return p.nome + ' já está tocando ' + nome(E().carta(estado, st.cartaId)) + ': cada coordenador toca um projeto por vez.';
    if (st.codigo === 'doente') return p.nome + ' está com influenza nesta rodada.';
    return p.nome + ' não está disponível.';
  }

  /** Validações que não dependem da equipe escolhida (usadas também no arrastar). */
  function validarPreInicio(estado, c) {
    validarFase(estado);
    exigir(c.coluna === 'afazer',
      c.coluna === 'backlog'
        ? 'Primeiro planeje: escolha o coordenador responsável e leve o card para A FAZER.'
        : 'Só cards em A FAZER podem ser iniciados.');
    exigir(!!c.responsavel, 'Escolha o coordenador responsável antes de iniciar.');
    if (E().eventoAtivo(estado, 'ev_chimarrao')) {
      const iniciados = iniciadosNaRodada(estado);
      exigir(iniciados.length < R().LIMITE_INICIOS_CHIMARRAO,
        'Acabou o Chimarrão: só ' + R().LIMITE_INICIOS_CHIMARRAO + ' projetos podem começar nesta rodada, e já começaram ' +
        OG.util.listaPt(iniciados.map(function (x) { return '“' + nome(x) + '”'; })) + '.');
    }
    validarProvas(estado, c);
    validarNaoCongelada(estado, c);
    exigir(E().statusPessoa(estado, c.responsavel).codigo === 'livre', textoStatusCoordenador(estado, c.responsavel));

    const proj = E().projetoDaCarta(c);
    const precisa = E().forcaNecessaria(proj);
    const possivel = forcaPossivel(estado, c);
    exigir(possivel >= precisa,
      'Falta gente: este projeto precisa de força ' + precisa + ' e, com ' + E().pessoa(c.responsavel).nome +
      ' e os voluntários livres, só dá ' + possivel + '.');

    if (c.custoPago === null) {
      // Melhor caso: o máximo de especialistas que cabe numa equipe enxuta.
      const maxEsp = Math.ceil((precisa - R().FORCA_COORDENADOR) / R().FORCA_ESPECIALISTA);
      const especialistas = candidatos(estado, c)
        .filter(function (p) { return E().ehEspecialista(p, proj); })
        .slice(0, maxEsp)
        .map(function (p) { return p.id; });
      const melhor = OG.financas.calcularCusto(estado, c, especialistas);
      const disponivel = OG.financas.caixa(estado);
      exigir(disponivel >= melhor.final,
        'Caixa insuficiente: iniciar ' + proj.nome + ' custa pelo menos ' + fmt(melhor.final) +
        ' e o caixa tem ' + fmt(disponivel) + '.');
    }
  }

  function validarEquipe(estado, c, equipe) {
    const proj = E().projetoDaCarta(c);
    exigir(Array.isArray(equipe), 'Escolha a equipe do projeto.');
    const unicos = equipe.filter(function (id, i) { return equipe.indexOf(id) === i; });
    exigir(unicos.length === equipe.length, 'A mesma pessoa foi escolhida duas vezes.');
    const restante = rodadasRestantesDoCard(c);
    equipe.forEach(function (id) {
      const p = E().pessoa(id);
      exigir(!!p, 'Pessoa desconhecida na equipe.');
      exigir(p.papel === 'voluntario',
        p.nome + ' é coordenador: coordenadores tocam o próprio projeto e não entram na equipe de outro.');
      const st = E().statusPessoa(estado, id);
      exigir(st.codigo === 'livre', p.nome + ' não está disponível: ' + st.texto.toLowerCase() + '.');
      const fica = E().rodadasRestantes(estado, id);
      exigir(fica >= restante,
        p.nome + ' só fica mais ' + fica + ' ' + plural(fica, 'rodada', 'rodadas') +
        ', e este projeto precisa de ' + restante + '.');
    });
    const precisa = E().forcaNecessaria(proj);
    const forca = E().forcaDaEquipe(proj, true, equipe);
    exigir(forca >= precisa,
      'Força insuficiente: com ' + E().pessoa(c.responsavel).nome + ' a equipe soma ' + forca + ' e ' + proj.nome +
      ' precisa de ' + precisa + '. Especialistas na categoria somam 2.');
    // "Sobrando" = quem pode sair sozinho sem a força ficar abaixo do necessário.
    // Com mais de um, a lista usa "ou": tirar um deles basta (tirar todos pode não dar).
    const sobrando = E().voluntariosSobrando(proj, equipe);
    exigir(!sobrando.length,
      'Equipe maior que o necessário: dá para tirar ' +
      OG.util.listaPtOu(sobrando.map(function (id) { return E().pessoa(id).nome; })) +
      ' e a força continua suficiente. Deixe quem sobrar livre para outro projeto (ou troque por um especialista).');
  }

  function validarInicio(estado, c, equipe) {
    validarPreInicio(estado, c);
    validarEquipe(estado, c, equipe);
    const custo = OG.financas.calcularCusto(estado, c, equipe);
    const disponivel = OG.financas.caixa(estado);
    exigir(disponivel >= custo.final,
      'Caixa insuficiente: com essa equipe o projeto custa ' + fmt(custo.final) +
      ' e o caixa tem ' + fmt(disponivel) + '.');
    return custo;
  }

  function iniciar(estado, cartaId, equipe) {
    const c = obterCarta(estado, cartaId);
    const proj = E().projetoDaCarta(c);
    const custo = validarInicio(estado, c, equipe);
    const coord = E().pessoa(c.responsavel);

    if (custo.jaPago) {
      historico(estado, 'acao', proj.nome + ' foi retomado com ' + coord.nome + '. O custo já tinha sido pago, nada foi cobrado.');
    } else {
      if (custo.final > 0) {
        OG.financas.lancar(estado, 'dinheiro', -custo.final, 'custo', 'Início: ' + proj.nome, { cartaId: c.id });
      }
      c.custoPago = custo.final;
      c.custoItens = custo.itens;
      const usados = estado.descontosPendentes.map(function (d) { return d.origem; });
      estado.descontosPendentes = [];
      let texto = proj.nome + ' começou com ' + coord.nome + '. Custo pago: ' + fmt(custo.final);
      if (custo.itens.length) texto += ' (base ' + fmt(custo.base) + ')';
      if (usados.length) texto += '. Desconto usado: ' + OG.util.listaPt(usados);
      historico(estado, 'acao', texto + '.');
    }

    c.tempoTotal = E().tempoComCoordenador(proj, c.responsavel);
    c.progresso = 0;
    moverPara(estado, c, 'andamento');
    c.equipe = equipe.slice();
    c.iniciadoNaRodada = estado.rodada;
    registrarMovimento(estado, c);
  }

  // ---------------- Revisão (REVISÃO -> CONCLUÍDO) ----------------

  function revisoresPossiveis(estado, c) {
    return E().coordenadores().filter(function (p) { return !E().impedimentoRevisor(estado, p.id, c); });
  }

  function validarPreRevisao(estado, c) {
    validarFase(estado);
    exigir(c.coluna === 'revisao',
      c.coluna === 'andamento'
        ? 'O projeto ainda está em execução. Ele vai para REVISÃO no fim da rodada em que completar a execução.'
        : 'Só cards em REVISÃO podem ser concluídos.');
    validarProvas(estado, c);
    validarNaoCongelada(estado, c);
    exigir(revisoresPossiveis(estado, c).length > 0,
      'Nenhum coordenador pode revisar agora: quem tocou o projeto não revisa, cada um revisa 1 por rodada e quem está doente não revisa.');
  }

  function validarRevisao(estado, c, revisorId) {
    validarPreRevisao(estado, c);
    const motivo = E().impedimentoRevisor(estado, revisorId, c);
    exigir(!motivo, motivo);
  }

  function pontosRecompensa(rec) {
    return rec.dinheiro / R().REAIS_POR_PONTO + rec.prestigio + rec.tradicao;
  }

  function verificarMissao(estado, missaoId) {
    const entrada = E().entradaAgenda(estado, missaoId);
    if (!entrada || entrada.cumprida || entrada.perdida) return;
    const m = E().missaoPorId(missaoId);
    if (E().progressoMissao(estado, missaoId) < m.objetivo) return;
    entrada.cumprida = true;
    entrada.cumpridaNaRodada = estado.rodada;
    const rec = m.recompensa;
    const partes = [];
    const ref = { missaoId: missaoId };
    if (rec.dinheiro) {
      OG.financas.lancar(estado, 'dinheiro', rec.dinheiro, 'recompensa', 'Missão cumprida: ' + m.nome, ref);
      partes.push(OG.util.formatarDinheiroComSinal(rec.dinheiro));
    }
    if (rec.prestigio) {
      OG.financas.lancar(estado, 'prestigio', rec.prestigio, 'recompensa', 'Missão cumprida: ' + m.nome, ref);
      partes.push('+' + rec.prestigio + ' Prestígio');
    }
    if (rec.tradicao) {
      OG.financas.lancar(estado, 'tradicao', rec.tradicao, 'recompensa', 'Missão cumprida: ' + m.nome, ref);
      partes.push('+' + rec.tradicao + ' Tradição');
    }
    historico(estado, 'missao', 'MISSÃO CUMPRIDA: ' + m.nome + '! Recompensa: ' + OG.util.listaPt(partes) + '.');
  }

  function revisar(estado, cartaId, revisorId) {
    const c = obterCarta(estado, cartaId);
    validarRevisao(estado, c, revisorId);
    const proj = E().projetoDaCarta(c);
    const revisor = E().pessoa(revisorId);
    const parado = E().projetoParadoSeRevisar(estado, revisorId);
    const noPrazo = estado.rodada <= c.prazo;

    moverPara(estado, c, 'concluido');
    c.revisor = revisorId;
    c.concluidoNaRodada = estado.rodada;
    c.noPrazo = noPrazo;
    estado.revisoresDaRodada.push(revisorId);
    registrarMovimento(estado, c);

    if (!c.recompensado) {
      c.recompensado = true;
      const retorno = noPrazo ? proj.retorno : Math.floor(proj.retorno * R().FRACAO_RETORNO_ATRASADO);
      c.retornoRecebido = retorno;
      const ref = { cartaId: c.id };
      OG.financas.lancar(estado, 'dinheiro', retorno, 'retorno', 'Concluído: ' + proj.nome + (noPrazo ? '' : ' (atrasado)'), ref);
      if (noPrazo) {
        if (proj.prestigio) OG.financas.lancar(estado, 'prestigio', proj.prestigio, 'pontos', 'Concluído: ' + proj.nome, ref);
        if (proj.tradicao) OG.financas.lancar(estado, 'tradicao', proj.tradicao, 'pontos', 'Concluído: ' + proj.nome, ref);
      }
      const lucro = retorno - (c.custoPago || 0);
      let texto = proj.nome + ' CONCLUÍDO (revisão: ' + revisor.nome + '). Retorno ' + fmt(retorno) +
        ', lucro do projeto ' + fmt(lucro) + '.';
      if (!noPrazo) texto += ' Entregue depois do prazo (rodada ' + c.prazo + '): metade do retorno, sem prestígio nem tradição.';
      historico(estado, noPrazo ? 'acao' : 'atraso', texto);
    }
    if (parado) {
      historico(estado, 'acao', revisor.nome + ' parou para revisar: ' + nome(parado) + ' não avança nesta rodada.');
    }
    if (noPrazo && c.missaoId) verificarMissao(estado, c.missaoId);
  }

  // ---------------- Completar equipe ----------------

  function completarEquipe(estado, cartaId, pessoaId) {
    validarFase(estado);
    const c = obterCarta(estado, cartaId);
    const proj = E().projetoDaCarta(c);
    exigir(c.coluna === 'andamento', 'Só projetos EM ANDAMENTO recebem reforço na equipe.');
    const precisa = E().forcaNecessaria(proj);
    exigir(E().forcaDaCarta(c) < precisa, 'A equipe deste projeto já tem a força necessária.');
    const p = E().pessoa(pessoaId);
    exigir(!!p, 'Pessoa desconhecida.');
    exigir(p.papel === 'voluntario', p.nome + ' é coordenador: coordenadores não entram na equipe de outro projeto.');
    const st = E().statusPessoa(estado, pessoaId);
    exigir(st.codigo === 'livre', p.nome + ' não está disponível: ' + st.texto.toLowerCase() + '.');
    const restante = c.tempoTotal - c.progresso;
    const fica = E().rodadasRestantes(estado, pessoaId);
    exigir(fica >= restante, p.nome + ' só fica mais ' + fica + ' ' + plural(fica, 'rodada', 'rodadas') + '.');
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
    c.progresso += 1;
    estado.mutirao.usado = true;
    if (c.progresso >= c.tempoTotal) {
      moverPara(estado, c, 'revisao');
      c.equipeFinal = c.equipe.slice();
      c.equipe = [];
      historico(estado, 'acao', 'Mutirão da Gurizada: ' + nome(c) + ' terminou a execução na hora e foi para REVISÃO.');
    } else {
      historico(estado, 'acao', 'Mutirão da Gurizada: ' + nome(c) + ' avançou para ' + c.progresso + '/' + c.tempoTotal + '.');
    }
  }

  // ---------------- Arrastar e soltar ----------------

  /**
   * Diz se o card pode ir para a coluna e qual ação isso dispara.
   * acao: 'planejar' (pede o responsável) | 'desplanejar' | 'iniciar' (pede equipe) | 'revisar' (pede revisor)
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
    if (c.coluna === 'backlog') return { ok: false, motivo: 'Primeiro planeje: escolha o coordenador responsável e leve o card para A FAZER.' };
    if (c.coluna === 'afazer') return { ok: false, motivo: 'Antes o projeto precisa ser executado: inicie-o em EM ANDAMENTO.' };
    if (c.coluna === 'andamento') {
      return { ok: false, motivo: 'A execução não pode ser pulada: o card vai sozinho para REVISÃO no fim da rodada em que completar a execução.' };
    }
    return { ok: false, motivo: 'Movimento não permitido.' };
  }

  OG.kanban = {
    ORDEM,
    nomeColuna,
    mensagemFase,
    iniciadosNaRodada,
    rodadasRestantesDoCard,
    candidatos,
    forcaPossivel,
    validarPlanejar,
    validarResponsavel,
    validarPreInicio,
    validarEquipe,
    validarInicio,
    validarPreRevisao,
    validarRevisao,
    revisoresPossiveis,
    planejar,
    trocarResponsavel,
    desplanejar,
    iniciar,
    revisar,
    completarEquipe,
    mutiraoDisponivel,
    usarMutirao,
    avaliarMovimento,
    verificarMissao,
    pontosRecompensa,
  };
})(globalThis);
