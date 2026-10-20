# Operação Grêmio — Mesquita

Jogo web de **Kanban** com **educação financeira**. O Grêmio Estudantil da Escola Técnica Mesquita
precisa tirar um evento do papel em **4 rodadas** (uns 20 minutos): escolher projetos, montar a equipe,
cuidar do caixa e encarar os imprevistos.

Não precisa instalar nada para jogar. Não usa internet, servidor nem banco de dados: tudo roda no navegador
e a partida fica salva no próprio navegador.

---

## Como abrir no VS Code

1. Descompacte a pasta e abra no VS Code (**Arquivo → Abrir Pasta…**).
2. Escolha **um** destes jeitos:

| Jeito | Como | Precisa de |
|---|---|---|
| **Live Server** (recomendado) | O VS Code vai sugerir a extensão *Live Server*. Instale, clique com o botão direito em `index.html` → **Open with Live Server**. A página recarrega sozinha quando você salva um arquivo. | Extensão Live Server |
| **Duplo clique** | Abra `index.html` direto no navegador (ou aperte **F5** no VS Code e escolha *Abrir o jogo no Chrome*). | Nada |
| **Servidor do projeto** | No terminal do VS Code: `npm start` e abra `http://localhost:5173`. | Node.js 18+ |

Quer mandar o jogo para alguém? `npm run arquivo-unico` gera `dist/operacao-gremio-mesquita.html`, **um arquivo único**
com tudo dentro (fontes e fotos incluídas). É só abrir com duplo clique.

---

## Publicar na internet

### Vercel (pelo GitHub)

1. No GitHub, os arquivos `index.html`, `package.json` e `vercel.json` precisam ficar **na raiz do repositório**,
   e não dentro de uma subpasta. Ao enviar pelo site do GitHub, arraste **o conteúdo** da pasta do projeto.
   Se preferir deixar numa subpasta, informe essa pasta em *Root Directory* nas configurações do projeto no Vercel.
2. No Vercel: **Add New → Project**, escolha o repositório e clique em **Deploy**. Não precisa mudar nada:
   o `vercel.json` já define o build (`npm run build`), a pasta publicada (`public`) e o tipo de projeto (*Other*).
   Ele vale mais que o que estiver no painel, então funciona mesmo se você tiver mexido nas configurações antes.
3. A cada push no GitHub, o Vercel publica de novo sozinho.

O `npm run build` monta a pasta `public/` só com o site (`index.html`, `css`, `js`, `assets`) e confere se todo
arquivo citado existe. Se faltar algo (uma foto, por exemplo), o build falha com a lista do que faltou,
em vez de publicar um site quebrado. Para ver no seu computador exatamente o que vai para o ar: `npm run preview`.

### GitHub Pages (sem build)

**Settings → Pages → Deploy from a branch → `main` / `(root)`**. O site funciona direto da raiz do repositório
(o arquivo `.nojekyll` já está incluído para o GitHub não processar nada).

---

## Como jogar

1. **Leia o evento da rodada.** Toda rodada começa com uma carta (imprevisto, boa notícia ou despesa). Ela vale para a rodada inteira.
2. **Planeje:** arraste projetos do **Backlog** para **A fazer** (ou use o botão *Planejar*).
3. **Inicie:** leve o projeto para **Em andamento**, escolha a equipe e pague o custo. **Máximo de 2 ao mesmo tempo.**
4. **Encerre a rodada:** cada projeto em andamento ganha 1 rodada de progresso. Quem completa vai sozinho para **Revisão**.
5. **Revise:** na rodada seguinte, um **coordenador** livre confere o projeto e ele vai para **Concluído**. Só aí entram retorno, prestígio e tradição.
6. **Cumpra a missão** (concluir 4 dos 6 projetos) antes do fim da rodada 4.

Regras importantes:

