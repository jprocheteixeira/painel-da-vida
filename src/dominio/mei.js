// MEI: DAS mensal (o restante — status, limite e DASN — vem na F4).
// Premissa: o DAS da competência M vence no dia `diaVencimento` do mês M+1; o valor é fixo e editável
// (R$ 86,05 informado pelo usuário para 2026). Se o vencimento cair em dia não útil, mantém-se a data
// (a regra oficial de prorrogação fica como conferência na F4).

import { mesDe, somarMeses } from '../utils/datas.js';

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
