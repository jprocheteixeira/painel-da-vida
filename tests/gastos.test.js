import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, migrar } from '../src/storage/migracoes.js';
import {
  ocorrenciasParcelamento, parcelasPagas, ocorrenciasFixo, gastosDoMes, resumoDoMes, diaNoMes,
} from '../src/dominio/gastos.js';
import { projecao, saldoNoFimDe, saldoAtual } from '../src/dominio/caixa.js';

const HOJE = '2026-10-13';

function cenario() {
  const e = estadoInicial();
  e.caixa.saldoEm = HOJE;
  e.contas[0].saldoCentavos = 300000;
  e.lancamentos = [
    { id: 'l1', data: '2026-10-05', valorCentavos: 12000, categoriaId: 'mercado', nota: 'Feira' },
    { id: 'l2', data: '2026-10-14', valorCentavos: 4550, categoriaId: 'lazer', nota: '' },
    { id: 'l3', data: '2026-09-20', valorCentavos: 9000, categoriaId: 'mercado', nota: '' },
  ];
  e.recorrencias = [{ id: 'r1', descricao: 'Aluguel', valorCentavos: 70000, dia: 10, inicio: '2026-09-01', fim: null, categoriaId: 'contas' }];
  e.parcelamentos = [{ id: 'p1', descricao: 'Notebook', valorParcelaCentavos: 25000, parcelas: 3, primeiraData: '2026-10-31', categoriaId: 'estudos' }];
  return e;
}

test('parcelas mensais no mesmo dia, limitado ao fim do mês', () => {
  const p = { valorParcelaCentavos: 25000, parcelas: 3, primeiraData: '2026-10-31' };
  assert.deepEqual(ocorrenciasParcelamento(p).map((o) => o.data), ['2026-10-31', '2026-11-30', '2026-12-31']);
  assert.equal(parcelasPagas(p, '2026-11-30'), 2);
  assert.equal(diaNoMes('2027-02', 31), '2027-02-28');
});

test('gasto fixo respeita início e fim', () => {
  const r = { valorCentavos: 5000, dia: 15, inicio: '2026-11-01', fim: '2027-01-31' };
  assert.deepEqual(ocorrenciasFixo(r, '2026-10', '2027-03').map((o) => o.data), ['2026-11-15', '2026-12-15', '2027-01-15']);
});

test('gastos do mês juntam lançamentos, fixos e parcelas', () => {
  const itens = gastosDoMes(cenario(), '2026-10');
  assert.deepEqual(itens.map((i) => [i.origem, i.valorCentavos]), [
    ['parcela', 25000], ['manual', 4550], ['fixo', 70000], ['manual', 12000],
  ]);
  assert.equal(itens[0].descricao, 'Notebook (1/3)');
});

test('resumo por categoria, mês anterior e orçamento', () => {
  const e = cenario();
  e.categorias.find((c) => c.id === 'mercado').orcamentoCentavos = 10000;
  const r = resumoDoMes(e, '2026-10');
  assert.equal(r.total, 111550);
  assert.equal(r.totalAnterior, 79000); // set: aluguel + mercado
  assert.equal(r.variacao, 32550);
  const mercado = r.categorias.find((c) => c.id === 'mercado');
  assert.deepEqual([mercado.total, mercado.anterior, mercado.acimaDoOrcamento], [12000, 9000, true]);
  assert.equal(r.categorias[0].id, 'contas'); // maior gasto primeiro
});

test('gasto de categoria apagada conta em Outros', () => {
  const e = cenario();
  e.categorias = e.categorias.filter((c) => c.id !== 'lazer');
  const r = resumoDoMes(e, '2026-10');
  assert.equal(r.categorias.find((c) => c.id === 'outros').total, 4550);
});

test('caixa desconta gastos lançados, parcelas e o restante da estimativa mensal', () => {
  const e = cenario();
  // depois de 13/10: lazer 45,50 (14/10) + parcela 250 (31/10)
  assert.equal(saldoNoFimDe(projecao(e, HOJE), '2026-10'), 300000 - 4550 - 25000);
  assert.equal(saldoAtual(e, '2026-10-14'), 300000 - 4550);
  e.estimativas = [{ id: 'a', nome: 'Mercado', valorCentavos: 150000 }, { id: 'b', nome: 'Gasolina', valorCentavos: 50000 },
    { id: 'c', nome: 'Aluguel', valorCentavos: null }];
  // outubro: estimativa 2.000 − conhecido 1.115,50 (lançados + aluguel + parcela) = 884,50 no fim do mês
  assert.equal(saldoNoFimDe(projecao(e, HOJE), '2026-10'), 300000 - 4550 - 25000 - 88450);
  // novembro: o mês todo soma a estimativa (aluguel 700 + parcela 250 + restante 1.050)
  const p = projecao(e, HOJE);
  assert.equal(saldoNoFimDe(p, '2026-11') - saldoNoFimDe(p, '2026-10'), -200000);
  // se o conhecido passa da estimativa, não entra nada a mais
  e.estimativas = [{ id: 'a', nome: 'Mercado', valorCentavos: 10000 }];
  assert.equal(saldoNoFimDe(projecao(e, HOJE), '2026-10'), 300000 - 4550 - 25000);
});

test('migração da v2 cria categorias e põe categoria nos fixos', () => {
  const d = migrar({ versao: 2, recorrencias: [{ id: 'r', descricao: 'Net', valorCentavos: 9990, dia: 5, categoria: null }] });
  assert.equal(d.versao, 5);
  assert.equal(d.categorias.length, 11);
  assert.deepEqual(d.dasPagos, {});
  assert.equal(d.recorrencias[0].categoriaId, 'contas');
  assert.deepEqual(d.lancamentos, []);
  assert.ok(d.estimativas.some((x) => x.nome === 'Gasolina' && x.valorCentavos === null));
});
