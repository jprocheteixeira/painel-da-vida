import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial } from '../src/storage/migracoes.js';
import { dasDoPeriodo, vencimentoDas } from '../src/dominio/mei.js';
import {
  recebimentos, projecao, saldoNoFimDe, competenciaVsCaixa, simular, gradeSimulador,
  ocorrenciasRecorrencia, saldoAtual,
} from '../src/dominio/caixa.js';
import { gerarItens } from '../src/dominio/oc.js';

const HOJE = '2026-10-30';

// valores fictícios de OC; datas e feriados reais do calendário (inclui 09/12, Guarapuava)
function cenario() {
  const e = estadoInicial();
  e.perfil.aberturaMei = '2026-10-03';
  Object.assign(e.contrato, {
    inicio: '2026-10-13', fim: '2027-04-15', dataEntradaOC: '2026-10-15',
    itensOC: gerarItens({ quantidade: 6, valorCentavos: 260000, primeiroDespacho: '2026-11-15' }),
  });
  e.marcas = { '2026-10-13': 'trabalhado' };
  e.caixa.saldoEm = HOJE;
  return e;
}

test('DAS vence no dia 20 do mês seguinte à competência', () => {
  assert.equal(vencimentoDas('2026-10'), '2026-11-20');
  assert.equal(vencimentoDas('2026-12'), '2027-01-20');
  const das = dasDoPeriodo('2026-10-03', '2027-03');
  assert.equal(das.length, 6);
  assert.deepEqual(das[0], { competencia: '2026-10', vencimento: '2026-11-20', valorCentavos: 8605 });
});

test('6 recebimentos de valor fixo: emissão no dia 20 + 30 dias, no próximo dia útil', () => {
  const r = recebimentos(cenario(), HOJE);
  assert.deepEqual(r.map((x) => [x.item, x.competencia, x.valorCentavos, x.data, x.maisCedo, x.maisTarde]), [
    [1, '2026-11', 260000, '2026-12-21', '2026-12-15', '2026-12-21'], // 20/12 é domingo
    [2, '2026-12', 260000, '2027-01-19', '2027-01-14', '2027-01-19'],
    [3, '2027-01', 260000, '2027-02-19', '2027-02-15', '2027-02-19'], // 14/02 é domingo
    [4, '2027-02', 260000, '2027-03-22', '2027-03-17', '2027-03-22'], // 22/03: fevereiro tem 28 dias
    [5, '2027-03', 260000, '2027-04-19', '2027-04-14', '2027-04-19'],
    [6, '2027-04', 260000, '2027-05-20', '2027-05-17', '2027-05-20'], // 15/05 é sábado
  ]);
  assert.equal(r.reduce((s, x) => s + x.valorCentavos, 0), 1560000);
});

test('projeção mês a mês com os 6 recebimentos, DAS e reserva mínima', () => {
  const p = projecao(cenario(), HOJE);
  assert.deepEqual(p.map((m) => m.mes), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03',
    '2027-04', '2027-05', '2027-06']);
  assert.equal(saldoNoFimDe(p, '2026-10'), 0);
  assert.equal(saldoNoFimDe(p, '2026-11'), -8605);
  assert.equal(saldoNoFimDe(p, '2026-12'), 260000 - 2 * 8605);
  assert.equal(saldoNoFimDe(p, '2027-05'), 6 * 260000 - 7 * 8605);
  assert.equal(saldoNoFimDe(p, '2027-06'), 6 * 260000 - 8 * 8605);
  assert.deepEqual(p.slice(0, 3).map((m) => m.abaixoDaReserva), [true, true, false]);
  // dias por semana não mudam a receita
  const e = cenario();
  e.contrato.diasSemana = [2];
  assert.equal(saldoNoFimDe(projecao(e, HOJE), '2027-05'), saldoNoFimDe(p, '2027-05'));
});

test('gastos fixos entram todo mês, no dia definido (limitado ao fim do mês)', () => {
  const rec = { descricao: 'Aluguel', valorCentavos: 50000, dia: 31, inicio: '2026-11-01', fim: null };
  const oc = ocorrenciasRecorrencia(rec, '2026-10', '2027-02');
  assert.deepEqual(oc.map((o) => o.data), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
  assert.equal(oc[0].valorCentavos, -50000);
  const e = cenario();
  e.recorrencias = [rec];
  assert.equal(saldoNoFimDe(projecao(e, HOJE), '2026-12'), 260000 - 2 * 8605 - 100000);
});

test('saldo informado + fluxos até hoje', () => {
  const e = cenario();
  e.contas[0].saldoCentavos = 50000;
  e.contas[1].saldoCentavos = 25050;
  assert.equal(saldoAtual(e, HOJE), 75050);
  assert.equal(saldoAtual(e, '2026-11-25'), 75050 - 8605);
});

test('competência × caixa: cada mês de item vale o valor fixo', () => {
  const linhas = competenciaVsCaixa(cenario(), HOJE);
  const mes = (m) => linhas.find((l) => l.mes === m);
  assert.equal(linhas[0].mes, '2026-11');
  assert.deepEqual([mes('2026-11').competencia, mes('2026-11').caixa], [260000, 0]);
  assert.deepEqual([mes('2026-12').competencia, mes('2026-12').caixa], [260000, 260000]);
  assert.deepEqual([mes('2027-05').competencia, mes('2027-05').caixa], [0, 260000]);
});

test('simulador "e se": dia de emissão, prazo e base de contagem', () => {
  const e = cenario();
  const atual = 260000 - 2 * 8605;
  // 15 dias, emissão no dia 15: item 1 em 30/11 e item 2 em 30/12
  assert.equal(simular(e, HOJE, { prazoPagamentoDias: 15, diaEmissao: 15 }, '2026-12'), 2 * 260000 - 2 * 8605);
  const g = gradeSimulador(e, HOJE, '2026-12');
  assert.equal(g.atual, atual);
  assert.deepEqual(g.linhas.map((l) => l.prazo), [15, 30, 45, 60]);
  const celula = (prazo, dia, grade = g) => grade.linhas.find((l) => l.prazo === prazo).celulas.find((c) => c.dia === dia);
  assert.equal(celula(30, 20).diferenca, 0); // cenário atual
  assert.equal(celula(30, 15).diferenca, 0); // 15/12: ainda em dezembro
  assert.equal(celula(15, 15).diferenca, 260000);
  assert.equal(celula(60, 20).diferenca, -260000); // item 1 só em janeiro
  // fim do mês + 30: item 1 em 30/12 (ainda dezembro); item 2 só em 01/2027
  const fimMes = gradeSimulador(e, HOJE, '2026-12', { basePrazo: 'fimMes' });
  assert.equal(celula(30, 20, fimMes).diferenca, 0);
  assert.equal(celula(45, 20, fimMes).diferenca, -260000);
});
