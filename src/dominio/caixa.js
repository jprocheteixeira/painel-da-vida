// Fluxo de caixa: competência × caixa, projeção de saldo e simulador "e se".
//
// Fluxo = { data, valorCentavos (com sinal), descricao, origem }.
// Premissas:
// - o saldo informado nas contas vale no fim do dia `caixa.saldoEm`; só entram fluxos depois dessa data;
// - um recebimento por item da OC, no valor fixo do item, na data de pagamento real; se ainda não pago,
//   na data prevista (emissão prevista na janela 15–20 + prazo, passando para o próximo dia útil);
// - DAS, gastos fixos e parcelas são considerados pagos no vencimento;
// - gastos lançados entram na data do lançamento;
// - a estimativa mensal de gastos (soma de `estimativas`) é um PISO do mês: no último dia de cada mês
//   entra só a diferença entre a estimativa e o que já se conhece do mês (lançados + fixos + parcelas),
//   para não contar duas vezes.

import { mesDe, intervaloMeses, ultimoDiaDoMes } from '../utils/datas.js';
import { somar } from '../utils/dinheiro.js';
import { linhaDoTempo } from './prazos.js';
import { dasDoPeriodo, dasDeTerceiro } from './mei.js';
import { ocorrenciasFixo, ocorrenciasParcelamento, gastoConhecidoNoMes, totalEstimativa } from './gastos.js';

export const CAIXA_PADRAO = Object.freeze({
  saldoEm: null,
  reservaMinimaCentavos: 100000,
  horizonte: '2027-06', // o último item da OC é pago por volta de maio
});

/**
 * Recebimentos da OC, um por item: { data, maisCedo, maisTarde, valorCentavos, competencia (mês do item), … }.
 * maisCedo/maisTarde: intervalo do pagamento conforme a NF saia no início ou no fim da janela.
 */
