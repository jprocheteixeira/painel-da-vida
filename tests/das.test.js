import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, migrar } from '../src/storage/migracoes.js';
import { situacaoDas, dataLembreteDas } from '../src/dominio/mei.js';
import { gastosDoMes, resumoDoMes, gastoConhecidoNoMes } from '../src/dominio/gastos.js';
import { tarefasDAS, tarefasAutomaticas, proximosPrazos } from '../src/dominio/prazos.js';
import { projecao, saldoNoFimDe } from '../src/dominio/caixa.js';
import { gerarICS, tarefasParaEventos, escaparICS } from '../src/dominio/agenda.js';

function cenario() {
  const e = estadoInicial();
  e.perfil.aberturaMei = '2026-10-03';
  e.caixa.saldoEm = '2026-10-13';
  return e;
}

test('lembrete do DAS cai no último dia útil até o dia 20', () => {
  const e = cenario();
  assert.equal(dataLembreteDas('2026-11-20', e.feriados), '2026-11-19'); // 20/11 é feriado (Consciência Negra)
  assert.equal(dataLembreteDas('2026-12-20', e.feriados), '2026-12-18'); // domingo → sexta
  assert.equal(dataLembreteDas('2027-01-20', e.feriados), '2027-01-20');
  const s = situacaoDas(e, '2026-11');
  assert.deepEqual(s.map((d) => [d.competencia, d.vencimento, d.pagarAte, d.pagoEm]), [
    ['2026-10', '2026-11-20', '2026-11-19', null],
    ['2026-11', '2026-12-20', '2026-12-18', null],
  ]);
});

test('DAS aparece nos gastos do mês, na categoria Impostos', () => {
  const e = cenario();
  const nov = gastosDoMes(e, '2026-11');
  assert.deepEqual(nov.map((g) => [g.origem, g.data, g.valorCentavos, g.categoriaId]), [['das', '2026-11-20', 8605, 'impostos']]);
  assert.equal(gastosDoMes(e, '2026-10').length, 0);
  assert.equal(resumoDoMes(e, '2026-11').categorias.find((c) => c.id === 'impostos').total, 8605);
  assert.equal(gastoConhecidoNoMes(e, '2026-11'), 0); // não desconta da estimativa
  // pago antes: entra no mês do pagamento
  e.dasPagos = { '2026-11': '2026-11-30' };
  assert.equal(gastosDoMes(e, '2026-11').length, 2);
  assert.equal(gastosDoMes(e, '2026-12').length, 0);
});

test('lembrete some quando o DAS é pago; caixa usa a data real', () => {
  const e = cenario();
  assert.deepEqual(tarefasDAS(e, '2026-11-02').map((t) => [t.id, t.data]),
    [['das:2026-10', '2026-11-19'], ['das:2026-11', '2026-12-18']]);
  assert.match(tarefasDAS(e, '2026-11-02')[0].detalhe, /vence 20\/11\/2026; pague até 19\/11\/2026/);
  // em 06/11, nos próximos 14 dias só aparece o de outubro (19/11)
  assert.deepEqual(proximosPrazos(tarefasDAS(e, '2026-11-06'), '2026-11-06', 14).map((t) => t.id), ['das:2026-10']);
  e.dasPagos = { '2026-10': '2026-11-05' };
  assert.deepEqual(tarefasDAS(e, '2026-11-02').map((t) => t.id), ['das:2026-11']);
  const p = projecao(e, '2026-10-13');
  assert.equal(saldoNoFimDe(p, '2026-11'), -8605);
  // atrasado continua aparecendo
  const f = cenario();
  const prox = proximosPrazos(tarefasAutomaticas(f, '2026-11-25'), '2026-11-25', 14);
  assert.equal(prox.find((t) => t.id === 'das:2026-10').urgencia, 'atrasado');
});

test('arquivo .ics com eventos de dia inteiro e dois avisos', () => {
  const ics = gerarICS(tarefasParaEventos([
    { id: 'das:2026-10', data: '2026-11-19', titulo: 'Pagar o DAS do MEI (10/2026)', valorCentavos: 8605, detalhe: 'vence 20/11/2026' },
  ]), '20261013T200000Z');
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /DTSTART;VALUE=DATE:20261119\r\nDTEND;VALUE=DATE:20261120/);
  assert.match(ics, /SUMMARY:Pagar o DAS do MEI \(10\/2026\) · R\$ 86\\,05/);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 2);
  assert.match(ics, /UID:das:2026-10@painel-da-vida/);
  assert.ok(ics.endsWith('END:VCALENDAR\r\n'));
  assert.equal(escaparICS('a,b;c\nd'), 'a\\,b\\;c\\nd');
});

test('migração v3 → v4 cria a categoria de impostos antes de Outros', () => {
  const v3 = { versao: 3, categorias: [{ id: 'mercado', nome: 'Mercado' }, { id: 'outros', nome: 'Outros' }] };
  const d = migrar(v3);
  assert.equal(d.versao, 4);
  assert.deepEqual(d.categorias.map((c) => c.id), ['mercado', 'impostos', 'outros']);
  assert.deepEqual(d.dasPagos, {});
});
