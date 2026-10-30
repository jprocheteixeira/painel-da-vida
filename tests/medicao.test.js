import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completarFeriados } from '../src/dominio/feriados.js';
import { CONTRATO_PADRAO, DIA } from '../src/dominio/contrato.js';
import {
  novaMedicao, avancar, voltar, proximoEstado, datasChave, textoNF, textoBoletim, resumoMedicao,
} from '../src/dominio/medicao.js';
import { gerarItens } from '../src/dominio/oc.js';
import { tarefasPJ, tarefaAceite, proximosPrazos, urgencia } from '../src/dominio/prazos.js';

// valores fictícios (nº da OC e código do item inventados)
const feriados = completarFeriados([], [2026, 2027]);
const contrato = {
  ...CONTRATO_PADRAO, inicio: '2026-10-13', fim: '2027-04-15', dataEntradaOC: '2026-10-15',
  numeroOC: '9999999', codigoItemOC: 'ABC000000001',
  itensOC: gerarItens({ quantidade: 6, valorCentavos: 260000, primeiroDespacho: '2026-11-15' }),
};
const dias = ['2026-10-14', '2026-10-15', '2026-10-20', '2026-10-21', '2026-10-22', '2026-11-03'];
const marcas = Object.fromEntries(dias.map((d) => [d, DIA.TRABALHADO]));

test('máquina de estados guarda a data de cada etapa', () => {
  let m = novaMedicao('2026-11');
  assert.equal(proximoEstado(m).id, 'boletim_enviado');
  m = avancar(m, '2026-11-13');
  m = avancar(m, '2026-11-17');
  assert.equal(m.estado, 'aprovado');
  assert.deepEqual(m.historico, { boletim_enviado: '2026-11-13', aprovado: '2026-11-17' });
  assert.throws(() => avancar(m, '2026-11-16'), /anterior a 17\/11\/2026/);
  m = voltar(m);
  assert.equal(m.estado, 'boletim_enviado');
  assert.deepEqual(m.historico, { boletim_enviado: '2026-11-13' });
  for (const d of ['2026-11-17', '2026-11-18', '2026-11-18', '2026-12-21']) m = avancar(m, d, { contrato, medicoes: {} });
  assert.equal(m.estado, 'pago');
  assert.equal(m.itemOC, 1);
  assert.throws(() => avancar(m, '2026-12-22'), /já está paga/);
});

test('NF só dentro da janela 15–20: depois do dia 20 é recusada', () => {
  const aprovada = avancar(avancar(novaMedicao('2026-11'), '2026-11-13'), '2026-11-13');
  const op = { contrato, medicoes: {} };
  assert.throws(() => avancar(aprovada, '2026-11-14', op), /só abre em 15\/11\/2026/);
  assert.throws(() => avancar(aprovada, '2026-11-21', op), /recusada/);
  assert.throws(() => avancar(aprovada, '2026-11-30', op), /do dia 15 ao dia 20/);
  assert.equal(avancar(aprovada, '2026-11-15', op).estado, 'nf_emitida');
  assert.equal(avancar(aprovada, '2026-11-20', op).estado, 'nf_emitida');
  // perdeu a janela: vale a do mês seguinte
  assert.equal(avancar(aprovada, '2026-12-18', op).estado, 'nf_emitida');
  assert.throws(() => avancar(aprovada, '2026-12-21', op), /recusada/);
  // desfazer a emissão solta o item
  assert.equal(voltar(avancar(aprovada, '2026-11-18', op)).itemOC, undefined);
});

test('uma nota por item da OC e nenhuma em mês sem item', () => {
  const aprovada = avancar(avancar(novaMedicao('2026-11'), '2026-11-13'), '2026-11-13');
  const medicoes = { '2026-12': { mes: '2026-12', estado: 'nf_emitida', itemOC: 1, historico: {} } };
  assert.throws(() => avancar(aprovada, '2026-11-18', { contrato, medicoes }), /item 1 já tem nota emitida/);
  const semItem = avancar(avancar(novaMedicao('2027-06'), '2027-06-01'), '2027-06-02');
  assert.throws(() => avancar(semItem, '2027-06-16', { contrato, medicoes: {} }), /não tem item na OC/);
});

test('datas do item 1: janela 15–20/11 e pagamento em intervalo', () => {
  const d = datasChave('2026-11', { contrato, feriados, medicao: novaMedicao('2026-11'), hoje: '2026-10-30' });
  assert.deepEqual(d.periodo, { inicio: '2026-10-13', fim: '2026-11-15' });
  assert.equal(d.envioBoletim.prazo, '2026-11-13'); // 14 e 15/11 (feriado) caem no fim de semana
  assert.equal(d.aprovacao.prazo, '2026-11-18');
  assert.deepEqual([d.janela.abre, d.janela.lembrete, d.janela.limite], ['2026-11-15', '2026-11-18', '2026-11-20']);
  assert.equal(d.emissaoNF.data, '2026-11-20'); // previsão conservadora: último dia da janela
  assert.equal(d.pagamento.data, '2026-12-21'); // 20/11 + 30 = 20/12 (domingo) → 21/12
  assert.equal(d.pagamento.maisCedo, '2026-12-15'); // emitida no dia 15
  assert.equal(d.pagamento.maisTarde, '2026-12-21');
  assert.equal(d.perdida, false);
  // dentro da janela, o mais cedo é hoje
  const d17 = datasChave('2026-11', { contrato, feriados, medicao: novaMedicao('2026-11'), hoje: '2026-11-17' });
  assert.equal(d17.pagamento.maisCedo, '2026-12-17');
});

