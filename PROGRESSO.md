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

- Instalar o Node LTS para rodar `npm test` (os testes também rodam em `tests/index.html`).
- Nº do pedido de compra, e-mail de envio da NF e prazo real de pagamento do tomador.
- Saldo atual das contas e gastos fixos (aluguel etc.) — sem eles a projeção parte de R$ 0 e só mostra o PJ e o DAS.

## Registro

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
