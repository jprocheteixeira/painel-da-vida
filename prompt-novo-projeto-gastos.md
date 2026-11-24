# Prompt para começar o projeto novo (colar na 1ª mensagem de uma sessão nova do Claude Code)

Quero criar do zero um app pessoal de **controle financeiro diário**, em português do Brasil, usado no celular e em
dois PCs (casa e empresa). Antes de escrever código, me faça as perguntas que faltarem (abaixo tem uma lista) e me
proponha a arquitetura em poucas linhas para eu aprovar.

## O que eu quero ver, todo dia

- Quanto gastei hoje, na semana e no mês, e o que sobra até o fim do mês.
- Gastos por categoria. **Categorias como opções para eu ligar/desligar** (venha com uma lista pronta, eu escolho
  as que uso e posso criar outras): Mercado, Gasolina, Alimentação fora (restaurante/lanche), Delivery (iFood etc.),
  Transporte (Uber/ônibus/estacionamento), Manutenção do carro, Contas da casa (luz, água, gás), Celular e internet,
  Assinaturas (streaming, apps), Saúde e farmácia, Academia/esporte, Roupas, Cuidados pessoais, Lazer e saídas,
  Viagem, Presentes, Educação/cursos, Casa e utensílios, Pets, Trabalho/MEI, Ajuda à família, Outros.
- Orçamento mensal por categoria **opcional**: ainda não sei meus limites. Depois de 1–2 meses de uso, o app sugere
  um limite com base na média do que eu gastei.
- O que tenho que pagar e quando: contas fixas, faturas de cartão, parcelas, boletos, impostos. Lembrete antes do
  vencimento e botão "Paguei".
- Fatura do cartão em aberto: quanto já gastei no cartão neste ciclo e quando vence. Dia de fechamento e de
  vencimento são configuração no app (eu informo na hora; não gravar no repositório). Compra feita depois do
  fechamento vai para a fatura seguinte.
- Contas fixas: hoje não tenho nenhuma. Venha com **exemplos desligados** para eu preencher se surgirem (celular,
  internet, academia, streaming, aluguel, seguro do carro, IPVA, licenciamento). Também não tenho parcelas agora,
  mas o app precisa aceitar compra parcelada no cartão (parcela X de N em cada fatura).
- **Gastos de outra pessoa:** talvez eu assuma contas que hoje são da minha mãe, ainda não sei como. Cada lançamento
  e conta deve poder ter um campo opcional "para quem" (eu / família), com o resumo separando os dois.
- Perguntas rápidas: "quanto gastei com mercado em novembro?", "quanto com gasolina nos últimos 30 dias?".

## O mais importante: lançamento quase automático, sem importar extrato no fim do mês

Banco que uso: **Nubank** (conta e cartão de crédito). Celular: **Android**. O Nubank me avisa cada compra e Pix por
**notificação no celular**; não sei se também manda e-mail.
Sei que PicPay e os outros bancos não têm API para pessoa física, e que o Open Finance só é aberto para empresas
autorizadas pelo Banco Central. Então quero combinar estes caminhos, nesta ordem:

1. **Notificações do Nubank no celular (caminho principal):** o MacroDroid (ou Tasker) lê a notificação de compra/Pix do
   app do banco e envia por HTTP para o meu "backend" (passo 4). O app transforma o texto em lançamento (valor,
   estabelecimento, data, conta/cartão) com regras de leitura por banco e testes com exemplos reais de notificação.
2. **E-mails de compra (só se o Nubank mandar):** um Google Apps Script com gatilho de tempo lê os e-mails de aviso
   de compra no Gmail (por rótulo/remetente), extrai os dados e grava. Verificar comigo se esses e-mails existem.
3. **Lançamento manual em 3 segundos:** tela de "novo gasto" que abre direto pelo atalho na tela inicial do celular,
   com valor, categoria sugerida e pronto.
4. **Depois, se valer a pena:** Open Finance por um agregador (Pluggy/Belvo — verificar se existe plano gratuito para
   uso pessoal, ex. "Meu Pluggy") para conferir saldo e lançamentos que escaparem.

**Categorização automática:** regras por estabelecimento que aprendem com as minhas correções (marquei "Posto X" como
Gasolina uma vez → os próximos já vêm como Gasolina). Lançamento sem categoria fica numa caixa "a revisar".
**Sem duplicar:** a mesma compra pode chegar pela notificação e pelo e-mail — deduplicar por valor + data/hora
aproximada + estabelecimento, e me perguntar quando houver dúvida.

## Arquitetura sugerida (pode propor outra, mas justifique)

- **Dados:** uma planilha Google Sheets na minha conta (privada, grátis, abre nos 3 aparelhos, e o Claude consegue ler
  pelo conector do Google Sheets para eu fazer perguntas). Abas: lancamentos, contas_a_pagar, categorias, regras.
- **Backend:** Google Apps Script publicado como app da web (`doPost`/`doGet`), protegido por um token secreto
  que fica só no celular/navegador, **nunca no repositório**. Recebe as notificações do MacroDroid e lê o Gmail.
- **Interface:** PWA em HTML + CSS + JS puro (ES modules, sem build, sem dependências externas, gráficos em SVG
  próprio), instalável no celular. Se o repositório for público (GitHub Pages grátis), o código não pode ter
  nenhum dado pessoal; os dados vêm só da planilha. Alternativa: servir a interface pelo próprio Apps Script.
- Dinheiro sempre em centavos inteiros; datas ISO `aaaa-mm-dd`; fuso America/Sao_Paulo.
- Domínio puro (leitura de notificações/e-mails, categorização, deduplicação, vencimentos, totais) testado com
  `node --test`.

## Regras do projeto

- Nenhum dado pessoal real no Git (nem token, nem e-mail, nem número de conta/cartão). Segredos e exemplos reais
  ficam numa pasta `privado/` no `.gitignore`.
- Não inventar regra de banco/fiscal: o que depender disso vira configuração editável.
- Criar um `CLAUDE.md` (contexto permanente, decisões) e um `PROGRESSO.md` (fases, pendências, registro), porque
  troco de computador e o histórico das conversas não vai junto. No fim do dia, quando eu disser "encerrar":
  atualizar os dois, commit, push e confirmar.
- Entregar em fases pequenas, cada uma funcionando: F1 planilha + Apps Script + lançamento manual + tela "hoje/mês";
  F2 notificações do Nubank pelo MacroDroid + categorização; F3 contas a pagar + lembretes + fatura do
  cartão; F4 gráficos por categoria e orçamento; F5 Open Finance (opcional).
- Me guiar passo a passo nas partes fora do código (criar a planilha, publicar o Apps Script, configurar o
  MacroDroid), com textos curtos e diretos.

## Perguntas para me fazer antes de começar

- Me pedir exemplos reais das notificações do Nubank (compra no crédito, débito, Pix enviado/recebido, estorno) para
  montar as regras de leitura — com valores e nomes trocados se forem para o repositório.
- Dia de fechamento e de vencimento da fatura do Nubank; contas fixas e parcelas (esses valores ficam fora do Git).
- Repositório: se eu não decidir, usar **público** (Pages grátis), com zero dado pessoal no código.
- Integração com o meu outro projeto, o "Painel da Vida" (app de PJ/MEI, prazos e projeção de caixa, também HTML/JS
  puro com dados no localStorage): ainda não decidi. Deixar uma **exportação em JSON/CSV** dos lançamentos por
  categoria e mês, com formato documentado, para o Painel poder importar ou ler depois. Não construir a integração
  agora.