test('perdeu a janela: só no mês seguinte, com novo recebimento', () => {
  const m = avancar(avancar(novaMedicao('2026-11'), '2026-11-13'), '2026-11-18');
  const d = datasChave('2026-11', { contrato, feriados, medicao: m, hoje: '2026-11-21' });
  assert.equal(d.perdida, true);
  assert.deepEqual([d.janela.abre, d.janela.limite], ['2026-12-15', '2026-12-20']);
  assert.equal(d.emissaoNF.data, '2026-12-20');
  assert.equal(d.pagamento.data, '2027-01-19');
  assert.equal(d.pagamento.maisCedo, '2027-01-14');
  // NF real emitida: data e pagamento reais, sem intervalo
  const emitida = avancar(m, '2026-11-19', { contrato, medicoes: {} });
  const r = datasChave('2026-11', { contrato, feriados, medicao: emitida, hoje: '2026-11-21' });
  assert.equal(r.perdida, false);
  assert.equal(r.emissaoNF.real, true);
  assert.equal(r.pagamento.data, '2026-12-21'); // 19/11 + 30 = 19/12 (sábado) → 21/12
  assert.equal(r.pagamento.maisCedo, r.pagamento.maisTarde);
});

test('texto da NFS-e no formato da OC e boletim com valor fixo', () => {
  assert.equal(textoNF('2026-12', { contrato }), 'OC 9999999 – Item 2 – ABC000000001 – Contratação de serviço técnico '
    + 'de apoio a estruturação da confiabilidade da manutenção – Mês 2');
  assert.match(textoNF('2026-11', { contrato: { ...contrato, numeroOC: '' } }), /^OC \[PENDENTE\] – Item 1 – /);
  const r = resumoMedicao('2026-11', { contrato, marcas });
  assert.equal(r.valorCentavos, 260000); // fixo, não depende dos 6 dias marcados
  assert.equal(r.dias.length, 6);
  assert.equal(resumoMedicao('2026-12', { contrato, marcas }).valorCentavos, 260000); // sem dias marcados
  const b = textoBoletim('2026-11', { contrato, perfil: { nome: 'Fulano' }, marcas, medicao: { resumo: 'Planos.' } });
  assert.match(b, /Item 1 \(Mês 1\)/);
  assert.match(b, /Ordem de Compra nº 9999999 — Item 1/);
  assert.match(b, /Dias de atividade presencial \(6, informativo\):/);
  assert.match(b, /Valor do item: R\$ 2\.600,00 \(valor fixo mensal da OC\)/);
  assert.match(b, /Relatório mensal de atividades:\nPlanos\./);
  // sem dias marcados (opcional): o boletim sai sem a lista, com o mesmo valor
  const semDias = textoBoletim('2026-12', { contrato, perfil: {}, marcas: {}, medicao: {} });
  assert.doesNotMatch(semDias, /Dias de atividade/);
  assert.match(semDias, /Valor do item: R\$ 2\.600,00/);
});

test('lembretes: janela abre no dia 15, lembrete forte no 18, último dia no 20', () => {
  const medicoes = { '2026-11': avancar(novaMedicao('2026-11'), '2026-11-13') };
  const tarefas = tarefasPJ({ contrato, feriados, marcas, medicoes }, '2026-11-14');
  const doItem1 = tarefas.filter((t) => t.item === 1).map((t) => [t.id, t.data]);
  assert.deepEqual(doItem1, [
    ['pj:2026-11:nf-abre:2026-11', '2026-11-15'],
    ['pj:2026-11:aprovacao', '2026-11-18'],
    ['pj:2026-11:nf-forte:2026-11', '2026-11-18'],
    ['pj:2026-11:nf-ultimo:2026-11', '2026-11-20'],
  ]);
  assert.ok(tarefas.some((t) => t.id === 'pj:2026-12:boletim' && t.data === '2026-12-15'));
  assert.ok(tarefas.some((t) => t.id === 'pj:2027-04:nf-ultimo:2027-04' && t.data === '2027-04-20'));
  const prox = proximosPrazos(tarefas, '2026-11-14', 7);
  assert.equal(prox.filter((t) => t.item === 1).length, 4);
  assert.equal(urgencia('2026-11-13', '2026-11-14'), 'atrasado');
  assert.equal(urgencia('2026-11-17', '2026-11-14'), 'proximo');
});

test('perdeu a janela vira alerta e lembra da janela seguinte', () => {
  const medicoes = { '2026-11': avancar(avancar(novaMedicao('2026-11'), '2026-11-13'), '2026-11-17') };
  const tarefas = tarefasPJ({ contrato, feriados, marcas, medicoes }, '2026-11-21');
  const perdeu = tarefas.find((t) => t.id === 'pj:2026-11:perdeu');
  assert.match(perdeu.titulo, /Perdeu a janela da NF do item 1: só no próximo mês/);
  assert.match(perdeu.detalhe, /15\/12 a 20\/12; recebe entre 14\/01 e 19\/01/);
  assert.equal(proximosPrazos([perdeu], '2026-11-21')[0].urgencia, 'atrasado');
  assert.ok(tarefas.some((t) => t.id === 'pj:2026-11:nf-abre:2026-12' && t.data === '2026-12-15'));
});

test('tarefa de aceite da OC até ser marcada como enviada', () => {
  assert.deepEqual(tarefaAceite(contrato, '2026-10-30').map((t) => [t.titulo, t.data]),
    [['Enviar aceite da OC por e-mail', '2026-10-30']]);
  assert.deepEqual(tarefaAceite({ ...contrato, aceiteEnviadoEm: '2026-10-30' }, '2026-10-31'), []);
  assert.deepEqual(tarefaAceite({ ...contrato, itensOC: [] }, '2026-10-30'), []);
});
