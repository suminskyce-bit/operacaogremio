# Operação Grêmio — Mesquita · versão 2.0

Jogo web de **Kanban** com **educação financeira**. O Grêmio Estudantil da Escola Técnica Mesquita organiza
os eventos da escola num quadro Kanban: **todo card precisa de um coordenador responsável e de uma equipe**,
cada pessoa trabalha em um projeto por vez, os prazos importam e **pedidos novos chegam a cada rodada**.
Antes de começar, você escolhe a duração: **4, 8, 10 ou 26 rodadas**.

Não precisa instalar nada para jogar. Não usa internet, servidor nem banco de dados: tudo roda no navegador
e a partida fica salva no próprio navegador.

---

## Como abrir no VS Code

1. Descompacte a pasta e abra no VS Code (**Arquivo → Abrir Pasta…**).
2. Escolha **um** destes jeitos:

| Jeito | Como | Precisa de |
|---|---|---|
| **Live Server** (recomendado) | O VS Code vai sugerir a extensão *Live Server*. Instale, clique com o botão direito em `index.html` → **Open with Live Server**. | Extensão Live Server |
| **Duplo clique** | Abra `index.html` direto no navegador (ou aperte **F5** no VS Code e escolha *Abrir o jogo no Chrome*). | Nada |
| **Servidor do projeto** | No terminal do VS Code: `npm start` e abra `http://localhost:5173`. | Node.js 18+ |

Quer mandar o jogo para alguém? `npm run arquivo-unico` gera `dist/operacao-gremio-mesquita.html`, **um arquivo único**
com tudo dentro (fontes e fotos incluídas). É só abrir com duplo clique.

## Publicar na internet

**No ar:** https://operacao-gremio-mesquita.vercel.app

O projeto `operacao-gremio-mesquita` do Vercel está ligado ao repositório `suminskyce-bit/operacaogremio`.
**Todo envio para a branch `main` publica sozinho** em produção. Envios para outras branches viram prévias.

**Para publicar em outro lugar pelo Vercel (pelo GitHub):** os arquivos `index.html`, `package.json` e `vercel.json` precisam ficar **na raiz do repositório**.
No Vercel: **Add New → Project**, escolha o repositório e **Deploy**. O `vercel.json` já define o build (`npm run build`),
a pasta publicada (`public`) e o tipo de projeto (*Other*).

**GitHub Pages (sem build):** **Settings → Pages → Deploy from a branch → `main` / `(root)`**.

---

## Como jogar

1. **Escolha a duração e a missão de abertura.** Rápida (4 rodadas, ≈ 20 min, 1 missão), Média (8, ≈ 40 min, 2 missões),
   Longa (10, ≈ 50 min, 3 missões) ou Ano letivo (26, ≈ 2 h, as 10 missões). Nas partidas longas, as outras missões são
   sorteadas e chegam ao longo do jogo.
2. **Leia o evento da rodada.** Uma carta por rodada: imprevisto, boa notícia ou despesa. Vale para a rodada inteira.
3. **Planejar = escolher quem vai tocar.** Leve um card do **Backlog** para **A fazer** escolhendo o **coordenador
   responsável**. A janela *Quem vai tocar?* compara os 5: quanto tempo cada um leva, se é da área, quando consegue
   começar e se cabe no prazo. Ninguém vem marcado: a escolha é sua.

   | Coordenador | Área |
   |---|---|
   | Sumindo — Coordenador Geral | **coringa**: nunca fica fora da área |
   | Antune — Coordenador Cultural | Cultura |
   | Luize — Coordenador de Infraestrutura | Estrutura |
   | Ryani — Coordenadora de Comunicação | Divulgação |
   | JV — Coordenador Financeiro | Logística e Vendas |

   Fora da área, o projeto leva **+1 rodada**. Esporte e Games não têm coordenador da área: só o Sumindo toca esses sem atraso.
   Cada coordenador pode ter até **2 cards em A fazer**.
