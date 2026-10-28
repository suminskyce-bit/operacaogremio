/*
 * personagens.js — coordenadores e voluntários ficam em listas SEPARADAS.
 *
 * COORDENADORES (5): cada card que sai do Backlog ganha um coordenador responsável.
 *   - Ele trabalha no projeto (soma 1 de força) e toca um projeto por vez.
 *   - area: projeto fora da área do responsável leva +1 rodada (regras.TEMPO_FORA_DA_AREA).
 *     Sumindo, o Coordenador Geral, é coringa: nunca está fora da área.
 *   - Só coordenadores revisam, e ninguém revisa o próprio projeto.
 *
 * VOLUNTÁRIOS (13): entram nas equipes. Somam 1 de força; 2 se forem especialistas
 * na categoria do projeto (Dexter também nos projetos com equipamento). Cada
 * voluntário especialista na equipe dá R$ 10 de desconto no custo.
 *
 * Foto do JV: o arquivo não veio junto com os outros retratos. Para usar uma foto,
 * coloque `jv.png` em assets/personagens/ e troque `foto: null` por
 * `foto: 'assets/personagens/jv.png'`. Sem foto, aparecem as iniciais.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});
  OG.dados = OG.dados || {};

  function congelar(lista, campo) {
    return Object.freeze(
      lista.map(function (p) {
        if (p[campo]) {
          if (p[campo].categorias) Object.freeze(p[campo].categorias);
          if (p[campo].riscos) Object.freeze(p[campo].riscos);
          Object.freeze(p[campo]);
        }
        return Object.freeze(p);
      })
    );
  }

  OG.dados.coordenadores = congelar([
    {
      id: 'sumindo',
      nome: 'Sumindo',
      cargo: 'Coordenador Geral',
      foto: 'assets/personagens/sumindo.png',
      area: { rotulo: 'Geral — nunca fica fora da área', coringa: true, categorias: [] },
    },
    {
      id: 'antune',
      nome: 'Antune',
      cargo: 'Coordenador Cultural',
      foto: 'assets/personagens/antune.png',
      area: { rotulo: 'Cultura', categorias: ['cultura'] },
    },
    {
      id: 'luize',
      nome: 'Luize',
      cargo: 'Coordenador de Infraestrutura',
      foto: 'assets/personagens/luize.png',
      area: { rotulo: 'Estrutura', categorias: ['estrutura'] },
    },
    {
      id: 'ryani',
      nome: 'Ryani',
      cargo: 'Coordenadora de Comunicação',
      foto: 'assets/personagens/ryani.png',
      area: { rotulo: 'Divulgação', categorias: ['divulgacao'] },
    },
    {
      id: 'jv',
      nome: 'JV',
      cargo: 'Coordenador Financeiro',
      foto: null,
      area: { rotulo: 'Logística e Vendas', categorias: ['logistica'] },
    },
  ], 'area');

  // Ordem igual à lista oficial dos 13 voluntários.
  OG.dados.voluntarios = congelar([
    {
      id: 'patricio',
      nome: 'Patrício',
      cargo: 'Voluntário coringa',
      especialidade: { rotulo: 'Coringa — qualquer categoria', coringa: true },
      // Patrício não fica no Grêmio o tempo todo: ele aparece com o evento
      // "Patrício Ajudou" e fica 2 rodadas como trabalhador temporário.
      somentePorEvento: true,
    },
    {
      id: 'dexter',
      nome: 'Dexter',
      cargo: 'Voluntário',
      especialidade: {
        rotulo: 'Técnico — Estrutura e projetos com equipamento',
        categorias: ['estrutura'],
        riscos: ['equipamento'],
      },
    },
    {
      id: 'patrick',
      nome: 'Patrick',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Comunicação — Divulgação', categorias: ['divulgacao'] },
    },
    {
      id: 'wesley',
      nome: 'Wesley',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Operacional — Logística e Vendas', categorias: ['logistica'] },
    },
    {
      id: 'deyverson',
      nome: 'Deyverson',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Esportes', categorias: ['esporte'] },
    },
    {
      id: 'agatha',
      nome: 'Agatha Cross',
      cargo: 'Voluntária',
      especialidade: { rotulo: 'Artes cênicas — Cultura', categorias: ['cultura'] },
    },
    {
      id: 'costit',
      nome: 'Costit',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Arbitragem — Esporte', categorias: ['esporte'] },
    },
    {
      id: 'wiky',
      nome: 'Wiky',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Games', categorias: ['games'] },
    },
    {
      id: 'potter',
      nome: 'Potter',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Games', categorias: ['games'] },
    },
    {
      id: 'wliam',
      nome: 'Wliam Woka',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Cozinha e barracas — Logística e Vendas', categorias: ['logistica'] },
    },
    {
      id: 'monica',
      nome: 'Monica',
      cargo: 'Voluntária',
      especialidade: { rotulo: 'Redes sociais — Divulgação', categorias: ['divulgacao'] },
    },
    {
      id: 'giulie',
      nome: 'Giulie',
      cargo: 'Voluntária',
      especialidade: { rotulo: 'Música e dança — Cultura', categorias: ['cultura'] },
    },
    {
      id: 'maicon',
      nome: 'Maicon',
      cargo: 'Voluntário',
      especialidade: { rotulo: 'Montagem — Estrutura', categorias: ['estrutura'] },
    },
  ], 'especialidade');
})(globalThis);
