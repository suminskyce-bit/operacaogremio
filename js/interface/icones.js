/*
 * icones.js — ícones em SVG embutidos (funcionam offline e com duplo clique no index.html).
 * Ícones de Lucide (https://lucide.dev), licença ISC: Copyright (c) Lucide Contributors.
 * "tradicao" (cuia de chimarrão) e "mesas" foram desenhados para este jogo no mesmo estilo.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});

  const SPRITE = '<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true">' +
    '<symbol id="i-dinheiro" viewBox="0 0 24 24"><path d="M13.744 17.736a6 6 0 1 1-7.48-7.48" /> <path d="M15 6h1v4" /> <path d="m6.134 14.768.866-.5 2 3.464" /> <circle cx="16" cy="8" r="6" /></symbol>' +
    '<symbol id="i-prestigio" viewBox="0 0 24 24"><path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" /></symbol>' +
    '<symbol id="i-tempo" viewBox="0 0 24 24"><path d="M5 22h14" /> <path d="M5 2h14" /> <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /> <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></symbol>' +
    '<symbol id="i-pessoas" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <path d="M16 3.128a4 4 0 0 1 0 7.744" /> <path d="M22 21v-2a4 4 0 0 0-3-3.87" /> <circle cx="9" cy="7" r="4" /></symbol>' +
    '<symbol id="i-pessoa" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /> <circle cx="12" cy="7" r="4" /></symbol>' +
    '<symbol id="i-cultura" viewBox="0 0 24 24"><path d="M10 11h.01" /> <path d="M14 6h.01" /> <path d="M18 6h.01" /> <path d="M6.5 13.1h.01" /> <path d="M22 5c0 9-4 12-6 12s-6-3-6-12c0-2 2-3 6-3s6 1 6 3" /> <path d="M17.4 9.9c-.8.8-2 .8-2.8 0" /> <path d="M10.1 7.1C9 7.2 7.7 7.7 6 8.6c-3.5 2-4.7 3.9-3.7 5.6 4.5 7.8 9.5 8.4 11.2 7.4.9-.5 1.9-2.1 1.9-4.7" /> <path d="M9.1 16.5c.3-1.1 1.4-1.7 2.4-1.4" /></symbol>' +
    '<symbol id="i-estrutura" viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z" /></symbol>' +
    '<symbol id="i-divulgacao" viewBox="0 0 24 24"><path d="M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /> <path d="M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14" /> <path d="M8 6v8" /></symbol>' +
    '<symbol id="i-esporte" viewBox="0 0 24 24"><path d="M11 7a16 16 20 0 1 10.98 4.362" /> <path d="M12 12a13 13 0 0 1-8.66 5" /> <path d="M16.83 13.634a16 16 0 0 1-9.267 7.328" /> <path d="M20.66 17A13 13 0 0 0 12 12a13 13 0 0 1 0-10" /> <path d="M8.17 15.366a16 16 0 0 1-1.713-11.69" /> <circle cx="12" cy="12" r="10" /></symbol>' +
    '<symbol id="i-games" viewBox="0 0 24 24"><line x1="6" x2="10" y1="11" y2="11" /> <line x1="8" x2="8" y1="9" y2="13" /> <line x1="15" x2="15.01" y1="12" y2="12" /> <line x1="18" x2="18.01" y1="10" y2="10" /> <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" /></symbol>' +
    '<symbol id="i-logistica" viewBox="0 0 24 24"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z" /> <path d="M12 22V12" /> <polyline points="3.29 7 12 12 20.71 7" /> <path d="m7.5 4.27 9 5.15" /></symbol>' +
    '<symbol id="i-quadra" viewBox="0 0 24 24"><path d="m12 8 6-3-6-3v10" /> <path d="m8 11.99-5.5 3.14a1 1 0 0 0 0 1.74l8.5 4.86a2 2 0 0 0 2 0l8.5-4.86a1 1 0 0 0 0-1.74L16 12" /> <path d="m6.49 12.85 11.02 6.3" /> <path d="M17.51 12.85 6.5 19.15" /></symbol>' +
    '<symbol id="i-equipamento" viewBox="0 0 24 24"><path d="M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6-2.3 2.3a2.4 2.4 0 0 0 0 3.4Z" /> <path d="m2 22 3-3" /> <path d="M7.5 13.5 10 11" /> <path d="M10.5 16.5 13 14" /> <path d="m18 3-4 4h6l-4 4" /></symbol>' +
    '<symbol id="i-fornecedor" viewBox="0 0 24 24"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /> <path d="M15 18H9" /> <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /> <circle cx="17" cy="18" r="2" /> <circle cx="7" cy="18" r="2" /></symbol>' +
    '<symbol id="i-check" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5" /></symbol>' +
    '<symbol id="i-concluido" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /> <path d="m16 9-5.5 5.5L8 12" /></symbol>' +
    '<symbol id="i-alerta" viewBox="0 0 24 24"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" /> <path d="M12 9v4" /> <path d="M12 17h.01" /></symbol>' +
    '<symbol id="i-fechar" viewBox="0 0 24 24"><path d="M18 6 6 18" /> <path d="m6 6 12 12" /></symbol>' +
    '<symbol id="i-menu" viewBox="0 0 24 24"><path d="M4 5h16" /> <path d="M4 12h16" /> <path d="M4 19h16" /></symbol>' +
    '<symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /> <path d="M12 16v-4" /> <path d="M12 8h.01" /></symbol>' +
    '<symbol id="i-historico" viewBox="0 0 24 24"><path d="M15 12h-5" /> <path d="M15 8h-5" /> <path d="M19 17V5a2 2 0 0 0-2-2H4" /> <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" /></symbol>' +
    '<symbol id="i-financas" viewBox="0 0 24 24"><path d="M12 17V7" /> <path d="M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8" /> <path d="M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z" /></symbol>' +
    '<symbol id="i-regras" viewBox="0 0 24 24"><path d="M12 5v16" /> <path d="M20.001 19A2 2 0 0022 17V5a2 2 0 00-1.999-2L16 3.002A5 5 0 0012 5a5 5 0 00-4-2H4a2 2 0 00-2 2v12a2 2 0 001.999 2H8a5 5 0 014 2 5 5 0 014-2z" /></symbol>' +
    '<symbol id="i-arrastar" viewBox="0 0 24 24"><circle cx="9" cy="12" r="1" /> <circle cx="9" cy="5" r="1" /> <circle cx="9" cy="19" r="1" /> <circle cx="15" cy="12" r="1" /> <circle cx="15" cy="5" r="1" /> <circle cx="15" cy="19" r="1" /></symbol>' +
    '<symbol id="i-jogar" viewBox="0 0 24 24"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" /></symbol>' +
    '<symbol id="i-config" viewBox="0 0 24 24"><path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /> <circle cx="12" cy="12" r="3" /></symbol>' +
    '<symbol id="i-ajuda" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /> <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /> <path d="M12 17h.01" /></symbol>' +
    '<symbol id="i-reiniciar" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" /></symbol>' +
    '<symbol id="i-mutirao" viewBox="0 0 24 24"><path d="M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z" /></symbol>' +
    '<symbol id="i-missao" viewBox="0 0 24 24"><path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" /></symbol>' +
    '<symbol id="i-inicio" viewBox="0 0 24 24"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></symbol>' +
    '<symbol id="i-rodada" viewBox="0 0 24 24"><path d="M8 2v3" /> <path d="M16 2v3" /> <rect x="3" y="3" width="18" height="18" rx="2" /> <path d="M3 9h18" /></symbol>' +
    '<symbol id="i-bloqueado" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /> <path d="M4.929 4.929 19.07 19.071" /></symbol>' +
    '<symbol id="i-positivo" viewBox="0 0 24 24"><path d="M5.8 11.3 2 22l10.7-3.79" /> <path d="M4 3h.01" /> <path d="M22 8h.01" /> <path d="M15 2h.01" /> <path d="M22 20h.01" /> <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10" /> <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17" /> <path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7" /> <path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" /></symbol>' +
    '<symbol id="i-negativo" viewBox="0 0 24 24"><path d="M6 16.326A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 .5 8.973" /> <path d="m13 12-3 5h4l-3 5" /></symbol>' +
    '<symbol id="i-despesa" viewBox="0 0 24 24"><path d="M11 15h2a2 2 0 1 0 0-4h-3c-.6 0-1.1.2-1.4.6L3 17" /> <path d="m7 21 1.6-1.4c.3-.4.8-.6 1.4-.6h4c1.1 0 2.1-.4 2.8-1.2l4.6-4.4a2 2 0 0 0-2.75-2.91l-4.2 3.9" /> <path d="m2 16 6 6" /> <circle cx="16" cy="9" r="2.9" /> <circle cx="6" cy="5" r="3" /></symbol>' +
    '<symbol id="i-revisar" viewBox="0 0 24 24"><path d="M13 5h8" /> <path d="M13 12h8" /> <path d="M13 19h8" /> <path d="m3 17 2 2 4-4" /> <path d="m3 7 2 2 4-4" /></symbol>' +
    '<symbol id="i-meta" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /> <circle cx="12" cy="12" r="6" /> <circle cx="12" cy="12" r="2" /></symbol>' +
    '<symbol id="i-premio" viewBox="0 0 24 24"><path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526" /> <circle cx="12" cy="8" r="6" /></symbol>' +
    '<symbol id="i-parado" viewBox="0 0 24 24"><rect x="14" y="3" width="5" height="18" rx="1" /> <rect x="5" y="3" width="5" height="18" rx="1" /></symbol>' +
    '<symbol id="i-voltar" viewBox="0 0 24 24"><path d="m12 19-7-7 7-7" /> <path d="M19 12H5" /></symbol>' +
    '<symbol id="i-direita" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6" /></symbol>' +
    '<symbol id="i-esquerda" viewBox="0 0 24 24"><path d="m15 18-6-6 6-6" /></symbol>' +
    '<symbol id="i-baixo" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6" /></symbol>' +
    '<symbol id="i-reforco" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /> <circle cx="9" cy="7" r="4" /> <line x1="19" x2="19" y1="8" y2="14" /> <line x1="22" x2="16" y1="11" y2="11" /></symbol>' +
    '<symbol id="i-doente" viewBox="0 0 24 24"><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0Z" /></symbol>' +
    '<symbol id="i-kanban" viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" /> <path d="M8 7v7" /> <path d="M12 7v4" /> <path d="M16 7v9" /></symbol>' +
    '<symbol id="i-sair" viewBox="0 0 24 24"><path d="M10 21H2" /> <path d="M10 3H7a2 2 0 00-2 2v16" /> <path d="M14 12h.01" /> <path d="M19 21V5a2 2 0 00-1.675-1.974l-6.163-1.013A1 1 0 0010 3v18a1 1 0 001.124.992z" /> <path d="M22 21h-3" /></symbol>' +
    '<symbol id="i-sobe" viewBox="0 0 24 24"><path d="M16 7h6v6" /> <path d="m22 7-8.5 8.5-5-5L2 17" /></symbol>' +
    '<symbol id="i-desce" viewBox="0 0 24 24"><path d="M16 17h6v-6" /> <path d="m22 17-8.5-8.5-5 5L2 7" /></symbol>' +
    '<symbol id="i-tradicao" viewBox="0 0 24 24"><path d="M5.5 10.5c-.4 1-.6 2-.6 3a6.6 6.6 0 0 0 13.2 0c0-1-.2-2-.6-3"/><path d="M4.8 10.5h13.4"/><path d="M13 10.5 17.5 3"/><path d="M16.3 2.6l2.4 1.4"/><path d="M8 21.2h7"/></symbol>' +
    '<symbol id="i-mesas" viewBox="0 0 24 24"><path d="M3 8h18"/><path d="M5 8v12"/><path d="M19 8v12"/><path d="M5 12h14"/></symbol>' +
    '</svg>';

  function instalarIcones(documento) {
    if (documento.getElementById('og-icones')) return;
    const div = documento.createElement('div');
    div.id = 'og-icones';
    div.innerHTML = SPRITE;
    documento.body.insertBefore(div, documento.body.firstChild);
  }

  /** <svg> de um ícone. `rotulo` vazio = decorativo (escondido de leitores de tela). */
  function icone(nome, classe, rotulo) {
    const acessivel = rotulo ? ' role="img" aria-label="' + rotulo + '"' : ' aria-hidden="true" focusable="false"';
    return '<svg class="ic' + (classe ? ' ' + classe : '') + '"' + acessivel +
      ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<use href="#i-' + nome + '"></use></svg>';
  }

  OG.icones = { instalarIcones: instalarIcones, icone: icone };
})(globalThis);