- **Custo** é pago uma vez, ao iniciar. **Retorno** entra uma vez, ao concluir. *Retorno não é lucro*: lucro = retorno − custo.
- O caixa **nunca fica negativo**. Despesa obrigatória sem dinheiro: paga-se o que houver e o resto vira desgaste (−1 Prestígio a cada R$ 10,00).
- **Especialista** na categoria do projeto: R$ 10,00 de desconto por pessoa.
- **Só coordenadores revisam**, e quem revisou fica ocupado até o fim da rodada.
- Projeto iniciado na última rodada **não termina a tempo**. O jogo avisa no card e na hora de iniciar.
- Ícones nos cards mostram **riscos** (quadra, equipamento, fornecedor, mesas): alguns eventos miram esses projetos.

**Pontuação** (como pedido): `caixa ÷ 10 + prestígio + tradição + 5 por projeto concluído`, só com números inteiros.
A tela final mostra a conta linha por linha.

---

## Estrutura

```
index.html               página única; a ordem dos <script> é a ordem de carregamento
css/estilo.css           visual (roxo Mesquita, painéis brancos), responsivo
js/dados/                personagens, projetos (catálogo), missões, eventos e despesas
js/nucleo/               regras do jogo, sem nada de interface:
  estado.js                leitura do estado (recursos vêm do livro-caixa)
  kanban.js                movimentos, limite de 2, equipe, revisão, mutirão
  financas.js              custos, descontos, despesas, caixa nunca negativo
  eventos.js               baralho, efeitos imediatos e de fim de rodada
  rodada.js                fim de rodada e passagem de rodada
  pontuacao.js             pontuação, meta da missão, resumo financeiro
  motor.js                 ponto único de entrada: OG.motor.aplicar(estado, ação)
  persistencia.js          salvar/carregar com validação completa
js/interface/            telas, componentes, janelas, arrastar e soltar, teclado
assets/                  fotos da coordenação e a fonte Archivo (embutida, funciona offline)
tests/                   testes automáticos, fuzzing, simulação e teste de interface
tools/                   preparar publicação (public/), servidor local e gerador do arquivo único
vercel.json              configuração de publicação no Vercel
public/                  gerada pelo "npm run build" (não vai para o GitHub)
dist/                    gerada pelo "npm run arquivo-unico" (não vai para o GitHub)
```

Toda regra mora no **núcleo**. A interface só pergunta ao núcleo se pode e mostra o motivo quando não pode.
Uma ação inválida devolve o estado intacto e uma mensagem.

---

## Testes

```bash
npm test            # 94 testes: núcleo do jogo + publicação (Node 18+, sem instalar nada)
npm run simular     # simulação de balanceamento (milhares de partidas)
npm run test:e2e    # teste da interface no navegador (opcional, precisa do Playwright)
npm run build       # monta public/ para publicar
npm run preview     # monta public/ e abre em http://localhost:5173, igual ao site publicado
```

Para o teste de interface: `npm install --no-save playwright && npx playwright install chromium`.

### O que foi executado nesta entrega

- **94 testes, todos passando**: valores do catálogo conferidos card a card contra a especificação, nomes,
  missões, Kanban, limite de 2, equipe, revisão, cada um dos 20 eventos, despesas, descontos, rodadas,
  pontuação e persistência (16 tipos de estado adulterado são recusados). Mais 4 de publicação: `vercel.json`
  e `package.json` combinando, `public/` completa e sem arquivos internos, build que não apaga pasta alheia
  e que falha se faltar arquivo.
- **Fuzzing**: mais de 50 mil ações aleatórias (válidas, inválidas, repetidas, fora de hora) em 300 partidas.
  Depois de cada ação conferimos que o caixa nunca fica negativo, que nunca há mais de 2 em andamento,
  que ninguém está em dois projetos, que custo e retorno são lançados no máximo uma vez e que o estado continua válido.
