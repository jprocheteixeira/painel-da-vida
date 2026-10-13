# PROGRESSO — Painel da Vida

## Fases

- [x] **F1** — estrutura, dados (localStorage versionado + migrações + backup), módulo PJ: calendário,
  boletim, estados, datas e texto da NFS-e; painel inicial básico; ajustes (perfil, contrato, feriados, dados).
- [x] **F2** — contas, gastos fixos, competência × caixa (gráfico), projeção até mar/2027 com reserva mínima, simulador "e se" (prazo 15/30/45 × 2/3 dias).
- [ ] **F3** — gastos (lançamento rápido, categorias, recorrentes/parcelados, resumo e gráficos).
- [ ] **F4** — MEI (DAS, limite proporcional, DASN-SIMEI), agenda de prazos (+ .ics) e metas.
- [ ] **F5** — polimento, acessibilidade, README completo.

## Pendências do usuário

- Instalar o Node LTS para rodar `npm test` (os testes também rodam em `tests/index.html`).
- Nº do pedido de compra, e-mail de envio da NF e prazo real de pagamento do tomador.
- Saldo atual das contas e gastos fixos (aluguel etc.) — sem eles a projeção parte de R$ 0 e só mostra o PJ e o DAS.

## Registro

### 13/10/2026 — PC de casa
- Projeto criado. F1 concluída e verificada no navegador (desktop e celular, claro e escuro). 26/26 testes passando
  (rodados no navegador: Node ainda não instalado).
- Contrato começa em 13/10 (terça, já trabalhado), ter–qui; perfil privado atualizado (78 dias = R$ 15.600).
- F2 concluída: tela Caixa, gráficos SVG próprios com dica, schema v2 (contas, recorrencias, caixa, mei). 33/33 testes.
