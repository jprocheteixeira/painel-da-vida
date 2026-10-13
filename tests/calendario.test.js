import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pascoa, feriadosPadrao, completarFeriados, feriadoEm } from '../src/dominio/feriados.js';
import {
  ehDiaUtil, proximoDiaUtil, ultimoDiaUtil, nesimoDiaUtil, somarDiasCorridosAteUtil,
} from '../src/dominio/calendario.js';

const feriados = completarFeriados([], [2026, 2027]);

test('Páscoa e feriados móveis', () => {
  assert.equal(pascoa(2026), '2026-04-05');
  assert.equal(pascoa(2027), '2027-03-28');
  const f27 = feriadosPadrao(2027);
  assert.ok(f27.some((f) => f.data === '2027-03-26' && f.nome === 'Sexta-feira Santa' && f.ativo));
  assert.ok(f27.some((f) => f.data === '2027-05-27' && f.nome === 'Corpus Christi' && !f.ativo));
  assert.ok(f27.some((f) => f.data === '2027-02-09' && f.tipo === 'facultativo'));
});

test('feriados padrão incluem 20/11 e o aniversário de Guarapuava, e não o 19/12', () => {
  assert.equal(feriadoEm('2026-11-20', feriados)?.tipo, 'nacional');
  assert.equal(feriadoEm('2026-12-09', feriados)?.tipo, 'municipal');
  assert.equal(feriadoEm('2026-12-19', feriados), null);
  assert.equal(feriadoEm('2027-02-08', feriados), null); // Carnaval desligado
});

test('dia útil ignora fim de semana e feriado ativo', () => {
  assert.ok(ehDiaUtil('2026-10-14', feriados));
  assert.ok(!ehDiaUtil('2026-10-17', feriados)); // sábado
  assert.ok(!ehDiaUtil('2026-11-02', feriados)); // Finados
  const semFinados = feriados.map((f) => (f.data === '2026-11-02' ? { ...f, ativo: false } : f));
  assert.ok(ehDiaUtil('2026-11-02', semFinados));
});

test('último dia útil do mês', () => {
  assert.equal(ultimoDiaUtil('2026-10', feriados), '2026-10-30'); // 31/10 é sábado
  assert.equal(ultimoDiaUtil('2027-01', feriados), '2027-01-29');
  assert.equal(ultimoDiaUtil('2026-12', feriados), '2026-12-31');
});

test('5º dia útil do mês', () => {
  assert.equal(nesimoDiaUtil('2026-11', 5, feriados), '2026-11-09'); // 02/11 é feriado
  assert.equal(nesimoDiaUtil('2026-12', 5, feriados), '2026-12-07');
  assert.equal(nesimoDiaUtil('2027-01', 5, feriados), '2027-01-08'); // 01/01 é feriado
  assert.equal(nesimoDiaUtil('2027-04', 5, feriados), '2027-04-07');
  assert.equal(nesimoDiaUtil('2026-10', 1, feriados), '2026-10-01');
  assert.throws(() => nesimoDiaUtil('2026-10', 0, feriados));
});

test('prazo em dias corridos cai no próximo dia útil', () => {
  assert.equal(proximoDiaUtil('2026-10-31', feriados), '2026-11-03');
  assert.equal(somarDiasCorridosAteUtil('2026-11-09', 30, feriados), '2026-12-10'); // 09/12 é feriado em Guarapuava
  assert.equal(somarDiasCorridosAteUtil('2026-11-10', 30, feriados), '2026-12-10');
  assert.equal(somarDiasCorridosAteUtil('2026-11-25', 30, feriados), '2026-12-28'); // 25/12 → sáb → seg 28
});
