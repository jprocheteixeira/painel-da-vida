// Medição mensal de cada item da OC: máquina de estados, datas-chave, texto do boletim e da NFS-e.
// A medição fica na chave do mês do item ("aaaa-mm" da data de despacho).

import {
  formatarData, nomeSemana, rotuloCompetencia, diferencaDias, somarDias,
} from '../utils/datas.js';
import { formatarReais } from '../utils/dinheiro.js';
import { ehDiaUtil } from './calendario.js';
import { diasTrabalhados, periodoCompetencia } from './contrato.js';
import {
  itemDoMes, periodoItem, janelaNF, emissaoPrevista, dataPagamento, motivoRecusaEmissao, textoNFItem,
} from './oc.js';

export const ESTADOS = Object.freeze([
  { id: 'trabalhando', nome: 'Trabalhando', acao: null },
  { id: 'boletim_enviado', nome: 'Boletim enviado', acao: 'Boletim enviado' },
  { id: 'aprovado', nome: 'Aprovado', acao: 'Aprovado pelo supervisor' },
  { id: 'nf_emitida', nome: 'NF emitida', acao: 'NF emitida' },
  { id: 'aguardando_pagamento', nome: 'Aguardando pagamento', acao: 'NF enviada por e-mail' },
  { id: 'pago', nome: 'Pago', acao: 'Pagamento recebido' },
]);

export function indiceEstado(id) {
  const i = ESTADOS.findIndex((e) => e.id === id);
  if (i < 0) throw new Error(`Estado desconhecido: ${id}`);
  return i;
}

export function novaMedicao(mes) {
  return { mes, estado: 'trabalhando', historico: {}, resumo: '', numeroNF: '' };
}

export function proximoEstado(medicao) {
  return ESTADOS[indiceEstado(medicao.estado) + 1] || null;
}

/** Data real mais recente já registrada (para não deixar uma etapa antes da anterior). */
function ultimaDataRegistrada(medicao) {
  const i = indiceEstado(medicao.estado);
  for (let k = i; k > 0; k--) {
    const d = medicao.historico[ESTADOS[k].id];
    if (d) return { data: d, estado: ESTADOS[k] };
  }
  return null;
}

/**
 * Avança uma etapa, guardando a data real. Devolve uma medição nova.
 * Com `contrato`, a emissão da NF é validada: só dentro da janela (15–20) e uma nota por item da OC.
 */
export function avancar(medicao, data, { contrato, medicoes } = {}) {
  const proximo = proximoEstado(medicao);
  if (!proximo) throw new Error('A medição já está paga.');
  if (!data) throw new Error('Informe a data.');
  const anterior = ultimaDataRegistrada(medicao);
  if (anterior && data < anterior.data) {
    throw new Error(`A data não pode ser anterior a ${formatarData(anterior.data)} `
      + `(${anterior.estado.nome.toLowerCase()}).`);
  }
  const nova = {
    ...medicao,
    estado: proximo.id,
    historico: { ...medicao.historico, [proximo.id]: data },
  };
  if (proximo.id === 'nf_emitida' && contrato) {
    const item = itemDoMes(contrato, medicao.mes);
    if (!item) throw new Error('Este mês não tem item na OC: não há nota a emitir.');
    const motivo = motivoRecusaEmissao(data, item, contrato);
    if (motivo) throw new Error(motivo);
    const outra = Object.values(medicoes || {}).find((m) => m.mes !== medicao.mes && m.itemOC === item.n
      && indiceEstado(m.estado) >= indiceEstado('nf_emitida'));
    if (outra) throw new Error(`O item ${item.n} já tem nota emitida (${rotuloCompetencia(outra.mes)}).`);
    nova.itemOC = item.n;
  }
  return nova;
}

/** Desfaz a última etapa. */
export function voltar(medicao) {
  const i = indiceEstado(medicao.estado);
  if (i === 0) return medicao;
  const historico = { ...medicao.historico };
  delete historico[medicao.estado];
  const nova = { ...medicao, estado: ESTADOS[i - 1].id, historico };
  if (medicao.estado === 'nf_emitida') delete nova.itemOC;
  return nova;
}

/** Último dia útil até `iso` (sem voltar antes de `minimo`; se não houver, o próprio dia). */
function diaUtilAte(iso, minimo, feriados) {
  for (let d = iso; d >= minimo; d = somarDias(d, -1)) if (ehDiaUtil(d, feriados)) return d;
  return iso;
}

/** Período da medição: o do item da OC; sem item, o mês inteiro. */
export function periodoDaMedicao(mes, contrato) {
  const item = itemDoMes(contrato, mes);
  return item ? periodoItem(contrato, item) : periodoCompetencia(mes, contrato.diaCorte);
}

/**
 * Datas-chave do item do mês. Cada etapa: { data, real } (real = já aconteceu).
 * - envio do boletim: último dia útil até o despacho (fim do período do item);
 * - aprovação: último dia útil até o dia do lembrete forte (18), para dar tempo de emitir;
 * - janela da NF: dia 15 a 20 do mês do item (ou do mês seguinte, se perdeu);
 * - emissão: data real; senão a prevista dentro da janela (ver `emissaoPrevista`);
 * - pagamento: base (emissão, padrão) + prazo em dias corridos, passando para o próximo dia útil.
 *   Sem NF emitida, vem também o intervalo { maisCedo, maisTarde } (emissão no início ou no fim da janela).
 */
