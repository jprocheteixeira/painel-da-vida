import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  hojeISO, somarDias, diaDaSemana, inicioSemana, formatarData, somarMeses, ultimoDiaDoMes,
  diferencaDias, ehDataISO, rotuloCompetencia,
} from '../src/utils/datas.js';
import { formatarReais, lerReais, centavosParaCampo } from '../src/utils/dinheiro.js';

test('hoje é calculado no fuso de São Paulo', () => {
  // 02:30 UTC de 14/10 ainda é 13/10 em São Paulo (UTC−3)
  assert.equal(hojeISO(new Date('2026-10-14T02:30:00Z')), '2026-10-13');
  assert.equal(hojeISO(new Date('2026-10-14T03:30:00Z')), '2026-10-14');
});

test('aritmética de datas', () => {
  assert.equal(somarDias('2026-10-30', 3), '2026-11-02');
  assert.equal(somarDias('2027-03-01', -1), '2027-02-28');
  assert.equal(diaDaSemana('2026-10-14'), 3); // quarta
  assert.equal(inicioSemana('2026-10-18'), '2026-10-12'); // domingo → segunda anterior
  assert.equal(diferencaDias('2026-11-09', '2026-12-09'), 30);
  assert.equal(formatarData('2026-10-14'), '14/10/2026');
  assert.equal(somarMeses('2026-12', 1), '2027-01');
  assert.equal(somarMeses('2027-01', -1), '2026-12');
  assert.equal(ultimoDiaDoMes('2027-02'), '2027-02-28');
  assert.equal(rotuloCompetencia('2026-10'), 'Outubro/2026');
  assert.ok(ehDataISO('2026-02-28'));
  assert.ok(!ehDataISO('2026-02-30'));
});

test('formata reais em pt-BR a partir de centavos', () => {
  assert.equal(formatarReais(123456), 'R$ 1.234,56');
  assert.equal(formatarReais(8605), 'R$ 86,05');
  assert.equal(formatarReais(5), 'R$ 0,05');
  assert.equal(formatarReais(-150000), '−R$ 1.500,00');
  assert.equal(formatarReais(1234500), 'R$ 12.345,00');
  assert.equal(formatarReais(100, { sinal: true }), '+R$ 1,00');
  assert.equal(centavosParaCampo(20000), '200,00');
  assert.throws(() => formatarReais(1.5));
});

test('lê valores digitados sem usar float', () => {
  assert.equal(lerReais('1.234,56'), 123456);
  assert.equal(lerReais('R$ 200'), 20000);
  assert.equal(lerReais('86,05'), 8605);
  assert.equal(lerReais('86.05'), 8605);
  assert.equal(lerReais('0,1'), 10);
  assert.equal(lerReais('1.234'), 123400);
  assert.equal(lerReais('-15,00'), -1500);
  assert.equal(lerReais('0,29'), 29); // 0.29 * 100 em float daria 28.999…
  assert.equal(lerReais('abc'), null);
  assert.equal(lerReais(''), null);
  assert.equal(lerReais('1,2,3'), null);
});

test('CNPJ digitado só com números ganha pontos, barra e traço', async () => {
  const { formatarCnpj } = await import('../src/utils/documentos.js');
  assert.equal(formatarCnpj('00000000000100'), '00.000.000/0001-00');
  assert.equal(formatarCnpj(' 00.000.000/0001-00 '), '00.000.000/0001-00');
  assert.equal(formatarCnpj('00 000 000 0001 00'), '00.000.000/0001-00');
  assert.equal(formatarCnpj('123'), '123'); // incompleto: fica como está
  assert.equal(formatarCnpj(''), '');
});
