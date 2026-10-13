# PROGRESSO — Painel da Vida

## Fases

- [x] **F1** — estrutura, dados (localStorage versionado + migrações + backup), módulo PJ: calendário,
  boletim, estados, datas e texto da NFS-e; painel inicial básico; ajustes (perfil, contrato, feriados, dados).
- [ ] **F2** — contas, fluxo de caixa (competência × caixa), projeção até mar/2027, reserva mínima, simulador "e se".
- [ ] **F3** — gastos (lançamento rápido, categorias, recorrentes/parcelados, resumo e gráficos).
- [ ] **F4** — MEI (DAS, limite proporcional, DASN-SIMEI), agenda de prazos (+ .ics) e metas.
- [ ] **F5** — polimento, acessibilidade, README completo.

## Pendências do usuário

- Instalar o Node LTS para rodar `npm test` (os testes também rodam em `tests/index.html`).
- Nº do pedido de compra, e-mail de envio da NF e prazo real de pagamento do tomador.
- Gastos essenciais por mês e saldo atual (para a projeção e a reserva de emergência).

## Registro

### 13/10/2026 — PC de casa
- Projeto criado. F1 concluída e verificada no navegador (desktop e celular, claro e escuro). 26/26 testes passando
  (rodados no navegador: Node ainda não instalado).
