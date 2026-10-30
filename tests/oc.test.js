import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completarFeriados } from '../src/dominio/feriados.js';
import { CONTRATO_PADRAO } from '../src/dominio/contrato.js';
import {
  gerarItens, totalDaOC, itemDoMes, itemDoDia, periodoItem, janelaNF, dentroDaJanela, motivoRecusaEmissao,
  emissaoPrevista, dataPagamento, textoAceite,
} from '../src/dominio/oc.js';

// valores fictícios
const feriados = completarFeriados([], [2026, 2027]);
const contrato = {
  ...CONTRATO_PADRAO, inicio: '2026-10-13', dataEntradaOC: '2026-10-15', numeroOC: '9999999',
  emailDanfse: 'notas@exemplo.invalid', emailXml: 'xml@exemplo.invalid',
  itensOC: gerarItens({ quantidade: 6, valorCentavos: 260000, primeiroDespacho: '2026-11-15' }),
};

test('itens mensais de valor fixo: 6 × R$ 2.600,00 = R$ 15.600,00', () => {
  assert.deepEqual(contrato.itensOC.map((i) => [i.n, i.despacho]), [
    [1, '2026-11-15'], [2, '2026-12-15'], [3, '2027-01-15'], [4, '2027-02-15'], [5, '2027-03-15'], [6, '2027-04-15'],
  ]);
  assert.equal(totalDaOC(contrato), 1560000);
  assert.equal(itemDoMes(contrato, '2027-01').n, 3);
  assert.equal(itemDoMes(contrato, '2026-10'), null);
  assert.deepEqual(gerarItens({ quantidade: 2, valorCentavos: 1, primeiroDespacho: '2027-01-31' }).map((i) => i.despacho),
    ['2027-01-31', '2027-02-28']);
});

test('período de cada item vai do despacho anterior ao seu', () => {
  assert.deepEqual(periodoItem(contrato, contrato.itensOC[0]), { inicio: '2026-10-13', fim: '2026-11-15' });
  assert.deepEqual(periodoItem(contrato, contrato.itensOC[1]), { inicio: '2026-11-16', fim: '2026-12-15' });
  assert.equal(itemDoDia(contrato, '2026-11-15').n, 1);
  assert.equal(itemDoDia(contrato, '2026-11-16').n, 2);
  assert.equal(itemDoDia(contrato, '2027-04-16'), null);
});

test('janela da NF: dia 15 ao 20; do 21 ao fim do mês é recusada', () => {
  assert.deepEqual(janelaNF('2026-11', contrato), { abre: '2026-11-15', lembrete: '2026-11-18', limite: '2026-11-20' });
  assert.ok(dentroDaJanela('2026-11-15', contrato));
  assert.ok(dentroDaJanela('2026-11-20', contrato));
  assert.ok(!dentroDaJanela('2026-11-21', contrato));
  assert.ok(!dentroDaJanela('2026-11-30', contrato));
  assert.ok(!dentroDaJanela('2026-11-14', contrato));
  const item = contrato.itensOC[0];
  assert.equal(motivoRecusaEmissao('2026-11-18', item, contrato), null);
  assert.match(motivoRecusaEmissao('2026-11-21', item, contrato), /recusada/);
  assert.match(motivoRecusaEmissao('2026-10-16', item, contrato), /só abre em 15\/11/);
});

test('emissão prevista: dia escolhido, hoje dentro da janela ou a janela seguinte', () => {
  const item = contrato.itensOC[0];
  assert.deepEqual(emissaoPrevista(item, contrato, '2026-10-30'),
    { data: '2026-11-20', maisCedo: '2026-11-15', maisTarde: '2026-11-20', mes: '2026-11', perdida: false });
  assert.equal(emissaoPrevista(item, contrato, '2026-10-30', 16).data, '2026-11-16');
  assert.equal(emissaoPrevista(item, contrato, '2026-10-30', 25).data, '2026-11-20'); // fora da janela: limita
  assert.equal(emissaoPrevista(item, contrato, '2026-11-18', 16).data, '2026-11-18'); // já passou do dia 16
  const perdida = emissaoPrevista(item, contrato, '2026-11-21');
  assert.deepEqual([perdida.mes, perdida.data, perdida.perdida], ['2026-12', '2026-12-20', true]);
});

test('pagamento 30 dias corridos, passando para o próximo dia útil (feriados inclusos)', () => {
  assert.equal(dataPagamento('2026-11-16', contrato, feriados), '2026-12-16');
  assert.equal(dataPagamento('2026-11-20', contrato, feriados), '2026-12-21'); // 20/12 é domingo
  // 09/12 é feriado municipal (Guarapuava): passa para 10/12
  assert.equal(dataPagamento('2026-11-09', contrato, feriados), '2026-12-10');
  assert.equal(dataPagamento('2026-11-20', { ...contrato, prazoPagamentoDias: 19 }, feriados), '2026-12-10');
  // 25/12 (Natal) e fim de semana
  assert.equal(dataPagamento('2026-11-25', contrato, feriados), '2026-12-28');
  // outras bases de contagem
  assert.equal(dataPagamento('2026-11-18', { ...contrato, basePrazo: 'fimMes' }, feriados), '2026-12-30');
  assert.equal(dataPagamento('2026-11-18', { ...contrato, basePrazo: 'entrada' }, feriados, '2026-11-19'), '2026-12-21');
});

test('texto do aceite cita itens e condições', () => {
  const t = textoAceite(contrato, { nome: 'Fulano', cnpj: '00.000.000/0001-00' });
  assert.match(t, /^Assunto: Aceite da Ordem de Compra nº 9999999/);
  assert.match(t, /- Item 1 – Mês 1 – data para despacho 15\/11\/2026 – R\$ 2\.600,00/);
  assert.match(t, /Total: R\$ 15\.600,00/);
  assert.match(t, /Entrega final: 15\/04\/2027/);
  assert.match(t, /entre os dias 15 e 20/);
  assert.match(t, /PDF \(DANFSE\) para notas@exemplo\.invalid; XML para xml@exemplo\.invalid/);
  assert.match(t, /30 DDL, por DDA ou depósito bancário/);
  assert.match(t, /Fulano — CNPJ 00\.000\.000\/0001-00$/);
});
