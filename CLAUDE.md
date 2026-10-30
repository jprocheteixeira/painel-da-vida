# CLAUDE.md — Painel da Vida

Contexto permanente do projeto. O histórico de conversas com o Claude não passa de um computador
para outro (PC de casa ↔ PC da empresa), então o que importa fica aqui e no [PROGRESSO.md](PROGRESSO.md).

## Objetivo

App web pessoal para organizar **dinheiro, trabalho como PJ (MEI) e prazos**.
Interface em português do Brasil. Usado no PC de casa, no PC da empresa e no celular, pelo GitHub Pages.

O contexto pessoal (quem é o usuário, contrato, valores) fica em `privado/contexto.md`, **fora do Git**,
porque este repositório é público. Ler esse arquivo no início da sessão, se existir neste PC.

## Regras que não mudam

- **Nenhum dado pessoal real no Git.** O repositório é **público** (GitHub Pages grátis). Dados reais vivem só
  no localStorage de cada aparelho e em `privado/` (ignorado). O perfil real está em `privado/meu-perfil.json`,
  que se importa pelo botão "Importar backup".
- HTML + CSS + JS puro com ES modules, sem build e sem backend. Não abre por `file://` (módulos são bloqueados):
  usar o Pages ou `python -m http.server`.
- Dinheiro sempre em **centavos inteiros**. Datas como texto ISO `aaaa-mm-dd`; "hoje" no fuso America/Sao_Paulo.
- Sem dependências externas (sem CDN, sem fontes da web); gráficos em SVG próprio.
- Domínio puro em `src/dominio/` (sem DOM), testado em `tests/` com `node --test`.
  Os mesmos testes rodam no navegador em `tests/index.html` (import map troca `node:test`/`node:assert`).
- Textos vindos dos dados passam por `escapar()`/`html```.
- Não inventar regra fiscal: o que depende de regra oficial vira parâmetro editável, com a premissa citada.
- Mudou o formato dos dados? Incrementar `VERSAO_ATUAL` e acrescentar uma migração em `src/storage/migracoes.js`.

## Estrutura

```
index.html · css/estilo.css · package.json
src/utils/      datas.js, dinheiro.js
src/dominio/    feriados.js, calendario.js, contrato.js, oc.js, medicao.js, prazos.js, caixa.js, mei.js, gastos.js, agenda.js, pendencias.js, assistente.js
src/storage/    migracoes.js, repositorio.js, backup.js, exemplo.js (seed fictício)
src/ui/         app.js (rotas, eventos, salvamento, dicas), util.js, graficos.js, views/{painel,pj,caixa,gastos,ajustes}.js
tests/          *.test.js (node --test) + index.html e navegador/ (rodar no navegador)
privado/        (fora do Git) meu-perfil.json
```

## Decisões

- 2026-10-13: **ES modules + GitHub Pages** (repo público, sem dados pessoais) para funcionar nos 3 aparelhos.
  Sincronização entre aparelhos = backup JSON manual (lembrete a cada 30 dias).
- 2026-10-13: **Feriados:** nacionais de 2026/2027 + **09/12 (aniversário de Guarapuava, municipal)**, conforme
  calendário do TJPR. 19/12 (Emancipação do PR) **não** é feriado (Lei estadual 18.384/2014). Carnaval e
  Corpus Christi entram como ponto facultativo, **desligados**. Lista editável em Ajustes. O usuário avisa as exceções.
- 2026-10-13: **Dias de trabalho:** marcação por dia (`marcas`: trabalhado | folga). O clique cicla
  vazio → trabalhado → folga (só em dia sugerido) → vazio. Previstos = trabalhados + sugeridos de hoje em diante.
- 2026-10-13: **Datas da medição:** boletim até o último dia útil do mês; aprovação até o 5º dia útil do mês
  seguinte (dias úteis = seg–sex sem feriados ativos); emissão prevista da NF = data da aprovação (real ou prazo);
  pagamento = emissão + prazo em dias **corridos**, passando para o próximo dia útil.
