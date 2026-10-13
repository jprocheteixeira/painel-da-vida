// Schema dos dados e migrações. Para mudar o formato: incremente VERSAO_ATUAL e acrescente
// em MIGRACOES a função que leva da versão anterior para a nova. Nunca altere uma migração já publicada.

import { CONTRATO_PADRAO } from '../dominio/contrato.js';
import { completarFeriados } from '../dominio/feriados.js';
import { CAIXA_PADRAO } from '../dominio/caixa.js';
import { MEI_PADRAO } from '../dominio/mei.js';

export const VERSAO_ATUAL = 2;
export const ANOS_FERIADOS = [2026, 2027];

export function contasPadrao() {
  return [
    { id: 'pj', nome: 'Conta PJ', saldoCentavos: 0 },
    { id: 'pessoal', nome: 'Conta pessoal', saldoCentavos: 0 },
  ];
}

export function estadoInicial() {
  return {
    versao: VERSAO_ATUAL,
    perfil: { nome: '', cnpj: '', aberturaMei: null },
    contrato: { ...CONTRATO_PADRAO, diasSemana: [...CONTRATO_PADRAO.diasSemana] },
    marcas: {},
    medicoes: {},
    feriados: completarFeriados([], ANOS_FERIADOS),
    contas: contasPadrao(),
    recorrencias: [],
    caixa: { ...CAIXA_PADRAO },
    mei: { ...MEI_PADRAO },
    meta: { ultimoBackup: null, exemplo: false },
  };
}

/** Migrações: índice i leva da versão i para a i + 1. */
const MIGRACOES = [
  // 0 → 1: primeira versão; parte do estado inicial e aproveita o que existir
  (dados) => ({ ...estadoInicial(), ...dados, versao: 1 }),
  // 1 → 2: contas, gastos fixos, parâmetros de caixa e do MEI (preenchidos com os padrões)
  (dados) => ({ ...dados, versao: 2 }),
];

const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Completa campos que faltam com os padrões (sem apagar nada que já exista). */
function completar(dados) {
  const base = estadoInicial();
  const d = { ...base, ...dados };
  for (const chave of ['perfil', 'contrato', 'caixa', 'mei', 'meta']) {
    d[chave] = { ...base[chave], ...(ehObjeto(dados[chave]) ? dados[chave] : {}) };
  }
  for (const chave of ['marcas', 'medicoes']) {
    if (!ehObjeto(d[chave])) d[chave] = {};
  }
  if (!Array.isArray(d.feriados)) d.feriados = base.feriados;
  if (!Array.isArray(d.contas) || !d.contas.length) d.contas = base.contas;
  if (!Array.isArray(d.recorrencias)) d.recorrencias = [];
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
