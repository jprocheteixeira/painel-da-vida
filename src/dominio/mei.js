// MEI: DAS mensal (o restante — status, limite e DASN — vem na F4).
// Premissa: o DAS da competência M vence no dia `diaVencimento` do mês M+1; o valor é fixo e editável
// (R$ 86,05 informado pelo usuário para 2026). Para não depender da regra de prorrogação, o LEMBRETE
// usa o último dia útil até o vencimento (se o dia 20 cair num domingo, lembra na sexta).
// Pagamentos ficam em `dasPagos` ({ competencia: data do pagamento }).

import { mesDe, somarMeses, somarDias } from '../utils/datas.js';
import { ehDiaUtil } from './calendario.js';

export const MEI_PADRAO = Object.freeze({
  valorDasCentavos: 8605,
  diaVencimentoDas: 20,
});

/** Vencimento do DAS da competência `mes`. */
export function vencimentoDas(mes, mei = MEI_PADRAO) {
  return `${somarMeses(mes, 1)}-${String(mei.diaVencimentoDas).padStart(2, '0')}`;
}

/** DAS das competências desde a abertura até `ateMes` (inclusive). */
export function dasDoPeriodo(aberturaMei, ateMes, mei = MEI_PADRAO) {
  if (!aberturaMei) return [];
  const lista = [];
  for (let m = mesDe(aberturaMei); m <= ateMes; m = somarMeses(m, 1)) {
    lista.push({ competencia: m, vencimento: vencimentoDas(m, mei), valorCentavos: mei.valorDasCentavos });
  }
  return lista;
}

/** Último dia útil até o vencimento (data segura para pagar). */
export function dataLembreteDas(vencimento, feriados) {
  let d = vencimento;
  while (!ehDiaUtil(d, feriados)) d = somarDias(d, -1);
  return d;
}

/**
 * DAS com situação, da abertura até `ateMes`:
 * [{ competencia, vencimento, pagarAte, valorCentavos, pagoEm }]
 */
export function situacaoDas(estado, ateMes) {
  const pagos = estado.dasPagos || {};
  return dasDoPeriodo(estado.perfil.aberturaMei, ateMes, estado.mei).map((d) => ({
    ...d,
    pagarAte: dataLembreteDas(d.vencimento, estado.feriados),
    pagoEm: pagos[d.competencia] || null,
  }));
}