- 2026-10-13: Competência = mês inteiro (dia de corte 0); dia de corte N é suportado (do dia N+1 ao dia N).
- 2026-10-13: A estimativa do contrato usa os dias sugeridos já sem feriados (um feriado municipal numa quarta
  tira um dia em relação a uma conta simples de semanas × dias).
- 2026-10-13: **Cores (decisão final do usuário):** fundo rosado `#f8f4f3` com brilho vermelho no claro e preto `#121011`
  no escuro (o usuário gostou e quer manter); cartões, botões e destaque **neutros** (preto/grafite).
  **Cor só com significado: vermelho = ruim (`--perigo`), verde = bom (`--positivo`)** — saldo abaixo/acima da reserva,
  prazo atrasado, etapas concluídas, pago. Verde nunca como cor de marca (é a cor do rival). Logo preto com traço vermelho.
  Séries dos gráficos (neutras, validadas no validador de paleta): azul-aço `#3e649e`/`#5f86c4` = trabalhado e
  dourado `#c08a1e`/`#ad7a1a` = entra na conta. Pontos do saldo: verde acima da reserva, vermelho abaixo.
- 2026-10-13: Visual moderno pedido pelo usuário: grade bento, destaque com gradiente, cores com `oklch`/`color-mix`,
  cabeçalho translúcido, abas embaixo no celular, tema claro/escuro/automático.

- 2026-10-13: **Caixa (F2):** saldo informado vale no fim do dia `caixa.saldoEm` (editar um saldo atualiza a data para hoje);
  só entram fluxos depois dela. Recebimento entra na data de pagamento (real ou prevista); competência em andamento usa
  os dias previstos. DAS e gastos fixos contam como pagos no vencimento. Reserva mínima padrão R$ 1.000 e horizonte
  mar/2027, editáveis. Simulador muda prazo (15/30/45) e dias/semana (2 = primeiros 2 dias do contrato) só para dias futuros.
- 2026-10-13: **Gráficos:** SVG próprio (`src/ui/graficos.js`), cores validadas (azul-aço =
  competência, dourado = caixa), linha do saldo em preto/branco, abaixo da reserva = vermelho + ícone; tabela sempre
  disponível; largura lógica menor no celular.

- 2026-10-13: **Gastos (F3):** valores de gasto guardados positivos. Fixos (`recorrencias`) e parcelados (`parcelamentos`)
  não são gravados mês a mês: as ocorrências são calculadas da regra. Categoria apagada → gastos vão para "Outros".
  **Estimativa mensal** (`estimativas`, itens prontos que o usuário preenche ou exclui) é um PISO do mês na projeção:
  entra só a diferença entre a estimativa e o que já se conhece do mês (lançados + fixos + parcelas). Atalho N = lançar gasto.
  Resumo por categoria em barras horizontais (sem pizza: 10 categorias passariam do limite de cores distinguíveis e
  vermelho/verde são reservados para ruim/bom); barra vermelha só quando passa do orçamento.

- 2026-10-13: **DAS (pedido do usuário):** entra sozinho em Gastos (categoria "Impostos (MEI)", schema v4) no mês do
  vencimento ou do pagamento; não desconta da estimativa mensal. Lembrete no Painel ("Próximos 14 dias") com botão
  "Paguei" (`dasPagos`), desfazer em Gastos. **Data do lembrete = último dia útil até o dia 20** (conservador, para não
  depender da regra de prorrogação). Botão "Pôr na agenda" baixa um .ics (DAS até o horizonte + próxima etapa do PJ),
  eventos de dia inteiro com aviso na véspera e no dia às 9h, UID fixo para não duplicar ao reimportar.
- A ferramenta de pré-visualização desta sessão ainda lê o `.claude/launch.json` da pasta do HMI: para testar o Painel,
  pôr a configuração "painel-da-vida" lá temporariamente e tirar depois (o arquivo é local e ignorado pelo Git).

