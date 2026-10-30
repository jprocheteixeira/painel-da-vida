// Schema dos dados e migrações. Para mudar o formato: incremente VERSAO_ATUAL e acrescente
// em MIGRACOES a função que leva da versão anterior para a nova. Nunca altere uma migração já publicada.

import { CONTRATO_PADRAO } from '../dominio/contrato.js';
import { completarFeriados } from '../dominio/feriados.js';
import { CAIXA_PADRAO } from '../dominio/caixa.js';
import { MEI_PADRAO } from '../dominio/mei.js';
import { categoriasPadrao, estimativasPadrao } from '../dominio/gastos.js';
import { pendenciasPadrao } from '../dominio/pendencias.js';
import { somarMeses } from '../utils/datas.js';

export const VERSAO_ATUAL = 6;
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
    categorias: categoriasPadrao(),
    lancamentos: [],
    parcelamentos: [],
    estimativas: estimativasPadrao(),
    dasPagos: {},
    dasTerceiros: {},
    pendencias: pendenciasPadrao(),
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
  // 2 → 3: gastos (categorias, lançamentos, parcelados, estimativa mensal); gasto fixo ganha categoria
  (dados) => ({
    ...dados,
    versao: 3,
    recorrencias: (dados.recorrencias || []).map((r) => ({ ...r, categoriaId: r.categoriaId || r.categoria || 'contas' })),
  }),
  // 3 → 4: DAS entra nos gastos (categoria "Impostos (MEI)") e ganha registro de pagamento
  (dados) => {
    const categorias = Array.isArray(dados.categorias) ? [...dados.categorias] : undefined;
    if (categorias && !categorias.some((c) => c.id === 'impostos')) {
      const iOutros = categorias.findIndex((c) => c.id === 'outros');
      const nova = { id: 'impostos', nome: 'Impostos (MEI)', orcamentoCentavos: null };
      if (iOutros < 0) categorias.push(nova); else categorias.splice(iOutros, 0, nova);
    }
    return { ...dados, versao: 4, ...(categorias ? { categorias } : {}), dasPagos: dados.dasPagos || {} };
  },
  // 4 → 5: DAS pago com dinheiro de outra pessoa (não entra nos gastos, mas segue lembrado)
  (dados) => ({ ...dados, versao: 5, dasTerceiros: dados.dasTerceiros || {} }),
  // 5 → 6: Ordem de Compra. Cobrança por item de valor fixo (não mais dias × valor); nº do pedido vira nº da OC,
  // e-mail de envio vira e-mail do DANFSE; prazo 30 DDL; medição da competência M (trabalho de M, nota em M+1)
  // passa para a chave do mês do item (M+1). Nada é apagado: o valor por dia e a competência antiga ficam guardados.
  (dados) => {
    const contrato = { ...(ehObjeto(dados.contrato) ? dados.contrato : {}) };
    if ('pedidoCompra' in contrato) {
      if (!contrato.numeroOC) contrato.numeroOC = contrato.pedidoCompra || '';
      delete contrato.pedidoCompra;
    }
    if ('emailEnvio' in contrato) {
      if (!contrato.emailDanfse) contrato.emailDanfse = contrato.emailEnvio || '';
      delete contrato.emailEnvio;
    }
    if (contrato.descricaoServico === DESCRICAO_V5) delete contrato.descricaoServico; // volta ao padrão novo
    if ('valorDiaCentavos' in contrato) {
      contrato.valorDiaReferenciaCentavos = contrato.valorDiaCentavos;
      delete contrato.valorDiaCentavos;
    }
    contrato.prazoPagamentoDias = 30;
    const medicoes = {};
    for (const [mes, m] of Object.entries(ehObjeto(dados.medicoes) ? dados.medicoes : {})) {
      if (!/^\d{4}-\d{2}$/.test(mes)) { medicoes[mes] = m; continue; }
      const novo = somarMeses(mes, 1);
      medicoes[novo] = { ...m, mes: novo, competenciaOrigem: mes };
    }
    return {
      ...dados, versao: 6, contrato, medicoes,
      pendencias: Array.isArray(dados.pendencias) ? dados.pendencias : pendenciasPadrao(),
    };
  },
];

/** Descrição padrão da NF até a v5 (trocada pela da OC se o usuário não tiver mudado). */
const DESCRICAO_V5 = 'Preparação de documentos e apoio técnico-administrativo: '
  + 'organização de bases de dados, cadastros e controles.';

const ehObjeto = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Completa campos que faltam com os padrões (sem apagar nada que já exista). */
function completar(dados) {
  const base = estadoInicial();
  const d = { ...base, ...dados };
  for (const chave of ['perfil', 'contrato', 'caixa', 'mei', 'meta']) {
    d[chave] = { ...base[chave], ...(ehObjeto(dados[chave]) ? dados[chave] : {}) };
  }
  for (const chave of ['marcas', 'medicoes', 'dasPagos', 'dasTerceiros']) {
    if (!ehObjeto(d[chave])) d[chave] = {};
  }
  if (!Array.isArray(d.feriados)) d.feriados = base.feriados;
  if (!Array.isArray(d.contas) || !d.contas.length) d.contas = base.contas;
  if (!Array.isArray(d.recorrencias)) d.recorrencias = [];
  if (!Array.isArray(d.categorias) || !d.categorias.length) d.categorias = base.categorias;
  if (!Array.isArray(d.lancamentos)) d.lancamentos = [];
  if (!Array.isArray(d.parcelamentos)) d.parcelamentos = [];
  if (!Array.isArray(d.estimativas)) d.estimativas = base.estimativas;
  if (!Array.isArray(d.pendencias)) d.pendencias = base.pendencias;
  if (!Array.isArray(d.contrato.itensOC)) d.contrato.itensOC = [];
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
