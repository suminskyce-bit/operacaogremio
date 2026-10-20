/*
 * ui.js — utilidades da interface: escape de HTML, avisos (toasts), janelas modais
 * acessíveis (foco preso, Esc, devolução do foco) e preservação do foco entre renderizações.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const FOCAVEIS = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea, [tabindex]:not([tabindex="-1"])';

  function esc(valor) {
    return String(valor == null ? '' : valor).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dinheiro(v) {
    return OG.util.formatarDinheiro(v);
  }

  // ---------------- Avisos ----------------

  function aviso(texto, tipo) {
    const raiz = document.getElementById('avisos');
    if (!raiz || !texto) return;
    const el = document.createElement('div');
    el.className = 'aviso aviso-' + (tipo || 'info');
    // O contêiner já é uma região "ao vivo"; erros ganham prioridade como alerta.
    if (tipo === 'erro') el.setAttribute('role', 'alert');
    const icone = tipo === 'erro' ? 'bloqueado' : tipo === 'bom' ? 'check' : 'info';
    el.innerHTML = OG.icones.icone(icone) + '<span>' + esc(texto) + '</span>';
    el.addEventListener('click', function () { el.remove(); });
    raiz.appendChild(el);
    while (raiz.children.length > 3) raiz.removeChild(raiz.firstChild);
    setTimeout(function () {
      el.classList.add('saindo');
      setTimeout(function () { el.remove(); }, 260);
    }, tipo === 'erro' ? 6500 : 4200);
  }

  // ---------------- Foco ----------------

  function chaveDoFoco() {
    const el = document.activeElement;
    return el && el.dataset ? el.dataset.foco || null : null;
  }

  function restaurarFoco(raiz, chave) {
    if (!chave) return false;
    const alvo = raiz.querySelector('[data-foco="' + chave.replace(/"/g, '') + '"]');
    if (alvo && typeof alvo.focus === 'function') {
      alvo.focus({ preventScroll: true });
      return true;
    }
    return false;
  }

  // ---------------- Modal ----------------

  const modalAtual = { chave: null, dispensavel: false, aoDispensar: null, opener: null };

  function raizModal() {
    return document.getElementById('modal-raiz');
  }

  /**
   * Mostra (ou atualiza) a janela modal.
   * desc = { chave, html, classe, dispensavel, aoDispensar } ou null para fechar.
   * Mesma chave = atualiza o conteúdo sem perder o foco.
   * chaveOpener: data-foco do elemento que abriu a janela (lido ANTES de a tela ser
   * redesenhada), para devolver o foco a ele quando a janela fechar.
   */
  function mostrarModal(desc, chaveOpener) {
    const raiz = raizModal();
    if (!raiz) return;
    if (!desc) {
      fecharModal();
      return;
    }
    const app = document.getElementById('app');
    if (modalAtual.chave === desc.chave) {
      const caixa = raiz.querySelector('.modal');
      if (caixa) {
        const foco = chaveDoFoco();
        const rolagem = caixa.querySelector('.modal-corpo') ? caixa.querySelector('.modal-corpo').scrollTop : 0;
        caixa.className = 'modal ' + (desc.classe || '');
        caixa.innerHTML = desc.html;
        const corpo = caixa.querySelector('.modal-corpo');
        if (corpo) corpo.scrollTop = rolagem;
        if (!restaurarFoco(caixa, foco) && !caixa.contains(document.activeElement)) caixa.focus();
        modalAtual.dispensavel = !!desc.dispensavel;
        modalAtual.aoDispensar = desc.aoDispensar || null;
        return;
      }
    }
    if (!modalAtual.chave) modalAtual.opener = chaveOpener !== undefined ? chaveOpener : chaveDoFoco();
    raiz.innerHTML =
      '<div class="modal-fundo" data-fundo-modal>' +
      '<div class="modal ' + (desc.classe || '') + '" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" tabindex="-1">' +
      desc.html +
      '</div></div>';
    modalAtual.chave = desc.chave;
    modalAtual.dispensavel = !!desc.dispensavel;
    modalAtual.aoDispensar = desc.aoDispensar || null;
    document.body.classList.add('com-modal');
    if (app) {
      app.setAttribute('inert', '');
      app.setAttribute('aria-hidden', 'true');
    }
    const caixa = raiz.querySelector('.modal');
    const inicial = caixa.querySelector('[data-foco-inicial]') || caixa.querySelector(FOCAVEIS) || caixa;
    inicial.focus({ preventScroll: true });
  }

  function fecharModal() {
    const raiz = raizModal();
    if (!modalAtual.chave) return;
    raiz.innerHTML = '';
    modalAtual.chave = null;
    modalAtual.aoDispensar = null;
    document.body.classList.remove('com-modal');
    const app = document.getElementById('app');
    if (app) {
      app.removeAttribute('inert');
      app.removeAttribute('aria-hidden');
      const chave = modalAtual.opener;
      modalAtual.opener = null;
      if (!restaurarFoco(app, chave)) {
        const principal = app.querySelector('[data-foco-principal]');
        if (principal) principal.focus({ preventScroll: true });
      }
    }
  }

  function modalAberto() {
    return modalAtual.chave;
  }

  /** Esc fecha o que é dispensável; Tab fica preso dentro da janela. */
  function tratarTecladoModal(evento) {
    if (!modalAtual.chave) return false;
    const caixa = raizModal().querySelector('.modal');
    if (!caixa) return false;
    if (evento.key === 'Escape') {
      if (modalAtual.dispensavel && modalAtual.aoDispensar) {
        evento.preventDefault();
        modalAtual.aoDispensar();
      }
      return true;
    }
    if (evento.key === 'Tab') {
      const itens = Array.prototype.filter.call(caixa.querySelectorAll(FOCAVEIS), function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      });
      if (!itens.length) {
        evento.preventDefault();
        caixa.focus();
        return true;
      }
      const primeiro = itens[0];
      const ultimo = itens[itens.length - 1];
      if (evento.shiftKey && (document.activeElement === primeiro || !caixa.contains(document.activeElement))) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && (document.activeElement === ultimo || !caixa.contains(document.activeElement))) {
        evento.preventDefault();
        primeiro.focus();
      }
      return true;
    }
    return false;
  }

  function cliqueNoFundo(evento) {
    if (!modalAtual.chave || !modalAtual.dispensavel) return false;
    if (evento.target && evento.target.hasAttribute && evento.target.hasAttribute('data-fundo-modal')) {
      if (modalAtual.aoDispensar) modalAtual.aoDispensar();
      return true;
    }
    return false;
  }

  OG.ui = {
    esc,
    dinheiro,
    aviso,
    chaveDoFoco,
    restaurarFoco,
    mostrarModal,
    fecharModal,
    modalAberto,
    tratarTecladoModal,
    cliqueNoFundo,
  };
})(globalThis);
