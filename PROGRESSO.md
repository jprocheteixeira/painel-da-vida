# PROGRESSO — Painel da Vida

## Fases

- [x] **F1** — estrutura, dados (localStorage versionado + migrações + backup), módulo PJ: calendário,
  boletim, estados, datas e texto da NFS-e; painel inicial básico; ajustes (perfil, contrato, feriados, dados).
- [x] **F2** — contas, gastos fixos, competência × caixa (gráfico), projeção até mar/2027 com reserva mínima, simulador "e se" (prazo 15/30/45 × 2/3 dias).
- [x] **F3** — gastos: lançamento rápido (tecla N), categorias com orçamento, fixos e parcelados, estimativa mensal
  editável (itens prontos, excluir o que não tem), resumo por categoria × mês anterior × orçamento. Falta: importar CSV.
- [ ] **F4** — caixinhas/sonhos (reserva de emergência, investir, celular, carro, viagem… cada uma com meta, prazo e
  quanto guardar por mês; excluir as que não quer), MEI (DAS, limite proporcional, DASN-SIMEI), agenda (+ .ics).
- [ ] **F5** — polimento, acessibilidade, README completo.

## Pendências do usuário

- Resolvidas (Ordem de Compra): nº da OC, e-mails de envio da nota, CNPJ do tomador, prazo (30 DDL), valor fixo mensal.
  Digitar no app: itens da OC (Ajustes), nº da OC, código do item, CNPJ e e-mails (Trabalho PJ → Nota fiscal).
- Confirmar com Compras a base de contagem dos 30 dias (e se os dias 13 e 14/10 estão cobertos pela OC).
- Aceite da OC: confirmado com Compras pelo WhatsApp (marcar "Enviei" no app).
- Saldo atual das contas e gastos fixos — sem eles a projeção parte de R$ 0.
- Contador: faturamento MEI pelo valor da NF, DAS no dia 20, limite de R$ 20.250 em 2026; código do serviço × CNAE do MEI.
- Instalar o Node LTS para rodar `npm test` (os testes também rodam em `tests/index.html`).

## Registro

### 30/10/2026 — sessão na nuvem
- Ordem de Compra (schema v6): itens mensais de valor fixo, janela da NFS-e 15–20 (recusa depois do dia 20, alerta de
  janela perdida), uma nota por item, descrição no formato da OC, e-mails do DANFSE e do XML, pagamento 30 DDL com base
  de contagem editável (a confirmar), projeção dos 6 recebimentos com intervalo, simulador dia de emissão × prazo × base,
  lembretes 15/18/20, tarefa de aceite com texto pronto, checklist de pendências. Marcar dias virou opcional.
  `npm test` corrigido para o Node 22. 57/57 testes (Node e navegador).
- Depois: salvar ao fechar o app, campos da nota também em Ajustes, CNPJ só com números, pendências apontam onde
  preencher, botão "?" com perguntas prontas e "Perguntar ao Claude". Datas no Google Agenda (aceite removido; aviso de
  preparação da 1ª NFS-e em 09/11). 63/63 testes.
- Olhinho para esconder os valores (como no Nubank). 64/64 testes.

### 13/10/2026 — PC de casa
- Projeto criado. F1 concluída e verificada no navegador (desktop e celular, claro e escuro). 26/26 testes passando
  (rodados no navegador: Node ainda não instalado).
- Cores revistas: fundo rosado/preto mantido, cartões neutros, vermelho = ruim e verde = bom.
- F3 concluída (schema v3). 40/40 testes. Conversa movida para a pasta painel-da-vida.
- Estimativa mensal com campo de adicionar e sugestões; DAS automático em Gastos + lembrete no Painel + exportar
  prazos para a agenda (.ics). Schema v4. 45/45 testes.
- App instalável (manifest, ícones, service worker); usuário instalou no celular e preencheu contrato e perfil à mão
  (importar o JSON pelo WhatsApp não funcionou). DAS pago por terceiro (pai), cartão DAS no Caixa, backup no último
  dia útil do mês. Schema v5. 46/46 testes.
- Contrato começa em 13/10 (terça, já trabalhado), ter–qui; perfil privado atualizado (77 dias = R$ 15.400: ganha 13/10, perde 13/04/2027).
- F2 concluída: tela Caixa, gráficos SVG próprios com dica, schema v2 (contas, recorrencias, caixa, mei). 33/33 testes.
