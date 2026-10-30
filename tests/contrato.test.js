import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completarFeriados } from '../src/dominio/feriados.js';
import {
  CONTRATO_PADRAO, ehDiaSugerido, situacaoDia, proximaMarca, marcarDia, periodoCompetencia,
  competenciaDoDia, diasTrabalhados, diasPrevistos, semanasAcimaDoTeto, estimativaContrato,
  competenciasDoContrato, DIA,
} from '../src/dominio/contrato.js';

const feriados = completarFeriados([], [2026, 2027]);
const contrato = { ...CONTRATO_PADRAO, inicio: '2026-10-14', fim: '2027-04-13' };

test('sugere terça, quarta e quinta dentro do contrato, sem feriados', () => {
  assert.ok(!ehDiaSugerido('2026-10-13', contrato, feriados)); // antes do início
  assert.ok(ehDiaSugerido('2026-10-14', contrato, feriados)); // quarta
  assert.ok(!ehDiaSugerido('2026-10-16', contrato, feriados)); // sexta
  assert.ok(!ehDiaSugerido('2026-12-09', contrato, feriados)); // quarta, feriado municipal
  assert.ok(!ehDiaSugerido('2027-04-14', contrato, feriados)); // depois do fim
  assert.ok(!ehDiaSugerido('2026-10-14', { ...contrato, inicio: null }, feriados));
});

test('clique cicla a marcação do dia', () => {
  assert.equal(proximaMarca(undefined, true), DIA.TRABALHADO);
  assert.equal(proximaMarca(DIA.TRABALHADO, true), DIA.FOLGA);
  assert.equal(proximaMarca(DIA.FOLGA, true), null);
  assert.equal(proximaMarca(DIA.TRABALHADO, false), null); // dia fora da sugestão não tem folga
  const m = marcarDia({}, '2026-10-14', DIA.TRABALHADO);
  assert.equal(situacaoDia('2026-10-14', m, contrato, feriados), 'trabalhado');
  assert.equal(situacaoDia('2026-10-15', m, contrato, feriados), 'sugerido');
  assert.equal(situacaoDia('2026-10-16', m, contrato, feriados), null);
  assert.deepEqual(marcarDia(m, '2026-10-14', null), {});
});

test('competência pelo mês ou por dia de corte', () => {
  assert.deepEqual(periodoCompetencia('2026-10'), { inicio: '2026-10-01', fim: '2026-10-31' });
  assert.deepEqual(periodoCompetencia('2026-11', 25), { inicio: '2026-10-26', fim: '2026-11-25' });
  assert.deepEqual(periodoCompetencia('2027-03', 30), { inicio: '2027-03-01', fim: '2027-03-30' });
  assert.equal(competenciaDoDia('2026-10-27', 25), '2026-11');
  assert.equal(competenciaDoDia('2026-10-25', 25), '2026-10');
  assert.equal(competenciaDoDia('2026-10-27'), '2026-10');
});

test('dias trabalhados e previstos do mês', () => {
  const periodo = periodoCompetencia('2026-10');
  const marcas = { '2026-10-14': DIA.TRABALHADO, '2026-10-15': DIA.TRABALHADO, '2026-10-21': DIA.FOLGA,
    '2026-11-03': DIA.TRABALHADO };
  assert.deepEqual(diasTrabalhados(periodo, marcas), ['2026-10-14', '2026-10-15']);
  // hoje = 16/10: 14 e 15 trabalhados; 20, 22, 27, 28, 29 sugeridos; 21 é folga
  const previstos = diasPrevistos(periodo, marcas, contrato, feriados, '2026-10-16');
  assert.deepEqual(previstos, ['2026-10-14', '2026-10-15', '2026-10-20', '2026-10-22',
    '2026-10-27', '2026-10-28', '2026-10-29']);
  // dia sugerido que já passou sem marcação não conta
  assert.equal(diasPrevistos(periodo, {}, contrato, feriados, '2026-10-16').length, 6);
});

test('alerta de teto semanal', () => {
  const marcas = { '2026-10-19': DIA.TRABALHADO, '2026-10-20': DIA.TRABALHADO,
    '2026-10-21': DIA.TRABALHADO, '2026-10-22': DIA.TRABALHADO, '2026-10-27': DIA.TRABALHADO };
  assert.deepEqual(semanasAcimaDoTeto(marcas, 3), [{ semana: '2026-10-19', dias: 4 }]);
  assert.deepEqual(semanasAcimaDoTeto(marcas, 4), []);
  // semana que atravessa o mês conta junto
  const virada = { '2026-12-29': DIA.TRABALHADO, '2026-12-30': DIA.TRABALHADO,
    '2026-12-31': DIA.TRABALHADO, '2027-01-01': DIA.TRABALHADO };
  assert.deepEqual(semanasAcimaDoTeto(virada, 3), [{ semana: '2026-12-28', dias: 4 }]);
});

test('estimativa do contrato e competências', () => {
  // 78 terças/quartas/quintas no período, menos o 09/12 (feriado municipal numa quarta) = 77 (só informação)
  assert.deepEqual(estimativaContrato(contrato, feriados), { dias: 77 });
  const meses = competenciasDoContrato(contrato);
  assert.equal(meses[0], '2026-10');
  assert.equal(meses.at(-1), '2027-04');
  assert.equal(meses.length, 7);
});