export function recebimentos(estado, hoje) {
  const { contrato, feriados, marcas, medicoes } = estado;
  return linhaDoTempo({ contrato, feriados, marcas, medicoes }, hoje)
    .filter((l) => l.valorCentavos > 0)
    .map((l) => ({
      data: l.datas.pagamento.data,
      maisCedo: l.datas.pagamento.real ? l.datas.pagamento.data : l.datas.pagamento.maisCedo,
      maisTarde: l.datas.pagamento.real ? l.datas.pagamento.data : l.datas.pagamento.maisTarde,
      valorCentavos: l.valorCentavos,
      competencia: l.mes,
      item: l.item.n,
      real: l.datas.pagamento.real,
      previsto: l.medicao.estado === 'trabalhando',
      perdida: l.datas.perdida,
      descricao: `Recebimento PJ · item ${l.item.n} da OC`,
      origem: 'pj',
    }))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Ocorrências de um gasto fixo mensal entre dois meses, como saídas de caixa. */
export function ocorrenciasRecorrencia(rec, deMes, ateMes) {
  return ocorrenciasFixo(rec, deMes, ateMes)
    .map((o) => ({ data: o.data, valorCentavos: -o.valorCentavos, descricao: rec.descricao, origem: 'fixo' }));
}

/** Restante da estimativa mensal: um fluxo no último dia de cada mês, do mês atual em diante. */
function gastoVariavelPrevisto(estado, hoje, deMes, ateMes) {
  const estimativa = totalEstimativa(estado.estimativas);
  if (!estimativa) return [];
  const mesAtual = mesDe(hoje);
  return intervaloMeses(deMes > mesAtual ? deMes : mesAtual, ateMes).map((m) => {
    const valor = Math.max(0, estimativa - gastoConhecidoNoMes(estado, m));
    return { data: ultimoDiaDoMes(m), valorCentavos: -valor, descricao: 'Restante da estimativa de gastos', origem: 'previsto' };
  }).filter((f) => f.valorCentavos !== 0);
}

/** Todos os fluxos previstos/realizados até o fim do horizonte. */
export function fluxos(estado, hoje) {
  const { caixa } = estado;
  const deMes = caixa.saldoEm ? mesDe(caixa.saldoEm) : mesDe(hoje);
  const ateMes = caixa.horizonte;
  const pagos = estado.dasPagos || {};
  const das = dasDoPeriodo(estado.perfil.aberturaMei, ateMes, estado.mei)
    .filter((d) => !dasDeTerceiro(estado, d.competencia)).map((d) => ({
    data: pagos[d.competencia] || d.vencimento, valorCentavos: -d.valorCentavos, descricao: `DAS ${d.competencia}`, origem: 'das',
  }));
  const fixos = estado.recorrencias.flatMap((r) => ocorrenciasRecorrencia(r, deMes, ateMes));
  const parcelas = estado.parcelamentos.flatMap((p) => ocorrenciasParcelamento(p)
    .map((o) => ({ data: o.data, valorCentavos: -o.valorCentavos, descricao: `${p.descricao} (${o.n}/${o.total})`, origem: 'parcela' })));
  const lancados = estado.lancamentos.map((l) => ({
    data: l.data, valorCentavos: -l.valorCentavos, descricao: l.nota || 'Gasto', origem: 'gasto',
  }));
  const variavel = gastoVariavelPrevisto(estado, hoje, deMes, ateMes);
  return [...recebimentos(estado, hoje), ...das, ...fixos, ...parcelas, ...lancados, ...variavel]
    .filter((f) => mesDe(f.data) <= ateMes)
    .sort((a, b) => a.data.localeCompare(b.data));
}

export function saldoInformado(estado) {
  return somar(estado.contas.map((c) => c.saldoCentavos || 0));
}

/**
 * Projeção mês a mês: [{ mes, entradas, saidas, saldoFinal, abaixoDaReserva }].
 * Começa no mês do saldo informado (ou no mês atual) e vai até o horizonte.
 */
export function projecao(estado, hoje) {
  const base = estado.caixa.saldoEm || hoje;
  const meses = intervaloMeses(mesDe(base), estado.caixa.horizonte);
  const lista = fluxos(estado, hoje).filter((f) => f.data > base);
  let saldo = saldoInformado(estado);
  return meses.map((mes) => {
    const doMes = lista.filter((f) => mesDe(f.data) === mes);
    const entradas = somar(doMes.filter((f) => f.valorCentavos > 0).map((f) => f.valorCentavos));
    const saidas = somar(doMes.filter((f) => f.valorCentavos < 0).map((f) => f.valorCentavos));
    saldo += entradas + saidas;
    return {
      mes, entradas, saidas, saldoFinal: saldo, fluxos: doMes,
      abaixoDaReserva: saldo < estado.caixa.reservaMinimaCentavos,
    };
  });
}

/** Saldo projetado no fim de um mês (ou null se fora da projeção). */
export function saldoNoFimDe(proj, mes) {
  return proj.find((p) => p.mes === mes)?.saldoFinal ?? null;
}

/** Saldo de hoje: o informado mais os fluxos entre a data do saldo e hoje. */
export function saldoAtual(estado, hoje) {
  const base = estado.caixa.saldoEm;
  const extra = base
    ? somar(fluxos(estado, hoje).filter((f) => f.data > base && f.data <= hoje).map((f) => f.valorCentavos))
    : 0;
  return saldoInformado(estado) + extra;
}

/** Competência × caixa por mês: o valor do item do mês (fixo) e o que efetivamente entra na conta. */
export function competenciaVsCaixa(estado, hoje) {
  const recs = recebimentos(estado, hoje);
  if (!recs.length) return [];
  const primeiro = recs.map((r) => r.competencia).sort()[0];
  const ultimo = [...recs.map((r) => mesDe(r.data)), estado.caixa.horizonte].sort().at(-1);
  return intervaloMeses(primeiro, ultimo).map((mes) => ({
    mes,
    competencia: somar(recs.filter((r) => r.competencia === mes).map((r) => r.valorCentavos)),
    caixa: somar(recs.filter((r) => mesDe(r.data) === mes).map((r) => r.valorCentavos)),
    competenciaPrevista: recs.some((r) => r.competencia === mes && r.previsto),
    caixaPrevisto: recs.some((r) => mesDe(r.data) === mes && !r.real),
  }));
}

/**
 * Simulador "e se": muda o prazo de pagamento, o dia de emissão dentro da janela (15–20) e/ou a base
 * de contagem (só para as notas ainda não emitidas) e devolve o saldo no fim do `mesAlvo`.
 * Dias por semana não mudam a receita: o valor de cada item da OC é fixo.
 */
export function simular(estado, hoje, { prazoPagamentoDias, diaEmissao, basePrazo }, mesAlvo) {
  const contrato = { ...estado.contrato };
  if (prazoPagamentoDias != null) contrato.prazoPagamentoDias = prazoPagamentoDias;
  if (diaEmissao != null) contrato.diaEmissaoPrevisto = diaEmissao;
  if (basePrazo) contrato.basePrazo = basePrazo;
  const proj = projecao({ ...estado, contrato }, hoje);
  return saldoNoFimDe(proj, mesAlvo);
}

/** Grade do simulador: prazos × dia de emissão, numa base de contagem, com a diferença para o cenário atual. */
export function gradeSimulador(estado, hoje, mesAlvo, {
  prazos = [15, 30, 45, 60], dias = [estado.contrato.nfDiaAbre, estado.contrato.nfDiaLimite], basePrazo = estado.contrato.basePrazo,
} = {}) {
  const atual = saldoNoFimDe(projecao(estado, hoje), mesAlvo);
  return {
    atual,
    basePrazo,
    linhas: prazos.map((prazo) => ({
      prazo,
      celulas: dias.map((d) => {
        const saldo = simular(estado, hoje, { prazoPagamentoDias: prazo, diaEmissao: d, basePrazo }, mesAlvo);
        return { dia: d, saldo, diferenca: saldo == null || atual == null ? null : saldo - atual };
      }),
    })),
  };
}
