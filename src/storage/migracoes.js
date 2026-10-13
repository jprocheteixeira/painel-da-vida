// Schema dos dados e migrações. Para mudar o formato: incremente VERSAO_ATUAL e acrescente
// em MIGRACOES a função que leva da versão anterior para a nova. Nunca altere uma migração já publicada.

import { CONTRATO_PADRAO } from '../dominio/contrato.js';
import { completarFeriados } from '../dominio/feriados.js';

export const VERSAO_ATUAL = 1;
export const ANOS_FERIADOS = [2026, 2027];

export function estadoInicial() {
  return {
    versao: VERSAO_ATUAL,
    perfil: { nome: '', cnpj: '', aberturaMei: null },
    contrato: { ...CONTRATO_PADRAO, diasSemana: [...CONTRATO_PADRAO.diasSemana] },
    marcas: {},
    medicoes: {},
    feriados: completarFeriados([], ANOS_FERIADOS),
    meta: { ultimoBackup: null, exemplo: false },
  };
}

/** Migrações: índice i leva da versão i para a i + 1. */
const MIGRACOES = [
  // 0 → 1: primeira versão; parte do estado inicial e aproveita o que existir
  (dados) => ({ ...estadoInicial(), ...dados, versao: 1 }),
];

const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Completa campos que faltam com os padrões (sem apagar nada que já exista). */
function completar(dados) {
  const base = estadoInicial();
  const d = { ...base, ...dados };
  for (const chave of ['perfil', 'contrato', 'meta']) {
    d[chave] = { ...base[chave], ...(ehObjeto(dados[chave]) ? dados[chave] : {}) };
  }
  for (const chave of ['marcas', 'medicoes']) {
    if (!ehObjeto(d[chave])) d[chave] = {};
  }
  if (!Array.isArray(d.feriados)) d.feriados = base.feriados;
  // acrescenta os padrões só de anos que ainda não têm nenhum feriado (respeita exclusões)
  const anosComFeriado = new Set(d.feriados.map((f) => Number(f.data.slice(0, 4))));
  const faltando = ANOS_FERIADOS.filter((a) => !anosComFeriado.has(a));
  if (faltando.length) d.feriados = completarFeriados(d.feriados, faltando);
  return d;
}

/** Leva dados de qualquer versão conhecida para a atual. */
export function migrar(dados) {
  if (!ehObjeto(dados)) throw new Error('Dados inválidos: esperado um objeto.');
  let versao = Number.isInteger(dados.versao) ? dados.versao : 0;
  if (versao > VERSAO_ATUAL) {
    throw new Error(`Estes dados são de uma versão mais nova do app (v${versao}). Atualize a página.`);
  }
  let d = dados;
  while (versao < VERSAO_ATUAL) {
    d = MIGRACOES[versao](d);
    versao += 1;
  }
  return completar(d);
}
