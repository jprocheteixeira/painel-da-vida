import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completarFeriados } from '../src/dominio/feriados.js';
import { CONTRATO_PADRAO, DIA } from '../src/dominio/contrato.js';
import {
  novaMedicao, avancar, voltar, proximoEstado, datasChave, textoNF, textoBoletim, resumoMedicao,
} from '../src/dominio/medicao.js';
import { tarefasPJ, proximosPrazos, urgencia } from '../src/dominio/prazos.js';

const feriados = completarFeriados([], [2026, 2027]);
const contrato = { ...CONTRATO_PADRAO, inicio: '2026-10-14', fim: '2027-04-13', pedidoCompra: '4500123' };
const outubro = ['2026-10-14', '2026-10-15', '2026-10-20', '2026-10-21', '2026-10-22',
  '2026-10-27', '2026-10-28', '2026-10-29'];
const marcas = Object.fromEntries(outubro.map((d) => [d, DIA.TRABALHADO]));

test('máquina de estados guarda a data de cada etapa', () => {
  let m = novaMedicao('2026-10');
  assert.equal(proximoEstado(m).id, 'boletim_enviado');
  m = avancar(m, '2026-10-30');
  m = avancar(m, '2026-11-05');
  assert.equal(m.estado, 'aprovado');
  assert.deepEqual(m.historico, { boletim_enviado: '2026-10-30', aprovado: '2026-11-05' });
  assert.throws(() => avancar(m, '2026-11-01'), /anterior a 05\/11\/2026/);
  m = voltar(m);
  assert.equal(m.estado, 'boletim_enviado');
  assert.deepEqual(m.historico, { boletim_enviado: '2026-10-30' });
  for (const d of ['2026-11-04', '2026-11-04', '2026-11-04', '2026-12-04']) m = avancar(m, d);
  assert.equal(m.estado, 'pago');
  assert.throws(() => avancar(m, '2026-12-05'), /já está paga/);
});

test('datas previstas de outubro/2026', () => {
  const d = datasChave('2026-10', { contrato, feriados, medicao: novaMedicao('2026-10') });
  assert.equal(d.envioBoletim.prazo, '2026-10-30');
  assert.equal(d.aprovacao.prazo, '2026-11-09');
  assert.equal(d.emissaoNF.data, '2026-11-09');
  assert.equal(d.pagamento.data, '2026-12-10'); // 09/12 é feriado em Guarapuava
  assert.equal(d.pagamento.real, false);
});

test('datas reais substituem as previstas', () => {
  let m = novaMedicao('2026-10');
  m = avancar(m, '2026-10-30');
  m = avancar(m, '2026-11-04');
  let d = datasChave('2026-10', { contrato, feriados, medicao: m });
  assert.equal(d.aprovacao.data, '2026-11-04');
  assert.equal(d.pagamento.data, '2026-12-04'); // emissão prevista = aprovação real
  m = avancar(m, '2026-11-06');
  d = datasChave('2026-10', { contrato: { ...contrato, prazoPagamentoDias: 15 }, feriados, medicao: m });
  assert.equal(d.emissaoNF.real, true);
  assert.equal(d.pagamento.data, '2026-11-23'); // 21/11 é sábado
});

test('texto da NFS-e e do boletim', () => {
  const nf = textoNF('2026-10', { contrato, marcas });
  assert.equal(nf, 'Preparação de documentos e apoio técnico-administrativo: organização de bases de dados, '
    + 'cadastros e controles. Pedido de compra nº 4500123. Período: 14/10/2026 a 31/10/2026. '
    + '8 dias de serviço × R$ 200,00.');
  assert.match(textoNF('2026-10', { contrato: { ...contrato, pedidoCompra: '' }, marcas }), /\[PENDENTE\]/);
  const b = textoBoletim('2026-10', { contrato, perfil: { nome: 'Fulano' }, marcas,
    medicao: { resumo: 'Cadastros.' } });
  assert.match(b, /Total: 8 dias × R\$ 200,00 = R\$ 1\.600,00/);
  assert.match(b, /- 14\/10\/2026 \(qua\)/);
  assert.match(b, /Resumo das atividades:\nCadastros\./);
  assert.equal(resumoMedicao('2026-10', { contrato, marcas }).valorCentavos, 160000);
});

test('prazos automáticos seguem a etapa de cada mês', () => {
  const medicoes = { '2026-10': avancar(novaMedicao('2026-10'), '2026-10-30') };
  const tarefas = tarefasPJ({ contrato, feriados, marcas, medicoes }, '2026-11-02');
  assert.equal(tarefas[0].id, 'pj:2026-10:aprovacao');
  assert.equal(tarefas[0].data, '2026-11-09');
  assert.equal(tarefas[1].id, 'pj:2026-11:boletim');
  assert.equal(tarefas[1].data, '2026-11-30');
  const prox = proximosPrazos(tarefas, '2026-11-02', 14);
  assert.deepEqual(prox.map((t) => t.id), ['pj:2026-10:aprovacao']);
  assert.equal(urgencia('2026-11-01', '2026-11-02'), 'atrasado');
  assert.equal(urgencia('2026-11-04', '2026-11-02'), 'proximo');
});
