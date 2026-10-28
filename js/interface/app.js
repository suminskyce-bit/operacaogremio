/*
 * app.js — controlador da interface.
 *
 * Fluxo: clique/arraste -> ação -> OG.motor.aplicar (núcleo valida tudo) ->
 *        estado novo -> salva no navegador -> renderiza a tela de novo.
 * Se o núcleo recusar, o estado não muda e o motivo aparece num aviso.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const CHAVE_CONFIG = 'operacao-gremio-mesquita:config';
  const MODAIS_GLOBAIS = ['menu', 'como-jogar', 'config', 'confirmar'];
  const DICAS_SOLTAR = {
    planejar: 'Solte para escolher o responsável',
    desplanejar: 'Solte para voltar ao Backlog',
    iniciar: 'Solte para montar a equipe e iniciar',
    revisar: 'Solte para escolher quem revisa',
  };

  function novoUi() {
    return {
      modal: null,
      aba: 'historico',
      abaMobile: 'quadro',
      colunaMobile: 'backlog',
      lateralAberta: false,
      resumoFechado: null,
      pulsar: [],
      focoDepois: null,
    };
  }

  const app = {
    estado: null,
    tela: 'inicio',
    config: { caixaApertado: false, duracao: 4 },
    ui: novoUi(),
    avisouSemSalvar: false,
  };

  function E() { return OG.estado; }
  function esc(v) { return OG.ui.esc(v); }

  // ---------------- Configurações (validadas: nada salvo no navegador é confiável) ----------------

  function carregarConfig() {
    app.config.duracao = OG.regras.DURACAO_PADRAO;
    try {
      const texto = global.localStorage.getItem(CHAVE_CONFIG);
      if (!texto) return;
      const c = JSON.parse(texto);
      if (!c || typeof c !== 'object') return;
      app.config.caixaApertado = c.caixaApertado === true;
      if (OG.regrasUtil.duracao(c.duracao)) app.config.duracao = c.duracao;
    } catch (erro) {
      // Sem armazenamento (ou salvo estragado): fica o padrão.
    }
  }

  function salvarConfig() {
    try {
      global.localStorage.setItem(CHAVE_CONFIG, JSON.stringify({ caixaApertado: app.config.caixaApertado, duracao: app.config.duracao }));
    } catch (erro) {
      // Sem armazenamento: a escolha vale só nesta sessão.
    }
  }

  function novaSemente() {
    try {
      const a = new Uint32Array(1);
      global.crypto.getRandomValues(a);
      return a[0] || 1;
    } catch (erro) {
      return (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
    }
  }

  // ---------------- Despacho de ações ----------------

  function salvar() {
    if (!OG.persistencia.salvar(app.estado) && !app.avisouSemSalvar) {
      app.avisouSemSalvar = true;
      OG.ui.aviso('Este navegador não deixou salvar a partida. Dá para jogar, mas se recarregar a página ela se perde.', 'info');
    }
  }

  function marcarPulsos(antes, depois) {
    const a = E().recursos(antes);
    const d = E().recursos(depois);
    app.ui.pulsar = ['dinheiro', 'prestigio', 'tradicao'].filter(function (k) { return a[k] !== d[k]; });
  }

  function avisarMissoes(antes, depois) {
    depois.agenda.forEach(function (a, i) {
      if (a.cumprida && !antes.agenda[i].cumprida) {
        OG.ui.aviso('Missão cumprida: ' + E().missaoPorId(a.missaoId).nome + '! A recompensa já entrou.', 'bom');
      }
    });
  }

  /** Troca o estado do jogo por um novo, já validado pelo núcleo. */
  function trocarEstado(antes, depois) {
    app.estado = depois;
    salvar();
    marcarPulsos(antes, depois);
    avisarMissoes(antes, depois);
  }

  /** Aplica a ação no núcleo. `aoSucesso(antes, depois)` roda antes de renderizar. */
  function despachar(acao, aoSucesso) {
    if (!app.estado) return false;
    const antes = app.estado;
    const r = OG.motor.aplicar(antes, Object.assign({ rodada: antes.rodada }, acao));
    if (!r.ok) {
      OG.ui.aviso(r.erro, 'erro');
      return false;
    }
    trocarEstado(antes, r.estado);
    if (aoSucesso) aoSucesso(antes, app.estado);
    if (app.estado.fase === 'fim' && app.tela !== 'fim') {
      irPara('fim');
      return true;
    }
    render();
    return true;
  }

  function textoDelta(antes, depois) {
    const a = E().recursos(antes);
    const d = E().recursos(depois);
    const partes = [];
    if (d.dinheiro !== a.dinheiro) partes.push('Caixa ' + OG.util.formatarDinheiroComSinal(d.dinheiro - a.dinheiro));
    if (d.prestigio !== a.prestigio) partes.push('Prestígio ' + OG.util.formatarPontos(d.prestigio - a.prestigio));
    if (d.tradicao !== a.tradicao) partes.push('Tradição ' + OG.util.formatarPontos(d.tradicao - a.tradicao));
    return partes.join(', ');
  }

  function avisoDelta(antes, depois) {
    const t = textoDelta(antes, depois);
    if (t) OG.ui.aviso(t + '.', 'info');
  }

  // ---------------- Navegação ----------------

  function irPara(tela) {
    app.tela = tela;
    app.ui.modal = null;
    app.ui.lateralAberta = false;
    render();
    global.scrollTo(0, 0);
    if (!OG.ui.modalAberto()) {
      const principal = document.querySelector('[data-foco-principal]');
      if (principal) principal.focus({ preventScroll: true });
    }
  }

  function abrirModal(modal) {
    app.ui.modal = modal;
    render();
  }

  function fecharModalUi() {
    app.ui.modal = null;
    render();
  }

  function confirmar(dados) {
    abrirModal({ tipo: 'confirmar', confirmar: dados });
  }

  // ---------------- Partida ----------------

  function novaPartida(missaoId, duracao, caixaApertado) {
    app.estado = OG.motor.criarPartida({
      missaoId: missaoId,
      duracao: duracao,
      semente: novaSemente(),
      caixaApertado: caixaApertado,
    });
    app.ui = novoUi();
    salvar();
    irPara('jogo');
  }

  function escolherMissao(missaoId) {
    const duracao = app.config.duracao;
    const caixa = app.config.caixaApertado;
    if (app.estado && app.estado.fase !== 'fim') {
      const e = app.estado;
      confirmar({
        id: 'substituir',
        titulo: 'Começar outra partida?',
        html: '<p>Você tem uma partida em andamento (' + esc(OG.regrasUtil.duracao(e.config.duracao).nome) + ', rodada ' + e.rodada + ' de ' + e.config.duracao +
          '). Ela será substituída pela nova e não dá para recuperar.</p>',
        rotulo: 'Começar nova partida',
        perigo: true,
        acao: function () { novaPartida(missaoId, duracao, caixa); },
      });
      return;
    }
    novaPartida(missaoId, duracao, caixa);
  }

  // ---------- Quem vai tocar? ----------

  function abrirResponsavel(cartaId, modo) {
    const estado = app.estado;
    const c = E().carta(estado, cartaId);
    if (!c) return;
    const destino = modo === 'trocar' ? null : 'afazer';
    if (destino) {
      const av = OG.kanban.avaliarMovimento(estado, cartaId, destino);
      if (!av.ok) {
        OG.ui.aviso(av.motivo, 'erro');
        return;
      }
    }
    // Ninguém vem marcado: escolher quem toca cada card é a decisão principal do jogo.
    abrirModal({ tipo: 'responsavel', modo: modo || 'planejar', cartaId: cartaId, escolhido: null });
  }

  function confirmarResponsavel(seguir) {
    const m = app.ui.modal;
    if (!m || m.tipo !== 'responsavel') return;
    if (!m.escolhido) {
      OG.ui.aviso('Escolha o coordenador responsável.', 'erro');
      return;
    }
    const cartaId = m.cartaId;
    const coord = E().pessoa(m.escolhido);
    const proj = E().projetoDaCarta(E().carta(app.estado, cartaId));
    if (m.modo === 'trocar') {
      despachar({ tipo: 'TROCAR_RESPONSAVEL', cartaId: cartaId, responsavel: m.escolhido }, function () {
        app.ui.modal = null;
        app.ui.focoDepois = cartaId;
        OG.ui.aviso(proj.nome + ': agora o responsável é ' + coord.nome + '.', 'info');
      });
      return;
    }
    despachar({ tipo: 'PLANEJAR', cartaId: cartaId, responsavel: m.escolhido }, function (antes, depois) {
      app.ui.modal = null;
      app.ui.focoDepois = cartaId;
      if (seguir === 'equipe' && OG.kanban.avaliarMovimento(depois, cartaId, 'andamento').ok) {
        app.ui.modal = novoModalEquipe(depois, cartaId, 'equipe');
      }
    });
  }

  // ---------- Equipe ----------

  function sugestao(estado, c) {
    const t = OG.planejador.montarEquipe(estado, c);
    return t ? t.equipe : [];
  }

  /** A equipe começa vazia: o jogador escolhe (ou pede a sugestão no botão). */
  function novoModalEquipe(estado, cartaId, tipo) {
    return { tipo: tipo === 'completar' ? 'completar' : 'equipe', cartaId: cartaId, selecionados: [] };
  }

  function abrirEquipe(cartaId, tipo) {
    const c = E().carta(app.estado, cartaId);
    if (!c) return;
    if (tipo === 'equipe') {
      const av = OG.kanban.avaliarMovimento(app.estado, cartaId, 'andamento');
      if (!av.ok) {
        OG.ui.aviso(av.motivo, 'erro');
        return;
      }
    }
    abrirModal(novoModalEquipe(app.estado, cartaId, tipo));
  }

  function alternarPessoa(pessoaId, marcado) {
    const m = app.ui.modal;
    if (!m || (m.tipo !== 'equipe' && m.tipo !== 'completar')) return;
    const sel = m.selecionados.filter(function (id) { return id !== pessoaId; });
    if (marcado) sel.push(pessoaId);
    m.selecionados = sel;
    render();
  }

  function sugerirEquipe() {
    const m = app.ui.modal;
    if (!m || (m.tipo !== 'equipe' && m.tipo !== 'completar')) return;
    const c = E().carta(app.estado, m.cartaId);
    m.selecionados = sugestao(app.estado, c);
    if (!m.selecionados.length) OG.ui.aviso('Não há voluntários livres suficientes para completar a força deste projeto.', 'erro');
    render();
  }

  function confirmarEquipe() {
    const m = app.ui.modal;
    if (!m) return;
    const c = E().carta(app.estado, m.cartaId);
    const proj = E().projetoDaCarta(c);
    if (m.tipo === 'completar') {
      // Aplica todas as inclusões numa cópia; só confirma se todas derem certo.
      let estado = app.estado;
      for (let i = 0; i < m.selecionados.length; i++) {
        const r = OG.motor.aplicar(estado, { tipo: 'COMPLETAR_EQUIPE', cartaId: c.id, pessoaId: m.selecionados[i], rodada: estado.rodada });
        if (!r.ok) {
          OG.ui.aviso(r.erro, 'erro');
          return;
        }
        estado = r.estado;
      }
      trocarEstado(app.estado, estado);
      app.ui.modal = null;
      app.ui.focoDepois = c.id;
      OG.ui.aviso('Equipe de ' + proj.nome + ' reforçada.', 'bom');
      render();
      return;
    }
    despachar({ tipo: 'INICIAR', cartaId: c.id, equipe: m.selecionados.slice() }, function (antes, depois) {
      app.ui.modal = null;
      app.ui.focoDepois = c.id;
      const pago = E().recursos(antes).dinheiro - E().recursos(depois).dinheiro;
      OG.ui.aviso(proj.nome + (E().carta(antes, c.id).custoPago !== null ? ' foi retomado sem custo.' : ' começou. Pago: ' + OG.util.formatarDinheiro(pago) + '.'), 'info');
    });
  }

  // ---------- Revisão ----------

  function sugerirRevisor(c) {
    const estado = app.estado;
    const possiveis = OG.kanban.revisoresPossiveis(estado, c);
    const gratis = possiveis.filter(function (p) { return !E().projetoParadoSeRevisar(estado, p.id); });
    const lista = gratis.length ? gratis : possiveis;
    return lista.length ? lista[0].id : null;
  }

  function abrirRevisor(cartaId) {
    const av = OG.kanban.avaliarMovimento(app.estado, cartaId, 'concluido');
    if (!av.ok) {
      OG.ui.aviso(av.motivo, 'erro');
      return;
    }
    abrirModal({ tipo: 'revisor', cartaId: cartaId, revisor: sugerirRevisor(E().carta(app.estado, cartaId)) });
  }

  function confirmarRevisao() {
    const m = app.ui.modal;
    if (!m || !m.revisor) {
      OG.ui.aviso('Escolha um coordenador para revisar.', 'erro');
      return;
    }
    const proj = E().projetoDaCarta(E().carta(app.estado, m.cartaId));
    despachar({ tipo: 'REVISAR', cartaId: m.cartaId, revisorId: m.revisor }, function (antes, depois) {
      app.ui.modal = null;
      app.ui.focoDepois = m.cartaId;
      const c = E().carta(depois, m.cartaId);
      OG.ui.aviso(proj.nome + ' concluído' + (c.noPrazo ? '' : ' com atraso') + '! ' + textoDelta(antes, depois) + '.', c.noPrazo ? 'bom' : 'info');
    });
  }

  // ---------- Encerrar a rodada ----------

  function encerrar() {
    despachar({ tipo: 'ENCERRAR_RODADA' }, function () { app.ui.resumoFechado = null; });
  }

  function pedirEncerramento() {
    const estado = app.estado;
    if (!estado || estado.fase !== 'planejamento') return;
    const avisos = [];
    const nome = function (c) { return E().projetoDaCarta(c).nome; };
    if (OG.kanban.mutiraoDisponivel(estado)) avisos.push('Você ainda não usou o Mutirão da Gurizada. Ele acaba no fim desta rodada.');
    const revisaveis = E().cartasNaColuna(estado, 'revisao').filter(function (c) {
      return OG.kanban.avaliarMovimento(estado, c.id, 'concluido').ok;
    });
    if (E().ultimaRodada(estado) && revisaveis.length) {
      avisos.push((revisaveis.length === 1 ? 'Ainda há 1 projeto' : 'Ainda há ' + revisaveis.length + ' projetos') + ' para revisar. Na última rodada, projeto não revisado não conta.');
    } else {
      const hoje = revisaveis.filter(function (c) { return c.prazo === estado.rodada; });
      if (hoje.length) avisos.push(OG.util.listaPt(hoje.map(nome)) + ' vence' + (hoje.length > 1 ? 'm' : '') + ' nesta rodada: revisando depois, rende só metade do retorno.');
    }
    const fracos = E().cartasNaColuna(estado, 'andamento').filter(function (c) {
      return E().forcaDaCarta(c) < E().forcaNecessaria(E().projetoDaCarta(c));
    });
    if (fracos.length) avisos.push(OG.util.listaPt(fracos.map(nome)) + (fracos.length > 1 ? ' estão' : ' está') + ' sem a força completa e não vai avançar.');
    // Gente parada: coordenador livre com card em A fazer que daria para começar agora.
    const prontos = E().cartasNaColuna(estado, 'afazer').filter(function (c) {
      return OG.kanban.avaliarMovimento(estado, c.id, 'andamento').ok;
    });
    if (prontos.length) {
      avisos.push(OG.util.listaPt(prontos.slice(0, 3).map(function (c) { return nome(c) + ' (' + E().pessoa(c.responsavel).nome + ')'; })) +
        (prontos.length > 1 ? ' estão prontos' : ' está pronto') + ' para começar e o responsável está livre.');
    }
    const urgentes = E().cartasNaColuna(estado, 'backlog').filter(function (c) { return E().farolDoPrazo(estado, c) === 'urgente'; });
    if (urgentes.length) {
      avisos.push(OG.util.listaPt(urgentes.slice(0, 3).map(nome)) + (urgentes.length > 1 ? ' precisam' : ' precisa') + ' começar nesta rodada para caber no prazo.');
    }
    if (!avisos.length) {
      encerrar();
      return;
    }
    confirmar({
      id: 'encerrar',
      titulo: 'Encerrar a rodada ' + estado.rodada + '?',
      html: '<ul class="lista-simples">' + avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>',
      rotulo: 'Encerrar mesmo assim',
      cancelar: 'Voltar ao quadro',
      acao: encerrar,
    });
  }

  // ---------------- Ações da interface ----------------

  function executarAcao(acao, el) {
    const d = (el && el.dataset) || {};
    switch (acao) {
      case 'jogar':
      case 'nova-partida':
      case 'outra-missao':
        irPara('preparar');
        break;
      case 'continuar':
        if (app.estado) irPara(app.estado.fase === 'fim' ? 'fim' : 'jogo');
        break;
      case 'voltar-inicio':
        irPara('inicio');
        break;
      case 'como-jogar':
        abrirModal({ tipo: 'como-jogar' });
        break;
      case 'configuracoes':
        abrirModal({ tipo: 'config' });
        break;
      case 'menu':
        abrirModal({ tipo: 'menu' });
        break;
      case 'fechar-modal':
        fecharModalUi();
        break;
      case 'fechar-resumo':
        app.ui.resumoFechado = app.estado ? app.estado.rodada : null;
        render();
        break;
      case 'escolher-duracao': {
        const n = Number(el && el.value);
        if (OG.regrasUtil.duracao(n)) {
          app.config.duracao = n;
          salvarConfig();
          render();
        }
        break;
      }
      case 'escolher-missao':
        escolherMissao(d.missao);
        break;
      case 'jogar-de-novo':
        if (app.estado) novaPartida(app.estado.config.missaoId, app.estado.config.duracao, app.estado.config.caixaApertado);
        break;
      case 'confirmar-evento':
        despachar({ tipo: 'CONFIRMAR_EVENTO', escolha: d.escolha }, avisoDelta);
        break;
      case 'ver-evento':
        abrirModal({ tipo: 'ver-evento' });
        break;
      case 'abrir-agenda':
        abrirModal({ tipo: 'agenda' });
        break;
      case 'abrir-planejar':
        abrirResponsavel(d.carta, 'planejar');
        break;
      case 'abrir-trocar':
        abrirResponsavel(d.carta, 'trocar');
        break;
      case 'escolher-responsavel':
        if (app.ui.modal && app.ui.modal.tipo === 'responsavel') {
          app.ui.modal.escolhido = d.pessoa;
          render();
        }
        break;
      case 'confirmar-responsavel':
        confirmarResponsavel(d.seguir);
        break;
      case 'desplanejar':
        despachar({ tipo: 'DESPLANEJAR', cartaId: d.carta }, function () { app.ui.modal = null; app.ui.focoDepois = d.carta; });
        break;
      case 'abrir-iniciar':
        abrirEquipe(d.carta, 'equipe');
        break;
      case 'abrir-completar':
        abrirEquipe(d.carta, 'completar');
        break;
      case 'alternar-pessoa':
        alternarPessoa(d.pessoa, el.checked);
        break;
      case 'sugerir-equipe':
        sugerirEquipe();
        break;
      case 'confirmar-equipe':
        confirmarEquipe();
        break;
      case 'abrir-revisar':
        abrirRevisor(d.carta);
        break;
      case 'escolher-revisor':
        if (app.ui.modal) {
          app.ui.modal.revisor = d.pessoa;
          render();
        }
        break;
      case 'confirmar-revisao':
        confirmarRevisao();
        break;
      case 'mutirao':
        despachar({ tipo: 'USAR_MUTIRAO', cartaId: d.carta }, function (antes, depois) {
          app.ui.modal = null;
          app.ui.focoDepois = d.carta;
          const c = E().carta(depois, d.carta);
          OG.ui.aviso('Mutirão: ' + E().projetoDaCarta(c).nome + (c.coluna === 'revisao' ? ' terminou a execução e foi para Revisão.' : ' avançou 1 rodada.'), 'bom');
        });
        break;
      case 'detalhes':
        abrirModal({ tipo: 'detalhe', cartaId: d.carta });
        break;
      case 'encerrar-rodada':
        pedirEncerramento();
        break;
      case 'resolver-decisao':
        despachar({ tipo: 'RESOLVER_DECISAO', escolha: d.escolha }, avisoDelta);
        break;
      case 'cancelar-encerramento':
        despachar({ tipo: 'CANCELAR_ENCERRAMENTO' });
        break;
      case 'avancar':
        despachar({ tipo: 'AVANCAR' }, function () {
          app.ui.resumoFechado = null;
          app.ui.modal = null; // nenhuma janela da rodada anterior reaparece depois do evento
        });
        break;
      case 'aba':
        app.ui.aba = d.aba;
        render();
        break;
      case 'aba-mobile':
        app.ui.abaMobile = d.aba;
        render();
        global.scrollTo(0, 0);
        break;
      case 'coluna-mobile':
        irParaColuna(d.coluna);
        break;
      case 'abrir-lateral':
        app.ui.lateralAberta = true;
        render();
        focar('[data-acao="fechar-lateral"]');
        break;
      case 'fechar-lateral':
        app.ui.lateralAberta = false;
        render();
        focar('[data-acao="abrir-lateral"]');
        break;
      case 'alternar-caixa-apertado':
        app.config.caixaApertado = !!el.checked;
        salvarConfig();
        render();
        break;
      case 'apagar-salvo':
        confirmar({
          id: 'apagar',
          titulo: 'Apagar a partida salva?',
          html: '<p>A partida salva neste navegador será apagada. Não dá para desfazer.</p>',
          rotulo: 'Apagar partida',
          perigo: true,
          acao: function () {
            OG.persistencia.apagar();
            app.estado = null;
            app.ui = novoUi();
            irPara('inicio');
            OG.ui.aviso('Partida salva apagada.', 'bom');
          },
        });
        break;
      case 'confirmar-acao': {
        const c = app.ui.modal && app.ui.modal.confirmar;
        app.ui.modal = null;
        if (c && c.acao) c.acao();
        else render();
        break;
      }
      default:
        break;
    }
  }

  function focar(seletor) {
    const el = document.querySelector(seletor);
    if (el) el.focus({ preventScroll: true });
  }

  // ---------------- Colunas no celular ----------------

  function prefereMenosMovimento() {
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function marcarColunaAtual(id) {
    app.ui.colunaMobile = id;
    document.querySelectorAll('.trocar-coluna button').forEach(function (b) {
      b.setAttribute('aria-current', String(b.dataset.coluna === id));
    });
  }

  function irParaColuna(id) {
    marcarColunaAtual(id);
    const col = document.getElementById('coluna-' + id);
    if (col) col.scrollIntoView({ behavior: prefereMenosMovimento() ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
  }

  let temporizadorRolagem = null;
  function aoRolarQuadro(evento) {
    const quadro = evento.target;
    if (!quadro.classList || !quadro.classList.contains('quadro')) return;
    clearTimeout(temporizadorRolagem);
    temporizadorRolagem = setTimeout(function () {
      const centro = quadro.scrollLeft + quadro.clientWidth / 2;
      let melhor = null;
      let distancia = Infinity;
      quadro.querySelectorAll('.coluna').forEach(function (col) {
        const meio = col.offsetLeft + col.offsetWidth / 2;
        const dist = Math.abs(meio - centro);
        if (dist < distancia) { distancia = dist; melhor = col.dataset.coluna; }
      });
      if (melhor && melhor !== app.ui.colunaMobile) marcarColunaAtual(melhor);
    }, 90);
  }

  // ---------------- Renderização ----------------

  function construirModal(tipo) {
    const T = OG.telas;
    switch (tipo) {
      case 'menu': return T.modalMenu(app);
      case 'como-jogar': return T.modalComoJogar(app);
      case 'config': return T.modalConfig(app);
      case 'confirmar': return T.modalConfirmar(app);
      case 'responsavel': return T.modalResponsavel(app);
      case 'equipe':
      case 'completar': return T.modalEquipe(app);
      case 'revisor': return T.modalRevisor(app);
      case 'detalhe': return T.modalDetalhe(app);
      case 'ver-evento': return T.modalVerEvento(app);
      case 'agenda': return T.modalAgenda(app);
      default: return null;
    }
  }

  function descritorModal() {
    const m = app.ui.modal;
    if (m && MODAIS_GLOBAIS.indexOf(m.tipo) !== -1) return construirModal(m.tipo);
    if (app.tela === 'jogo' && app.estado) {
      const fase = app.estado.fase;
      if (fase === 'evento') return OG.telas.modalEvento(app);
      if (fase === 'decisao') return OG.telas.modalDecisao(app);
      if (fase === 'resumo') {
        if (m && (m.tipo === 'detalhe' || m.tipo === 'agenda' || m.tipo === 'ver-evento')) return construirModal(m.tipo);
        return app.ui.resumoFechado === app.estado.rodada ? null : OG.telas.modalResumo(app);
      }
      if (fase === 'planejamento' && m) {
        const d = construirModal(m.tipo);
        if (!d) app.ui.modal = null;
        return d;
      }
    }
    if (m && app.tela !== 'jogo') app.ui.modal = null;
    return null;
  }

  function renderModal(chaveOpener) {
    const d = descritorModal();
    if (d && typeof d.aoDispensar === 'string') {
      const acao = d.aoDispensar;
      d.aoDispensar = function () { executarAcao(acao, null); };
    }
    OG.ui.mostrarModal(d, chaveOpener);
  }

  function salvarRolagens() {
    const r = {};
    const lateral = document.querySelector('.lateral');
    const quadro = document.querySelector('.quadro');
    const coord = document.querySelector('.coordenacao-lista');
    if (lateral) r.lateral = lateral.scrollTop;
    if (quadro) r.quadro = quadro.scrollLeft;
    if (coord) r.coord = coord.scrollLeft;
    r.abertos = Array.prototype.map.call(document.querySelectorAll('details[open][data-chave]'), function (x) { return x.dataset.chave; });
    r.janela = global.scrollY;
    return r;
  }

  function restaurarRolagens(r) {
    const lateral = document.querySelector('.lateral');
    const quadro = document.querySelector('.quadro');
    const coord = document.querySelector('.coordenacao-lista');
    if (lateral && r.lateral) lateral.scrollTop = r.lateral;
    if (quadro && r.quadro) quadro.scrollLeft = r.quadro;
    if (coord && r.coord) coord.scrollLeft = r.coord;
    if (Math.abs(global.scrollY - r.janela) > 2) global.scrollTo(0, r.janela);
  }

  function aplicarPulsos() {
    app.ui.pulsar.forEach(function (k) {
      const el = document.querySelector('.recurso[data-recurso="' + k + '"]');
      if (el) el.classList.add('pulsa');
    });
    app.ui.pulsar = [];
  }

  function tituloDaPagina() {
    const base = 'Operação Grêmio — Mesquita';
    if (app.tela === 'jogo' && app.estado) return 'Rodada ' + app.estado.rodada + ' de ' + app.estado.config.duracao + ' — ' + base;
    if (app.tela === 'fim') return 'Resultado — ' + base;
    if (app.tela === 'preparar') return 'Nova partida — ' + base;
    return base;
  }

  function render() {
    const raiz = document.getElementById('app');
    if (!raiz) return;
    const foco = OG.ui.modalAberto() ? null : OG.ui.chaveDoFoco();
    const rolagens = salvarRolagens();
    let html;
    if (app.tela === 'jogo' && !app.estado) app.tela = 'inicio';
    if (app.tela === 'fim' && !app.estado) app.tela = 'inicio';
    switch (app.tela) {
      case 'preparar': html = OG.telas.telaPreparar(app); break;
      case 'jogo': html = OG.telas.telaJogo(app); break;
      case 'fim': html = OG.telas.telaFim(app); break;
      default: html = OG.telas.telaInicio(app);
    }
    raiz.innerHTML = html;
    rolagens.abertos.forEach(function (chave) {
      const el = raiz.querySelector('details[data-chave="' + chave + '"]');
      if (el) el.open = true;
    });
    restaurarRolagens(rolagens);
    aplicarPulsos();
    renderModal(foco);
    if (!OG.ui.modalAberto()) {
      const depois = app.ui.focoDepois;
      app.ui.focoDepois = null;
      if (depois) focarCard(depois);
      else if (foco) OG.ui.restaurarFoco(raiz, foco);
    }
    document.title = tituloDaPagina();
  }

  /** Depois que um card muda de coluna, o foco do teclado acompanha o card. */
  function focarCard(cartaId) {
    const raiz = document.getElementById('app');
    const chaves = ['abrir-iniciar:', 'abrir-revisar:', 'abrir-completar:', 'mutirao:', 'abrir-planejar:', 'detalhes:'];
    for (let i = 0; i < chaves.length; i++) {
      if (OG.ui.restaurarFoco(raiz, chaves[i] + cartaId)) {
        const el = document.activeElement;
        if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        return;
      }
    }
  }

  // ---------------- Eventos do navegador ----------------

  function aoClicar(evento) {
    if (OG.ui.cliqueNoFundo(evento)) return;
    const alvo = evento.target.closest ? evento.target.closest('[data-acao]') : null;
    if (!alvo) {
      // Clique no corpo do card abre os detalhes.
      const card = evento.target.closest ? evento.target.closest('.card') : null;
      if (card && !evento.target.closest('button, a, input, label, summary')) {
        abrirModal({ tipo: 'detalhe', cartaId: card.dataset.carta });
      }
      return;
    }
    if (alvo.tagName === 'INPUT') return; // tratado no "change"
    if (alvo.getAttribute('aria-disabled') === 'true') {
      evento.preventDefault();
      OG.ui.aviso(alvo.dataset.motivo || 'Ação indisponível agora.', 'erro');
      return;
    }
    evento.preventDefault();
    executarAcao(alvo.dataset.acao, alvo);
  }

  function aoMudar(evento) {
    const alvo = evento.target;
    if (!alvo || alvo.tagName !== 'INPUT' || !alvo.dataset.acao) return;
    executarAcao(alvo.dataset.acao, alvo);
  }

  function aoTeclar(evento) {
    if (OG.ui.tratarTecladoModal(evento)) return;
    if (evento.key === 'Escape' && app.ui.lateralAberta) {
      app.ui.lateralAberta = false;
      render();
      focar('[data-acao="abrir-lateral"]');
      return;
    }
    const aba = evento.target.closest ? evento.target.closest('[role="tab"]') : null;
    if (aba && (evento.key === 'ArrowRight' || evento.key === 'ArrowLeft')) {
      const abas = Array.prototype.slice.call(aba.parentNode.querySelectorAll('[role="tab"]'));
      const i = abas.indexOf(aba);
      const proxima = abas[(i + (evento.key === 'ArrowRight' ? 1 : abas.length - 1)) % abas.length];
      evento.preventDefault();
      app.ui.aba = proxima.dataset.aba;
      render();
      focar('[data-foco="aba:' + app.ui.aba + '"]');
    }
  }

  // ---------------- Arrastar e soltar ----------------

  let arrasto = null;

  function limparArrasto() {
    arrasto = null;
    document.querySelectorAll('.sendo-arrastado').forEach(function (el) { el.classList.remove('sendo-arrastado'); });
    const quadro = document.querySelector('.quadro');
    if (quadro) quadro.classList.remove('arrastando');
    document.querySelectorAll('.coluna').forEach(function (col) {
      col.classList.remove('alvo-valido', 'alvo-invalido', 'origem', 'sobre');
      col.removeAttribute('title');
      const dica = col.querySelector('[data-dica-soltar]');
      if (dica) dica.textContent = '';
    });
  }

  function aoIniciarArrasto(evento) {
    const card = evento.target.closest ? evento.target.closest('.card[draggable="true"]') : null;
    if (!card || !app.estado || app.estado.fase !== 'planejamento') return;
    const id = card.dataset.carta;
    const c = E().carta(app.estado, id);
    if (!c) return;
    arrasto = { id: id };
    evento.dataTransfer.effectAllowed = 'move';
    try { evento.dataTransfer.setData('text/plain', id); } catch (erro) { /* navegador antigo */ }
    card.classList.add('sendo-arrastado');
    const quadro = document.querySelector('.quadro');
    if (quadro) quadro.classList.add('arrastando');
    document.querySelectorAll('.coluna').forEach(function (col) {
      const destino = col.dataset.coluna;
      if (destino === c.coluna) {
        col.classList.add('origem');
        return;
      }
      const av = OG.kanban.avaliarMovimento(app.estado, id, destino);
      col.classList.add(av.ok ? 'alvo-valido' : 'alvo-invalido');
      if (!av.ok) col.setAttribute('title', av.motivo);
      const dica = col.querySelector('[data-dica-soltar]');
      if (dica) dica.textContent = av.ok ? DICAS_SOLTAR[av.acao] : '';
    });
  }

  function aoArrastarSobre(evento) {
    if (!arrasto) return;
    const col = evento.target.closest ? evento.target.closest('.coluna') : null;
    if (!col) return;
    // Aceita o "soltar" em qualquer coluna para poder explicar movimentos inválidos.
    evento.preventDefault();
    evento.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.coluna.sobre').forEach(function (x) { if (x !== col) x.classList.remove('sobre'); });
    col.classList.add('sobre');
  }

  function aoSoltar(evento) {
    if (!arrasto) return;
    evento.preventDefault();
    const col = evento.target.closest ? evento.target.closest('.coluna') : null;
    const id = arrasto.id;
    limparArrasto();
    if (!col || !app.estado) return;
    const destino = col.dataset.coluna;
    const c = E().carta(app.estado, id);
    if (!c || c.coluna === destino) return;
    const av = OG.kanban.avaliarMovimento(app.estado, id, destino);
    if (!av.ok) {
      OG.ui.aviso(av.motivo, 'erro');
      return;
    }
    if (av.acao === 'planejar') abrirResponsavel(id, 'planejar');
    else if (av.acao === 'desplanejar') despachar({ tipo: 'DESPLANEJAR', cartaId: id });
    else if (av.acao === 'iniciar') abrirEquipe(id, 'equipe');
    else if (av.acao === 'revisar') abrirRevisor(id);
  }

  // ---------------- Início ----------------

  function iniciar() {
    OG.icones.instalarIcones(document);
    carregarConfig();
    const r = OG.persistencia.carregar();
    if (r.estado) app.estado = r.estado;
    render();
    if (r.problema === 'corrompido') {
      OG.ui.aviso('A partida salva estava danificada e foi descartada. Comece uma nova.', 'erro');
    } else if (r.problema === 'antigo') {
      OG.ui.aviso('A partida salva era da versão anterior do jogo, com regras diferentes, e foi descartada. Comece uma nova.', 'info');
    }
    document.addEventListener('click', aoClicar);
    document.addEventListener('change', aoMudar);
    document.addEventListener('keydown', aoTeclar);
    document.addEventListener('dragstart', aoIniciarArrasto);
    document.addEventListener('dragover', aoArrastarSobre);
    document.addEventListener('drop', aoSoltar);
    document.addEventListener('dragend', limparArrasto);
    document.addEventListener('scroll', aoRolarQuadro, true);
  }

  OG.app = {
    estadoAtual: function () { return app; },
    render: render,
    executarAcao: executarAcao,
  };

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
    else iniciar();
  }
})(globalThis);