4. **Iniciar = montar a equipe e pagar.** O responsável **trabalha no projeto** (força 1) e **toca um projeto por vez**.
   A força necessária é o tamanho do card + 3. Cada voluntário soma 1; **especialista na categoria soma 2** e dá
   R$ 10 de desconto. **Ninguém pode sobrar** na equipe (gente sobrando poderia estar em outro projeto).
   O botão *Sugerir equipe enxuta* ajuda, mas não escolhe por você.
5. **Encerrar a rodada.** Projetos com a força completa ganham 1 rodada de execução. Quem termina vai para **Revisão** e libera a equipe.
6. **Revisar.** **Outro** coordenador confere (ninguém revisa o próprio; cada um revisa 1 por rodada). Quem estava livre no
   começo da rodada revisa sem custo; quem está no meio de um projeto para, e o projeto dele **não anda** nessa rodada.
7. **Prazos.** O **farol do card** mostra a situação, como as datas dos quadros Kanban de verdade:
   **verde** = entregue no prazo, **amarelo** = no limite, **vermelho** = atrasado ou sem tempo.
   Card que não começa até o prazo **sai do quadro**. Entregue depois do prazo: **metade do retorno**, sem prestígio nem
   tradição, e não conta para a missão.
8. **Missões e pedidos.** Cada missão pede **4 dos 6 projetos dela concluídos no prazo** (fica aberta 4 rodadas).
   **2 pedidos avulsos** chegam no começo de cada rodada, com prazo curto: não dá para fazer tudo, escolha o que vale a pena.

**Dinheiro:** o custo é pago uma vez, ao iniciar; o retorno entra uma vez, ao concluir. *Retorno não é lucro* (lucro = retorno − custo).
O caixa nunca fica negativo; despesa obrigatória sem dinheiro vira perda de prestígio (−1 a cada R$ 10).

**Pontuação:** `caixa ÷ 10 + prestígio + tradição + 5 por projeto entregue no prazo`.

**Classificação (a meta):** o jogo calcula a meta **da sua partida**: o planejador do próprio jogo joga a mesma partida
(mesma agenda, mesmos pedidos) sem imprevistos. Aproveitamento = pontos que você conquistou ÷ pontos que ele conquistaria.
**100%+** GRÊMIO LENDÁRIO · **85%** DESTAQUE · **70%** APROVADO · **50%** SOBREVIVEU · abaixo: A DIREÇÃO QUER CONVERSAR.

---

## O que mudou na versão 2.0 (pedido → o que foi feito)

| Pedido | O que foi feito |
|---|---|
| "faça os coordenadores poderem trabalhar" | Todo card tem um **coordenador responsável** que trabalha nele e toca **um projeto por vez**. Cada um tem uma **área**: fora dela, +1 rodada. Sumindo é o coringa. Só coordenadores revisam (e nunca o próprio projeto). |
| "que necessite usar as pessoas, de forma inteligente, e acabe usando todos os personagens" | **Força de trabalho**: cada card exige força (tamanho + 3), especialista vale 2, ninguém pode sobrar, até **5 projetos ao mesmo tempo** (um por coordenador). Medido na simulação: o jogador bem organizado usa em média **16,8 das 17 pessoas fixas** numa partida rápida (todas em 34 de 40 partidas; todas sempre nas de 8 e 10 rodadas). Na versão 1.0 eram 5,3. A ocupação média subiu de **21% para 69%**. |
| "antes do jogo, opções de 4, 8, 10 e 26 rodadas" | Tela **Nova partida** com as 4 durações (e quantas missões cada uma tem) antes de escolher a missão. A escolha fica salva. |
| "projetos sendo criados durante o game" | **23 pedidos avulsos novos** (todas as categorias) chegam 2 por rodada, com prazo curto, e as **missões abrem ao longo da partida** nas durações maiores. |
| "aquele verde do Kanban normal" | Interpretado como o **selo de prazo dos quadros Kanban** (como no Trello): verde quando entregue no prazo, amarelo no limite, vermelho atrasado. Os cards também ganharam o jeito de quadro de verdade: etiquetas de categoria e de missão, responsável com foto, equipe, limite de trabalho por pessoa. |
| "pensar bem onde botar cada coordenador" | Janela **Quem vai tocar?** com a comparação dos 5 coordenadores e **faixa da coordenação** acima do quadro (quem está livre, tocando o quê, fila). Pôr coordenador ao acaso custa caro (ver simulação). |
| "alterações de meta" | Meta **por partida**, calculada pelo planejador do jogo na mesma partida; faixas recalibradas (100/85/70/50). |

