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
src/dominio/    feriados.js, calendario.js, contrato.js, medicao.js, prazos.js, caixa.js, mei.js
src/storage/    migracoes.js, repositorio.js, backup.js, exemplo.js (seed fictício)
src/ui/         app.js (rotas, eventos, salvamento, dicas), util.js, graficos.js, views/{painel,pj,caixa,ajustes}.js
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
- 2026-10-13: **Tema rubro-negro pastel** (pedido do usuário, torcedor do Athletico): carmim `#b83a42`/rosa pastel
  `#f9e1e2` no claro, vermelho pastel `#f0868c` sobre preto no escuro; destaque em gradiente preto→vinho com listras sutis.
  O verde foi rejeitado. Alerta (`--perigo`) é um vermelho mais vivo e sempre vem com ícone + texto.
  Séries dos gráficos validadas com o validador de paleta: azul-aço `#3e649e`/`#5f86c4` e vermelho `#d0505a`/`#e0545c`.
- 2026-10-13: Visual moderno pedido pelo usuário: grade bento, destaque com gradiente, cores com `oklch`/`color-mix`,
  cabeçalho translúcido, abas embaixo no celular, tema claro/escuro/automático.

- 2026-10-13: **Caixa (F2):** saldo informado vale no fim do dia `caixa.saldoEm` (editar um saldo atualiza a data para hoje);
  só entram fluxos depois dela. Recebimento entra na data de pagamento (real ou prevista); competência em andamento usa
  os dias previstos. DAS e gastos fixos contam como pagos no vencimento. Reserva mínima padrão R$ 1.000 e horizonte
  mar/2027, editáveis. Simulador muda prazo (15/30/45) e dias/semana (2 = primeiros 2 dias do contrato) só para dias futuros.
- 2026-10-13: **Gráficos:** SVG próprio (`src/ui/graficos.js`), cores validadas (azul-aço =
  competência, vermelho = caixa), linha do saldo em preto/branco, abaixo da reserva = vermelho + ícone; tabela sempre
  disponível; largura lógica menor no celular.

## Premissas a confirmar com o usuário/contador

- Faturamento MEI conta pelo valor da NF (R$ 200/dia, incluindo deslocamento).
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
