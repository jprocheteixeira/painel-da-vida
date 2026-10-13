// Gastos pessoais: categorias, lançamentos manuais, gastos fixos (recorrências) e parcelados.
// Gastos são guardados com valor POSITIVO; no caixa eles entram como saída (negativo).
// Fixos e parcelas não são gravados mês a mês: as ocorrências são calculadas a partir da regra,
// então editar ou apagar a regra corrige todos os meses futuros de uma vez.

import { mesDe, somarMeses, ultimoDiaDoMes, intervaloMeses } from '../utils/datas.js';
import { somar } from '../utils/dinheiro.js';

export const CATEGORIAS_PADRAO = Object.freeze([
  { id: 'mercado', nome: 'Mercado' },
  { id: 'saude', nome: 'Farmácia/Saúde' },
  { id: 'contas', nome: 'Contas fixas' },
  { id: 'transporte', nome: 'Transporte/Carro' },
  { id: 'roupas', nome: 'Roupas' },
  { id: 'hobby', nome: 'Hobby' },
  { id: 'lazer', nome: 'Lazer/Comida fora' },
  { id: 'estudos', nome: 'Estudos/Faculdade' },
  { id: 'assinaturas', nome: 'Assinaturas' },
  { id: 'outros', nome: 'Outros' },
]);

export const CATEGORIA_RESERVA = 'outros';

/** Itens sugeridos da estimativa mensal (o usuário preenche ou exclui). */
export const ESTIMATIVAS_PADRAO = Object.freeze([
  { id: 'e-aluguel', nome: 'Aluguel', categoriaId: 'contas' },
  { id: 'e-contas', nome: 'Luz, água e internet', categoriaId: 'contas' },
  { id: 'e-celular', nome: 'Celular', categoriaId: 'contas' },
  { id: 'e-mercado', nome: 'Mercado', categoriaId: 'mercado' },
  { id: 'e-gasolina', nome: 'Gasolina', categoriaId: 'transporte' },
  { id: 'e-carro', nome: 'Carro (manutenção, seguro)', categoriaId: 'transporte' },
  { id: 'e-saude', nome: 'Farmácia/Saúde', categoriaId: 'saude' },
  { id: 'e-lazer', nome: 'Lazer/Comida fora', categoriaId: 'lazer' },
  { id: 'e-faculdade', nome: 'Faculdade/Estudos', categoriaId: 'estudos' },
  { id: 'e-assinaturas', nome: 'Assinaturas (streaming etc.)', categoriaId: 'assinaturas' },
  { id: 'e-roupas', nome: 'Roupas', categoriaId: 'roupas' },
  { id: 'e-outros', nome: 'Outros', categoriaId: 'outros' },
]);

/** Gastos comuns que não vêm na lista, para adicionar com um toque. */
export const SUGESTOES_ESTIMATIVA = Object.freeze([
  { nome: 'Corte de cabelo', categoriaId: 'outros' },
  { nome: 'Academia', categoriaId: 'saude' },
  { nome: 'Plano de saúde', categoriaId: 'saude' },
  { nome: 'Dentista', categoriaId: 'saude' },
  { nome: 'Uber/ônibus', categoriaId: 'transporte' },
  { nome: 'Seguro do carro', categoriaId: 'transporte' },
  { nome: 'IPVA (÷12)', categoriaId: 'transporte' },
  { nome: 'Delivery', categoriaId: 'lazer' },
  { nome: 'Pet', categoriaId: 'outros' },
  { nome: 'Presentes', categoriaId: 'outros' },
  { nome: 'Cursos e livros', categoriaId: 'estudos' },
  { nome: 'Jogos', categoriaId: 'hobby' },
]);

export function estimativasPadrao() {
  return ESTIMATIVAS_PADRAO.map((e) => ({ ...e, valorCentavos: null }));
}

/** Total da estimativa mensal (itens sem valor não contam). */
export function totalEstimativa(estimativas) {
  return somar((estimativas || []).map((e) => e.valorCentavos || 0));
}

export function categoriasPadrao() {
  return CATEGORIAS_PADRAO.map((c) => ({ ...c, orcamentoCentavos: null }));
}

/** Data no mês `mes` com o dia desejado, limitado ao último dia do mês. */
export function diaNoMes(mes, dia) {
  const ultimo = Number(ultimoDiaDoMes(mes).slice(8));
  return `${mes}-${String(Math.min(dia, ultimo)).padStart(2, '0')}`;
}

/** Parcelas de um parcelamento: [{ data, valorCentavos, n, total }]. */
export function ocorrenciasParcelamento(p) {
  const mes0 = mesDe(p.primeiraData);
  const dia = Number(p.primeiraData.slice(8));
  return Array.from({ length: p.parcelas }, (_, i) => ({
    data: diaNoMes(somarMeses(mes0, i), dia),
    valorCentavos: p.valorParcelaCentavos,
    n: i + 1,
    total: p.parcelas,
  }));
}