### Mudanças de regra em relação à especificação e à versão 1.0 (e por quê)

| # | Antes | Agora | Por quê |
|---|---|---|---|
| 1 | Máximo de **2** projetos em andamento no quadro todo | **1 por coordenador** (até 5) + até 2 em *A fazer* por coordenador | Com limite 2, 21% da equipe trabalhava e só ~5 das 17 pessoas eram usadas: exatamente o problema relatado. O limite continua existindo, mas **por pessoa**, como nos quadros Kanban de equipes. |
| 2 | "Trabalhadores" = número de pessoas | **Força** = tamanho + 3; voluntário 1, especialista 2, responsável 1; sem sobra | Faz a escolha da equipe importar (especialista economiza gente e dinheiro) e obriga a usar todo mundo quando há 5 projetos rodando. |
| 3 | Qualquer coordenador livre revisava e ficava ocupado | Outro coordenador revisa (1 por rodada); quem para no meio de um projeto atrasa o próprio | Com coordenadores tocando projetos, revisar passou a ter custo real de oportunidade. |
| 4 | Sem prazos por card | Prazo em todo card; vencido sai do quadro; atrasado rende metade | Prazos são o que torna a priorização do Kanban uma decisão. |
| 5 | "Acabou o Chimarrão": só 1 card começa · "Semana de Provas": só 1 card se move | **Só 2** em cada | Com até 5 projetos simultâneos, "só 1" travava a rodada inteira. |
| 6 | Pontuação: 5 por projeto **concluído** | 5 por projeto **entregue no prazo** | Coerente com os prazos. |
| 7 | Classificação 100 / 80 / 60 / 40 sobre a meta da missão | 100 / 85 / 70 / 50 sobre a meta **da partida** | Na simulação, quem faz o fluxo certo mas põe coordenador e equipe ao acaso fica em 54–66%: com as faixas antigas isso era APROVADO. Agora é SOBREVIVEU, e escolher bem passa de 85%. |
| 8 | Baralho com regras para 4 rodadas | Mesmas regras em blocos de 4 rodadas (≥1 positivo, ≤1 severo por bloco, nunca severo na rodada 1, sem repetir em rodadas seguidas) | Funciona para 4, 8, 10 e 26 rodadas. |
| 9 | Caixa inicial R$ 500 | **Mantido** | Ver "Dinheiro" nas limitações. |

Partidas salvas pela versão 1.0 são descartadas ao abrir a 2.0 (o jogo avisa): as regras mudaram.

---

## Estrutura

```
index.html               página única; a ordem dos <script> é a ordem de carregamento
css/estilo.css           visual (roxo Mesquita, painéis brancos), responsivo de 320 a 1920 px
js/dados/                personagens (áreas e especialidades), projetos e pedidos, missões, eventos
js/nucleo/               regras do jogo, sem nada de interface:
  regras.js                todos os números (durações, força, limites, caixa, faixas)
  estado.js                leitura do estado: recursos, força, área, farol do prazo, quem está livre
  agenda.js                agenda de missões e pedidos (sorteio próprio, vem da semente da partida)
  kanban.js                planejar, trocar responsável, iniciar, revisar, completar equipe, mutirão
  financas.js              livro-caixa, custos, descontos, despesas
  eventos.js               baralho, efeitos imediatos e de fim de rodada
  rodada.js                fim de rodada: execução, prazos, missões, passagem de rodada
  planejador.js            o "Grêmio bem organizado": calcula a meta e as sugestões
  pontuacao.js             pontuação, meta, resumo financeiro
  motor.js                 ponto único de entrada: OG.motor.aplicar(estado, ação)
  persistencia.js          salvar/carregar com validação completa
js/interface/            telas, janelas, arrastar e soltar, teclado
tests/                   testes do núcleo, fuzzing, simulação e teste de interface (Playwright)
tools/                   preparar publicação (public/), servidor local, arquivo único
```