- **17 casos de interface no Chromium**, rodados no `index.html` **e** no arquivo único: partidas completas
  clicando como um jogador (Farroupilha, Halloween, Liga, Semana do Estudante, Show de Talentos em caixa apertado,
  e Farroupilha no celular), conferindo a cada passo se caixa, prestígio, tradição e cards na tela batem com o estado real;
  arrastar e soltar (válido e inválido); terceiro projeto bloqueado com explicação; recarregar a página no meio da rodada;
  nova partida pedida durante um evento; só teclado (foco preso na janela, Esc, foco acompanhando o card);
  celular 390×844 e tablet 900×1100; partida salva adulterada; nenhum erro no console.
- **Layout medido em 15 larguras (320 a 1920 px)**: sem rolagem lateral da página, sem coluna escondida, sem texto estourando os cards.
- **Publicação no Vercel** (versão 1.0.1): com o Vercel CLI 64.7.0 rodando localmente, a versão anterior reproduz o erro
  `STATIC_BUILD_NO_OUT_DIR` e a atual compila ("Build completed successfully"). Os 17 casos de interface passam
  jogando direto da pasta que o Vercel gera para publicar.

---

## Balanceamento: o que mudei da especificação e por quê

A especificação pedia para corrigir o que não funcionasse e documentar. Os números abaixo vêm de
`npm run simular` (300 partidas por missão e por perfil de jogador).

| # | O que estava | Problema encontrado | O que fiz |
|---|---|---|---|
| 1 | Classificação por pontos: 100 / 80 / 60 / 40 | Só o caixa e os recursos iniciais já valem **90 pontos**: quem não fizesse **nada** seria "GRÊMIO DESTAQUE". E cada missão rende diferente (Farroupilha ~280 pontos, Show de Talentos ~228). | Os mesmos 100 / 80 / 60 / 40 passaram a ser **% de aproveitamento**: pontos conquistados na partida ÷ pontos que o melhor plano possível conquistaria (calculado dos próprios cards, sem eventos). A tela final explica a conta. |
| 2 | Missões Gamer, Liga, Profissões e Concolor pediam 3 projetos | Cumpridas em **98–100%** das partidas: virava formalidade. | Todas pedem **4 de 6**. Recompensas mantidas. |
| 3 | Liga e Concolor só tinham projetos de 1 rodada | Sem a decisão "projeto grande e arriscado ou vários pequenos". | Liga ganhou **Atletismo** (2 rodadas) e **Queimada**; **Preparação dos Times** do Concolor dura 2 rodadas. Toda missão tem um projeto grande. |
| 4 | "Acabou o Chimarrão": nenhum card entra em andamento | Só 3 rodadas permitem começar projetos que terminam. Na rodada 3, esse evento zerava a missão em **100%** das simulações. | Agora **só UM** card pode começar na rodada. Revisões continuam liberadas. |
| 5 | Baralho livre | Partidas só de punição, ou dois eventos que travam a rodada juntos. | Por partida: **pelo menos 1 evento positivo**, no máximo 1 evento severo (Chimarrão ou Provas) e **nunca na rodada 1** (ainda não há nada para terminar). |
| 6 | Caixa inicial R$ 500 | Mantido. Mas com esse valor o caixa nunca passa de ~R$ 240 para baixo: o dinheiro conta pontos e ensina, mas não trava decisões. | Padrão continua **R$ 500**. Em *Configurações* há o **Caixa apertado (R$ 200)**: aí o caixa zera em parte das partidas e pagar ou não pagar vira decisão de verdade. |

Interpretações que precisei fixar (a especificação não dizia):

- **Eventos** são sorteados no **início** da rodada (vários dizem "nesta rodada"). Efeitos que dependem dos projetos
  em andamento (reunião, fornecedor, equipamento, mesas) são resolvidos ao encerrar a rodada, com escolha do jogador.
  Dá para se preparar, e dá para voltar ao quadro antes de decidir.
- **Revisão exige um coordenador** (a "conferência final"). Isso dá função à coluna Revisão e diferencia coordenadores de voluntários.
- **Patrício** é o coringa: só aparece com o evento "Patrício Ajudou" (o texto diz que ele *apareceu*) e fica 2 rodadas.
  Não pode entrar num projeto mais longo do que a estadia dele. Se um evento atrasar o projeto, ele vai embora
  e o card pede "Completar equipe".