- 2026-10-13: **DAS pago por outra pessoa** (`dasTerceiros`, schema v5): o 1º DAS (out/2026) será pago com dinheiro do pai.
  Escolhido em Caixa → "DAS do MEI" → "Quem paga". Sai dos gastos e do saldo; o Painel lembra de pedir o dinheiro
  7 dias antes do prazo ("Já pedi") e de pagar ("Paguei"). Tudo vai também para o .ics.
- 2026-10-13: **Backup** lembrado no **último dia útil de cada mês** (junto com o boletim), escolha do usuário; aparece em
  "Próximos 14 dias" e no .ics. O app pede `navigator.storage.persist()` para o navegador não limpar os dados sozinho.
- 2026-10-13: Usuário sem gastos próprios até receber (1º item da OC: entre 15 e 21/12); depois vai assumir gastos que hoje são da mãe.
  Projeção recomendada até jun/2027 (último item da OC é pago por volta de 17–20/05/2027).

- 2026-10-30: **Ordem de Compra (schema v6)** substitui a cobrança por dia. A OC tem itens mensais de **valor fixo**
  (`contrato.itensOC`: n, data de despacho, valor; gerados em Ajustes). Mês do item = mês do despacho; período do item =
  dia seguinte ao despacho anterior até o despacho (o 1º começa no início do contrato, 13/10, mesmo com a OC de 15/10).
  **Marcar dias é opcional** (só boletim/relatório e aviso de 3 dias presenciais por semana). **NFS-e só do dia 15 ao 20**
  do mês do item (do 21 em diante é recusada; perdeu → janela do mês seguinte, alerta vermelho); uma nota por item.
  Descrição: "OC [nº] – Item [n] – [código do item] – [descrição] – Mês [n]". Pagamento **30 DDL** + próximo dia útil,
  por DDA ou depósito (sem factoring). Previsão usa emissão no dia 20 (conservador) e mostra o intervalo (dia 15–20).
  Lembretes nos dias 15, 18 e 20; tarefa "Enviar aceite da OC" com texto pronto; checklist de pendências no Painel.
  **Nº da OC, código do item, CNPJ do tomador e e-mails do DANFSE/XML só no app** (nunca no repositório).
  Suposições minhas: boletim até o último dia útil até o despacho; aprovação até o dia 18. Migração v5→v6: pedidoCompra →
  numeroOC, emailEnvio → emailDanfse, prazo 30, medição da competência M → mês do item M+1.

- 2026-10-30: **Botão "?" (assistente):** perguntas prontas respondidas com os dados do aparelho (`assistente.js`, sem
  internet) + "Perguntar ao Claude": copia um resumo (sem CNPJ, e-mails nem nº da OC) e abre claude.ai. Chat de verdade
  dentro do app exigiria chave paga da API: não feito. Prazos importantes também estão no Google Agenda do usuário
  (criados pela sessão; não usar "Pôr na agenda" do app para não duplicar). Aceite da OC já confirmado pelo WhatsApp.

## Premissas a confirmar com o usuário/contador

- Faturamento MEI conta pelo valor da NF (valor fixo de cada item da OC).
- Base de contagem dos 30 DDL (emissão, entrada da NF ou fim do mês): não está na OC; padrão "emissão", a confirmar com Compras.
- Código do serviço da NFS-e combina com o CNAE do MEI (contador).
- DAS da competência M vence em 20/M+1 (1º DAS: outubro/2026, vence 20/11/2026), R$ 86,05.
- Limite proporcional no ano de abertura: R$ 6.750 × meses desde o mês de abertura (inclusive) → 2026 = R$ 20.250.

## Dependências por computador

| Item | PC de casa | PC da empresa |
|------|-----------|---------------|
| Node (para `npm test`) | a instalar (`winget install OpenJS.NodeJS.LTS`) | ? |
| Python (servidor local) | 3.13 | instalado |

## Regras de sessão

- No início: `git status`, `git log origin/main..HEAD`, depois `git pull`; ler CLAUDE.md e PROGRESSO.md e dizer onde paramos.
- Lembrar o usuário de dizer **"encerrar"** no fim do dia: atualizar PROGRESSO.md (e CLAUDE.md se algo mudou),
  commit, push e confirmar o push.