Toda regra mora no **núcleo**. A interface só pergunta ao núcleo se pode e mostra o motivo quando não pode.
Uma ação inválida devolve o estado intacto e uma mensagem.

---

## Testes

```bash
npm test                          # núcleo, fuzzing, simulações de design e publicação (Node 18+, sem instalar nada)
npm run simular                   # simulação de balanceamento em todas as durações
npm run test:e2e                  # interface no navegador (precisa do Playwright); inclui 1 partida de 26 rodadas
E2E_RAPIDO=1 npm run test:e2e     # o mesmo, sem a partida de 26 rodadas
```

Para o teste de interface: `npm install --no-save playwright && npx playwright install chromium`.

### O que foi executado nesta entrega

- **`npm test`: 127 testes, todos passando** (Node 22). Entre eles:
  - regras do Kanban, responsável, fila de 2, um projeto por coordenador, força, equipe sem sobra, área (+1 rodada),
    revisão (1 por coordenador, ninguém revisa o próprio, pausa de quem para no meio), prazos (vencido sai, atraso
    rende metade), cada um dos 20 eventos, agenda e pedidos nas 4 durações, pontuação e meta;
  - **persistência**: salvar e carregar em **cada passo** de partidas inteiras; **43 tipos de estado adulterado**
    recusados, cada um pelo motivo certo (custo cobrado duas vezes, retorno pago duas vezes, efeito de evento repetido,
    coordenador tocando dois projetos, pessoa em duas equipes, prazo esticado, agenda adulterada…); partida da 1.0 reconhecida;
  - **fuzzing**: 23 mil ações aleatórias (válidas, inválidas, repetidas, fora de hora) em 92 partidas de 4, 8, 10 e 26
    rodadas; depois de **cada** ação conferimos caixa ≥ 0, um projeto por coordenador, ninguém em duas equipes, coordenador
    fora de equipe, custo e retorno no máximo uma vez **por card** e estado válido;
  - **design**: o planejador passa de 85% de aproveitamento; pôr coordenador ao acaso perde mais de 15 pontos;
    jogar sem pensar fica abaixo de 70%; não fazer nada dá A DIREÇÃO QUER CONVERSAR; os 5 coordenadores trabalham;
    toda missão é possível na partida rápida; caixa apertado continua jogável.
- **19 casos de interface no Chromium (Playwright), todos passando**: partidas completas **clicando** em 4, 4, 8, 10 e
  **26 rodadas** (conferindo a cada passo se caixa, prestígio, tradição, rodada e cards na tela batem com o estado real e se
  o estado continua válido); escolha de duração salva e configuração estragada ignorada; partida "parada";
  arrastar e soltar; coordenador ocupado bloqueado com explicação; equipe que não deixa sobrar gente; recarregar no meio
  da rodada; nova partida durante um evento; só teclado; celular 390×844 jogando até o fim; tablet 900×1100;
  **10 larguras de 320 a 1920 px sem rolagem lateral**; caixa apertado; salvo adulterado e salvo da 1.0; console sem erros.
  Os 18 casos do modo rápido também passam no **arquivo único** e na pasta que o **Vercel** gera.
- **Vercel CLI 65.4.0** (local, numa cópia limpa): `vercel build` → *Build completed successfully*, com `index.html`, `css`, `js` e `assets`.
- **Site no ar** (28/10/2026, commit `494268d`): os **31 arquivos** servidos em produção têm o **mesmo SHA-1** do build local
  testado, conferido num navegador real. `package.json`, `README.md`, `vercel.json`, `tools/` e `tests/` não são publicados (404).

### Simulação (`npm run simular`, 40 partidas por duração e perfil; 10 nas de 26 rodadas)

Aproveitamento médio de cada perfil de jogador automático:

| Perfil | 4 rodadas | 8 | 10 | 26 |
|---|---|---|---|---|
| Planejador (bem organizado, com imprevistos) | 97% | 96% | 98% | 94% |
| Coordenador recomendado + equipe enxuta, sem priorizar cards | 86% | 85% | 82% | 72% |
| Equipe ao acaso (coordenador bom) | 79% | 76% | 74% | 64% |
| Coordenador ao acaso (equipe boa) | 66% | 64% | 63% | 56% |
| Coordenador, equipe e card ao acaso | 60% | 60% | 57% | 54% |
| Descuidado (esquece revisões, começa o que não cabe) | 31% | 26% | 26% | 21% |
| Parado | 1% | 1% | 1% | 1% |

