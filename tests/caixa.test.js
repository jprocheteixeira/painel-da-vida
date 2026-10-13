import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial } from '../src/storage/migracoes.js';
import { dasDoPeriodo, vencimentoDas } from '../src/dominio/mei.js';
import {
  recebimentos, projecao, saldoNoFimDe, competenciaVsCaixa, simular, gradeSimulador,
  ocorrenciasRecorrencia, saldoAtual,
} from '../src/dominio/caixa.js';

const HOJE = '2026-10-13';

function cenario() {
  const e = estadoInicial();
  e.perfil.aberturaMei = '2026-10-03';
  Object.assign(e.contrato, { inicio: '2026-10-13', fim: '2027-04-12' });
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

test('recebimentos: outubro (9 dias) cai em dezembro; novembro (12 dias) em janeiro', () => {
  const r = recebimentos(cenario(), HOJE);
  assert.deepEqual(r.slice(0, 3).map((x) => [x.competencia, x.valorCentavos, x.data]), [
    ['2026-10', 180000, '2026-12-10'],
    ['2026-11', 240000, '2027-01-06'],
    ['2026-12', 280000, '2027-02-08'], // 09/12 é feriado; pagamento 07/02 (dom) → 08/02
  ]);
});

test('projeção mês a mês com DAS e reserva mínima', () => {
  const p = projecao(cenario(), HOJE);
  assert.deepEqual(p.map((m) => m.mes), ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
  assert.equal(saldoNoFimDe(p, '2026-10'), 0);
  assert.equal(saldoNoFimDe(p, '2026-11'), -8605);
  assert.equal(saldoNoFimDe(p, '2026-12'), 162790);
  assert.equal(saldoNoFimDe(p, '2027-01'), 394185);
  assert.deepEqual(p.slice(0, 3).map((m) => m.abaixoDaReserva), [true, true, false]);
});

test('gastos fixos entram todo mês, no dia definido (limitado ao fim do mês)', () => {
  const rec = { descricao: 'Aluguel', valorCentavos: 50000, dia: 31, inicio: '2026-11-01', fim: null };
  const oc = ocorrenciasRecorrencia(rec, '2026-10', '2027-02');
  assert.deepEqual(oc.map((o) => o.data), ['2026-11-30', '2026-12-31', '2027-01-31', '2027-02-28']);
  assert.equal(oc[0].valorCentavos, -50000);
  const e = cenario();
  e.recorrencias = [rec];
  assert.equal(saldoNoFimDe(projecao(e, HOJE), '2026-12'), 162790 - 100000);
});

test('saldo informado + fluxos até hoje', () => {
  const e = cenario();
  e.contas[0].saldoCentavos = 50000;
  e.contas[1].saldoCentavos = 25050;
  assert.equal(saldoAtual(e, HOJE), 75050);
  assert.equal(saldoAtual(e, '2026-11-25'), 75050 - 8605);
});

test('competência × caixa', () => {
  const linhas = competenciaVsCaixa(cenario(), HOJE);
  const out = linhas.find((l) => l.mes === '2026-10');
  const dez = linhas.find((l) => l.mes === '2026-12');
  assert.equal(out.competencia, 180000);
  assert.equal(out.caixa, 0);
  assert.equal(dez.caixa, 180000);
  assert.equal(dez.competencia, 280000);
});

test('simulador "e se": prazo de 15 dias antecipa dois recebimentos para 2026', () => {
  const e = cenario();
  assert.equal(simular(e, HOJE, { prazoPagamentoDias: 15 }, '2026-12'), 180000 + 240000 - 2 * 8605); // DAS de 20/11 e 20/12
  const g = gradeSimulador(e, HOJE, '2026-12');
  assert.equal(g.atual, 162790);
  const p15x3 = g.linhas.find((l) => l.prazo === 15).celulas.find((c) => c.dias === 3);
  assert.equal(p15x3.diferenca, 240000); // novembro passa a cair em 22/12
  const p30x3 = g.linhas.find((l) => l.prazo === 30).celulas.find((c) => c.dias === 3);
  assert.equal(p30x3.diferenca, 0);
  // 2 dias por semana (ter e qua): outubro tem 6 dias = R$ 1.200 (o dia 13 já marcado conta)
  const p30x2 = g.linhas.find((l) => l.prazo === 30).celulas.find((c) => c.dias === 2);
  assert.equal(p30x2.saldo, 120000 - 2 * 8605);
});