export function datasChave(mes, { contrato, feriados, medicao, hoje = '0000-01-01' }) {
  const item = itemDoMes(contrato, mes);
  const periodo = periodoDaMedicao(mes, contrato);
  const h = medicao?.historico || {};
  const janelaItem = janelaNF(mes, contrato);
  const fimPeriodo = item ? item.despacho : periodo.fim;

  const envioPrazo = diaUtilAte(fimPeriodo, periodo.inicio, feriados);
  const aprovacaoPrazo = diaUtilAte(janelaItem.lembrete, fimPeriodo, feriados);

  const prev = item ? emissaoPrevista(item, contrato, hoje) : null;
  const emissao = h.nf_emitida || prev?.data || janelaItem.limite;
  const janela = h.nf_emitida || !prev ? janelaItem : janelaNF(prev.mes, contrato);
  const envio = h.aguardando_pagamento || null;
  const pagamentoPrevisto = dataPagamento(emissao, contrato, feriados, envio);
  const intervalo = h.nf_emitida || !prev
    ? { maisCedo: pagamentoPrevisto, maisTarde: pagamentoPrevisto }
    : { maisCedo: dataPagamento(prev.maisCedo, contrato, feriados), maisTarde: dataPagamento(prev.maisTarde, contrato, feriados) };

  return {
    item,
    periodo,
    janelaItem,
    janela,
    perdida: !h.nf_emitida && Boolean(prev?.perdida),
    envioBoletim: { prazo: envioPrazo, data: h.boletim_enviado || envioPrazo, real: Boolean(h.boletim_enviado) },
    aprovacao: { prazo: aprovacaoPrazo, data: h.aprovado || aprovacaoPrazo, real: Boolean(h.aprovado) },
    emissaoNF: { data: emissao, real: Boolean(h.nf_emitida) },
    envioNF: { data: envio || emissao, real: Boolean(envio) },
    pagamento: { data: h.pago || pagamentoPrevisto, previsto: pagamentoPrevisto, real: Boolean(h.pago), ...intervalo },
  };
}

/** Período limitado às datas do contrato. */
export function periodoNoContrato(periodo, contrato) {
  const inicio = contrato.inicio && contrato.inicio > periodo.inicio ? contrato.inicio : periodo.inicio;
  const fim = contrato.fim && contrato.fim < periodo.fim ? contrato.fim : periodo.fim;
  return { inicio, fim };
}

/** Resumo da medição: valor fixo do item e dias marcados (só informação). */
export function resumoMedicao(mes, { contrato, marcas }) {
  const item = itemDoMes(contrato, mes);
  const periodo = periodoDaMedicao(mes, contrato);
  const dias = diasTrabalhados(periodo, marcas);
  return { item, periodo, dias, valorCentavos: item?.valorCentavos ?? 0 };
}

export function textoBoletim(mes, { contrato, perfil, marcas, medicao }) {
  const { item, periodo, dias, valorCentavos } = resumoMedicao(mes, { contrato, marcas });
  const p = periodoNoContrato(periodo, contrato);
  const linhas = [
    `Boletim de medição — ${item ? `Item ${item.n} (Mês ${item.n}) · ` : ''}${rotuloCompetencia(mes)}`,
    '',
  ];
  if (perfil?.nome) linhas.push(`Prestador: ${perfil.nome}${perfil.cnpj ? ` — CNPJ ${perfil.cnpj}` : ''}`);
  if (contrato.tomador) linhas.push(`Tomador: ${contrato.tomador}`);
  linhas.push(`Ordem de Compra nº ${contrato.numeroOC || '[PENDENTE]'}${item ? ` — Item ${item.n}` : ''}`);
  linhas.push(`Período: ${formatarData(p.inicio)} a ${formatarData(p.fim)}`);
  linhas.push('');
  if (dias.length) { // marcar os dias é opcional
    linhas.push(`Dias de atividade presencial (${dias.length}, informativo):`);
    for (const d of dias) linhas.push(`- ${formatarData(d)} (${nomeSemana(d, true)})`);
    linhas.push('');
  }
  linhas.push(`Valor do item: ${formatarReais(valorCentavos)} (valor fixo mensal da OC)`);
  const resumo = (medicao?.resumo || '').trim();
  if (resumo) linhas.push('', 'Relatório mensal de atividades:', resumo);
  return linhas.join('\n');
}

/** Descrição da NFS-e do item do mês (formato da OC). */
export function textoNF(mes, { contrato }) {
  const item = itemDoMes(contrato, mes);
  if (!item) return 'Este mês não tem item na OC.';
  return textoNFItem(item, contrato);
}

/** Dias entre o último dia trabalhado e o recebimento (real ou previsto). */
export function diasAteReceber(dias, datas) {
  if (!dias.length) return null;
  return diferencaDias(dias[dias.length - 1], datas.pagamento.data);
}
