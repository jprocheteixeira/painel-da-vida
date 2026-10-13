// Fluxo de caixa: competência × caixa, projeção de saldo e simulador "e se".
//
// Fluxo = { data, valorCentavos (com sinal), descricao, origem }.
// Premissas:
// - o saldo informado nas contas vale no fim do dia `caixa.saldoEm`; só entram fluxos depois dessa data;
// - recebimento entra na data de pagamento real; se ainda não pago, na data prevista;
// - competência em andamento usa os dias previstos (marcados + sugeridos de hoje em diante);
// - DAS e gastos fixos são considerados pagos no vencimento.

import { mesDe, somarMeses, intervaloMeses, ultimoDiaDoMes } from '../utils/datas.js';
import { somar } from '../utils/dinheiro.js';
import { linhaDoTempo } from './prazos.js';
import { dasDoPeriodo } from './mei.js';

export const CAIXA_PADRAO = Object.freeze({
  saldoEm: null,
  reservaMinimaCentavos: 100000,
  horizonte: '2027-03',
});

/** Valor de uma competência: o medido, se o boletim já saiu; senão o previsto. */
function valorDaCompetencia(linha) {
  return linha.medicao.estado === 'trabalhando' ? linha.valorPrevistoCentavos : linha.valorCentavos;
}

/** Recebimentos do contrato, um por competência com valor. */
export function recebimentos(estado, hoje) {
  const { contrato, feriados, marcas, medicoes } = estado;
  return linhaDoTempo({ contrato, feriados, marcas, medicoes }, hoje)
    .filter((l) => valorDaCompetencia(l) > 0)
    .map((l) => ({
      data: l.datas.pagamento.data,
      valorCentavos: valorDaCompetencia(l),
      competencia: l.mes,
      real: l.datas.pagamento.real,
      previsto: l.medicao.estado === 'trabalhando',
      descricao: `Recebimento PJ · competência ${l.mes}`,
      origem: 'pj',
    }));
}

/** Ocorrências de um gasto fixo mensal entre dois meses. */
export function ocorrenciasRecorrencia(rec, deMes, ateMes) {
  const lista = [];
  const inicio = rec.inicio ? mesDe(rec.inicio) : deMes;
  const fim = rec.fim ? mesDe(rec.fim) : ateMes;
  for (let m = deMes > inicio ? deMes : inicio; m <= ateMes && m <= fim; m = somarMeses(m, 1)) {
    const ultimo = Number(ultimoDiaDoMes(m).slice(8));
    const dia = String(Math.min(rec.dia || 1, ultimo)).padStart(2, '0');
    lista.push({ data: `${m}-${dia}`, valorCentavos: -Math.abs(rec.valorCentavos), descricao: rec.descricao, origem: 'fixo' });
  }
  return lista;
}

/** Todos os fluxos previstos/realizados até o fim do horizonte. */
export function fluxos(estado, hoje) {
  const { caixa } = estado;
  const deMes = caixa.saldoEm ? mesDe(caixa.saldoEm) : mesDe(hoje);
  const ateMes = caixa.horizonte;
  const das = dasDoPeriodo(estado.perfil.aberturaMei, ateMes, estado.mei).map((d) => ({
    data: d.vencimento, valorCentavos: -d.valorCentavos, descricao: `DAS ${d.competencia}`, origem: 'das',
  }));
  const fixos = estado.recorrencias.flatMap((r) => ocorrenciasRecorrencia(r, deMes, ateMes));
  return [...recebimentos(estado, hoje), ...das, ...fixos]
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

/** Competência × caixa por mês: o que foi ganho (trabalhado) e o que efetivamente entra. */
export function competenciaVsCaixa(estado, hoje) {
  const recs = recebimentos(estado, hoje);
  if (!recs.length) return [];
  const primeiro = recs[0].competencia;
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
 * Simulador "e se": muda o prazo de pagamento e/ou os dias por semana (só para os dias futuros
 * ainda não marcados) e devolve o saldo no fim do `mesAlvo`.
 * diasPorSemana usa os primeiros N dias da semana do contrato (ex.: ter e qua para 2).
 */
export function simular(estado, hoje, { prazoPagamentoDias, diasPorSemana }, mesAlvo) {
  const contrato = { ...estado.contrato };
  if (prazoPagamentoDias != null) contrato.prazoPagamentoDias = prazoPagamentoDias;
  if (diasPorSemana != null) contrato.diasSemana = [...estado.contrato.diasSemana].sort().slice(0, diasPorSemana);
  const proj = projecao({ ...estado, contrato }, hoje);
  return saldoNoFimDe(proj, mesAlvo);
}

/** Grade do simulador: prazos × dias por semana, com a diferença para o cenário atual. */
export function gradeSimulador(estado, hoje, mesAlvo, prazos = [15, 30, 45], dias = [2, 3]) {
  const atual = saldoNoFimDe(projecao(estado, hoje), mesAlvo);
  return {
    atual,
    linhas: prazos.map((prazo) => ({
      prazo,
      celulas: dias.map((d) => {
        const saldo = simular(estado, hoje, { prazoPagamentoDias: prazo, diasPorSemana: d }, mesAlvo);
        return { dias: d, saldo, diferenca: saldo == null || atual == null ? null : saldo - atual };
      }),
    })),
  };
}

