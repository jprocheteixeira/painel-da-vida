import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, migrar, VERSAO_ATUAL } from '../src/storage/migracoes.js';
import { gerarBackup, lerBackup, precisaLembreteBackup } from '../src/storage/backup.js';
import { estadoDeExemplo } from '../src/storage/exemplo.js';

test('migra dados sem versão e completa padrões', () => {
  const d = migrar({ perfil: { nome: 'Fulano' }, marcas: { '2026-10-14': 'trabalhado' } });
  assert.equal(d.versao, VERSAO_ATUAL);
  assert.equal(d.perfil.nome, 'Fulano');
  assert.equal(d.perfil.cnpj, '');
  assert.equal(d.contrato.valorDiaCentavos, 20000);
  assert.ok(d.feriados.length > 20);
  assert.deepEqual(d.marcas, { '2026-10-14': 'trabalhado' });
});

test('não traz de volta feriado apagado pelo usuário', () => {
  const e = estadoInicial();
  e.feriados = e.feriados.filter((f) => f.data !== '2026-12-09');
  const d = migrar(e);
  assert.ok(!d.feriados.some((f) => f.data === '2026-12-09'));
});

test('recusa dados de versão futura e lixo', () => {
  assert.throws(() => migrar({ versao: VERSAO_ATUAL + 1 }), /versão mais nova/);
  assert.throws(() => migrar(null));
  assert.throws(() => lerBackup('não é json'), /JSON/);
  assert.throws(() => lerBackup('{"app":"outro","dados":{}}'), /não é um backup/);
});

test('backup vai e volta igual', () => {
  const e = estadoDeExemplo('2026-11-18');
  const texto = JSON.stringify(gerarBackup(e, '2026-11-18T10:00:00Z'));
  assert.deepEqual(lerBackup(texto), e);
});

test('lembrete de backup a cada 30 dias', () => {
  const e = estadoInicial();
  assert.equal(precisaLembreteBackup(e, '2026-11-01'), false); // sem dados
  e.contrato.inicio = '2026-10-14';
  assert.equal(precisaLembreteBackup(e, '2026-11-01'), true); // nunca fez
  e.meta.ultimoBackup = '2026-10-10';
  assert.equal(precisaLembreteBackup(e, '2026-11-08'), false);
  assert.equal(precisaLembreteBackup(e, '2026-11-09'), true);
});
