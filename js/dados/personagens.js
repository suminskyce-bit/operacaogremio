/*
 * personagens.js — coordenadores e voluntários ficam em listas SEPARADAS.
 *
 * Especialidade: quem é especialista na categoria do projeto dá R$ 10 de desconto
 * no custo (regras.DESCONTO_ESPECIALISTA). "coringa" vale para qualquer categoria.
 *
 * Só coordenadores fazem a REVISÃO (conferência final) dos projetos.
 *
 * Foto do JV: o arquivo não veio junto com os outros retratos. Para usar uma foto,
 * coloque `jv.png` em assets/personagens/ e troque `foto: null` por
 * `foto: 'assets/personagens/jv.png'`. Sem foto, aparecem as iniciais.
 */
(function (global) {
  'use strict';
  const OG = (global.OG = global.OG || {});
  OG.dados = OG.dados || {};

  function congelar(lista) {
    return Object.freeze(
      lista.map(function (p) {
        if (p.especialidade) Object.freeze(p.especialidade);
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
      especialidade: { rotulo: 'Liderança — qualquer categoria', coringa: true },
    },
    {
      id: 'antune',
      nome: 'Antune',
      cargo: 'Coordenador Cultural',
      foto: 'assets/personagens/antune.png',
      especialidade: { rotulo: 'Cultura', categorias: ['cultura'] },
    },
    {
      id: 'luize',
      nome: 'Luize',
      cargo: 'Coordenador de Infraestrutura',
      foto: 'assets/personagens/luize.png',
      especialidade: { rotulo: 'Estrutura', categorias: ['estrutura'] },
    },
    {
      id: 'ryani',
      nome: 'Ryani',
      cargo: 'Coordenadora de Comunicação',
      foto: 'assets/personagens/ryani.png',
      especialidade: { rotulo: 'Divulgação', categorias: ['divulgacao'] },
    },
    {
      id: 'jv',
      nome: 'JV',
      cargo: 'Coordenador Financeiro',
      foto: null,
      especialidade: { rotulo: 'Logística e Vendas', categorias: ['logistica'] },
    },
  ]);

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
  ]);
})(globalThis);