/** Quantas parcelas já venceram até `hoje`. */
export function parcelasPagas(p, hoje) {
  return ocorrenciasParcelamento(p).filter((o) => o.data <= hoje).length;
}

/** Ocorrências de um gasto fixo mensal entre dois meses (valores positivos). */
export function ocorrenciasFixo(rec, deMes, ateMes) {
  const inicio = rec.inicio ? mesDe(rec.inicio) : deMes;
  const fim = rec.fim ? mesDe(rec.fim) : ateMes;
  const de = deMes > inicio ? deMes : inicio;
  const ate = ateMes < fim ? ateMes : fim;
  if (de > ate) return [];
  return intervaloMeses(de, ate)
    .map((m) => ({ data: diaNoMes(m, rec.dia || 1), valorCentavos: Math.abs(rec.valorCentavos) }));
}

/**
 * Todos os gastos do mês, de todas as origens:
 * [{ id, data, valorCentavos, categoriaId, descricao, origem: 'manual'|'fixo'|'parcela', refId }]
 */
export function gastosDoMes(estado, mes) {
  const manuais = estado.lancamentos
    .filter((l) => mesDe(l.data) === mes)
    .map((l) => ({ id: l.id, data: l.data, valorCentavos: l.valorCentavos, categoriaId: l.categoriaId,
      descricao: l.nota || '', origem: 'manual', refId: l.id }));
  const fixos = estado.recorrencias.flatMap((r) => ocorrenciasFixo(r, mes, mes).map((o) => ({
    id: `fixo:${r.id}:${mes}`, data: o.data, valorCentavos: o.valorCentavos,
    categoriaId: r.categoriaId || 'contas', descricao: r.descricao, origem: 'fixo', refId: r.id,
  })));
  const parcelas = estado.parcelamentos.flatMap((p) => ocorrenciasParcelamento(p)
    .filter((o) => mesDe(o.data) === mes)
    .map((o) => ({
      id: `parcela:${p.id}:${o.n}`, data: o.data, valorCentavos: o.valorCentavos,
      categoriaId: p.categoriaId || CATEGORIA_RESERVA, descricao: `${p.descricao} (${o.n}/${o.total})`,
      origem: 'parcela', refId: p.id,
    })));
  return [...manuais, ...fixos, ...parcelas].sort((a, b) => b.data.localeCompare(a.data) || a.id.localeCompare(b.id));
}

export function totalDeGastos(itens) {
  return somar(itens.map((i) => i.valorCentavos));
}

/**
 * Resumo do mês por categoria, comparado com o mês anterior e com o orçamento:
 * { mes, total, totalAnterior, variacao, categorias: [{ id, nome, total, anterior, orcamento, acimaDoOrcamento, fracao }] }
 */
export function resumoDoMes(estado, mes) {
  const atuais = gastosDoMes(estado, mes);
  const anteriores = gastosDoMes(estado, somarMeses(mes, -1));
  const porCat = (itens, id) => totalDeGastos(itens.filter((i) => i.categoriaId === id));
  const conhecidas = new Set(estado.categorias.map((c) => c.id));
  // gasto com categoria apagada conta em "Outros"
  const normalizar = (itens) => itens.map((i) => (conhecidas.has(i.categoriaId) ? i : { ...i, categoriaId: CATEGORIA_RESERVA }));
  const a = normalizar(atuais);
  const b = normalizar(anteriores);
  const total = totalDeGastos(a);
  const categorias = estado.categorias.map((c) => {
    const t = porCat(a, c.id);
    const orc = c.orcamentoCentavos ?? null;
    return {
      id: c.id, nome: c.nome, total: t, anterior: porCat(b, c.id), orcamento: orc,
      acimaDoOrcamento: orc != null && t > orc,
      fracao: total ? t / total : 0,
    };
  }).sort((x, y) => y.total - x.total || x.nome.localeCompare(y.nome));
  const totalAnterior = totalDeGastos(b);
  return { mes, total, totalAnterior, variacao: total - totalAnterior, categorias, itens: atuais };
}

/** Tudo o que já se sabe do mês: lançamentos + fixos + parcelas. */
export function gastoConhecidoNoMes(estado, mes) {
  return totalDeGastos(gastosDoMes(estado, mes));
}

let contador = 0;
/** Id curto e único o bastante para dados locais. */
export function novoId(prefixo) {
  contador = (contador + 1) % 1000;
  return `${prefixo}${Date.now().toString(36)}${contador.toString(36)}`;
}