- **Gente usada** (planejador): os 5 coordenadores em toda partida; 16,8 das 17 pessoas fixas em média na partida rápida e todas nas de 8, 10 e 26 rodadas; ocupação média de 69% (4 rodadas) a 85% (26).
  Cada coordenador trabalha em 78–98% das rodadas; cada voluntário em 54–89%.
- **Missões**: o planejador cumpre 98–100% em todas as missões de abertura na partida rápida; 99–100% nas longas.
  Jogando sem pensar: 41–83%.
- **Eventos**: nenhum evento isolado derruba a missão; o pior (Semana de Provas) tira ~7 pontos de aproveitamento.
  Só eventos negativos: 85–87%. Só positivos: 110–111%.
- **Classificação do planejador**: Lendário 33–43% e Destaque 48–65% nas partidas de até 10 rodadas; Destaque nas de 26.

---

## Limitações conhecidas (sem esconder nada)

- **Dinheiro raramente aperta com R$ 500**: o menor caixa do planejador fica em R$ 170. O gargalo do jogo agora é
  **gente** (coordenadores e especialistas), e o dinheiro vale pontos (34–39% da pontuação), descontos e as decisões de
  pagar ou não as despesas dos eventos. Quem quiser pressão financeira de verdade liga o **Caixa apertado (R$ 200)**
  em *Configurações*: aí o caixa chega a zero e o planejador continua conseguindo jogar (94–97% de aproveitamento).
- Os tempos (≈ 20 min, 40 min, 50 min, 2 h) são **estimativas**: o jogador bem organizado faz cerca de 10 ações por rodada,
  mas não foi cronometrado com alunos. A partida de 26 rodadas é longa: ela fica salva e dá para continuar depois.
- A meta é calculada pelo **planejador do jogo**, que é bom mas não é perfeito: dá para passar de 100% (GRÊMIO LENDÁRIO).
- **Patrício** (só com evento) e os eventos de desconto pesam pouco na pontuação: são mais tempero que estratégia.
- **Arrastar e soltar não funciona com o dedo** (limitação do arrastar nativo dos navegadores). No toque, os botões
  dos cards fazem exatamente o mesmo.
- Testado automaticamente só no **Chromium** (Chrome/Edge). Safari, Firefox e celulares reais não foram testados.
- O balanceamento foi validado com **jogadores simulados**. Vale uma partida de teste com a turma antes de apresentar.
- A **foto do JV** não veio no arquivo: aparecem as iniciais. Para usar uma foto, coloque `jv.png` em `assets/personagens/`
  e troque `foto: null` por `foto: 'assets/personagens/jv.png'` em `js/dados/personagens.js`.
- Leitores de tela (NVDA, VoiceOver) não foram testados de verdade; a navegação por teclado foi.
- A partida fica salva **neste navegador**. Em janela anônima pode não salvar (o jogo avisa).

## Para mexer no jogo

- Números gerais (durações, força, limites, caixa, faixas): `js/nucleo/regras.js`
- Cards e pedidos: `js/dados/projetos.js` · Missões: `js/dados/missoes.js` · Eventos: `js/dados/eventos.js` · Personagens e áreas: `js/dados/personagens.js`
- Depois de mudar valores, rode `npm test` e `npm run simular`. Se mudar alguma regra, aumente `VERSAO_ESTADO` em `regras.js`
  (partidas salvas com as regras antigas passam a ser descartadas com aviso, em vez de carregar errado).

## Créditos

- Ideia, retratos da coordenação e identidade visual: Grêmio da Escola Técnica Mesquita.
- Fonte **Archivo** (Omnibus-Type), licença SIL Open Font License 1.1 (`assets/fontes/LICENCA-Archivo-OFL.txt`).
- Ícones de **Lucide** (lucide.dev), licença ISC. Os ícones da cuia de chimarrão e da mesa foram desenhados para o jogo.
