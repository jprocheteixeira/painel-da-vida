// Dias úteis: segunda a sexta, menos os feriados ativos da lista.

import { diaDaSemana, somarDias, ultimoDiaDoMes, primeiroDiaDoMes } from '../utils/datas.js';
import { feriadoEm } from './feriados.js';

export function ehFimDeSemana(iso) {
  const d = diaDaSemana(iso);
  return d === 0 || d === 6;
}

export function ehDiaUtil(iso, feriados) {
  return !ehFimDeSemana(iso) && !feriadoEm(iso, feriados);
}

/** O próprio dia, se útil; senão o próximo dia útil. */
export function proximoDiaUtil(iso, feriados) {
  let d = iso;
  while (!ehDiaUtil(d, feriados)) d = somarDias(d, 1);
  return d;
}

export function ultimoDiaUtil(mes, feriados) {
  let d = ultimoDiaDoMes(mes);
  while (!ehDiaUtil(d, feriados)) d = somarDias(d, -1);
  return d;
}

/** n-ésimo dia útil do mês (n ≥ 1). */
export function nesimoDiaUtil(mes, n, feriados) {
  if (!Number.isInteger(n) || n < 1) throw new RangeError('n deve ser inteiro ≥ 1');
  let d = primeiroDiaDoMes(mes);
  let contados = 0;
  for (;;) {
    if (ehDiaUtil(d, feriados) && ++contados === n) return d;
    d = somarDias(d, 1);
  }
}

/** Soma dias corridos e, se cair em dia não útil, passa para o próximo dia útil. */
export function somarDiasCorridosAteUtil(iso, dias, feriados) {
  return proximoDiaUtil(somarDias(iso, dias), feriados);
}