- **Semana de Provas**: só **um card** se move na rodada, mas ele pode avançar mais de uma etapa. Sem isso,
  na rodada 1 seria impossível começar qualquer coisa (tudo começa no Backlog).
- **Quadra em reforma** para os projetos que **usam a quadra**. Xadrez e Truco são da Liga, mas não usam quadra.
- **Recompensa da missão** entra na hora em que o objetivo é atingido (uma única vez).
- **Cards criados** para completar 6 por missão (mesma curva de custo e retorno dos originais):
  Transmissão ao Vivo, Queimada, Atletismo, Sarau do Mesquita, Oficina de Danças Gaúchas, Oficina de Currículo,
  Ensaio Geral, Preparação dos Times, e Campeonato, Festa e Show (citados na Semana do Estudante sem valores).
- **Especialidades** dos voluntários sem especialidade definida: Agatha Cross e Giulie (Cultura), Costit (Esporte),
  Wiky e Potter (Games), Wliam Woka (Logística e Vendas), Monica (Divulgação), Maicon (Estrutura).

### Resultado da simulação (todas as missões)

| Perfil de jogador | Missão cumprida | Classificação mais comum |
|---|---|---|
| Planeja bem | 98–100% | Lendário (53%) ou Destaque (46%) |
| Só projetos baratos | 98–100% | Destaque (76%), cerca de 20 pontos a menos |
| Descuidado (esquece revisões, começa tarde) | 14–16% | Sobreviveu (50%) |
| Não faz nada | 0% | A Direção quer conversar (100%) |

Nenhum evento isolado derruba a missão do bom jogador para menos de 91%. Só eventos negativos: 92% de missões cumpridas.

---

## Limitações conhecidas

- **Arrastar e soltar não funciona com o dedo** (celular/tablet): é uma limitação do arrastar nativo dos navegadores.
  No toque, use os botões dos cards (*Planejar*, *Iniciar*, *Revisar*). Eles fazem exatamente o mesmo.
- Testado automaticamente só no **Chromium** (base do Chrome e do Edge). Não foi testado em Safari, Firefox nem em celulares reais.
- O balanceamento foi validado com **jogadores simulados**. Alunos de verdade vão errar mais que o robô "planeja bem".
  Vale uma rodada de teste com a turma antes de apresentar.
- A **foto do JV** não veio no arquivo: aparecem as iniciais. Para usar uma foto, coloque `jv.png` em `assets/personagens/`
  e troque `foto: null` por `foto: 'assets/personagens/jv.png'` em `js/dados/personagens.js`.
- Com 17 pessoas e no máximo 2 projetos rodando, **a quantidade de gente nunca falta**. O que pesa é quem é especialista
  e guardar coordenadores para revisar. Isso é consequência direta da regra de limite 2, que é o coração do Kanban.
- Leitores de tela (NVDA, VoiceOver) não foram testados de verdade. A navegação por teclado, os rótulos e os avisos falados foram implementados e testados por teclado.
- A partida fica salva **neste navegador**. Em janela anônima pode não salvar (o jogo avisa).

## Para mexer no jogo

- Números gerais (rodadas, caixa inicial, limite, desconto): `js/nucleo/regras.js`
- Cards: `js/dados/projetos.js` · Missões: `js/dados/missoes.js` · Eventos: `js/dados/eventos.js` · Personagens: `js/dados/personagens.js`
- Depois de mudar valores, rode `npm test` e `npm run simular` para ver se nada quebrou e se continua equilibrado.

## Créditos

- Ideia, retratos da coordenação e identidade visual: Grêmio da Escola Técnica Mesquita.
- Fonte **Archivo** (Omnibus-Type), licença SIL Open Font License 1.1 (`assets/fontes/LICENCA-Archivo-OFL.txt`).
- Ícones de **Lucide** (lucide.dev), licença ISC. Os ícones da cuia de chimarrão e da mesa foram desenhados para o jogo.
