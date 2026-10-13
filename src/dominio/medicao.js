// Medição mensal: máquina de estados, datas-chave, texto do boletim e da NFS-e.

import {
  formatarData, mesDe, nomeSemana, rotuloCompetencia, somarMeses, diferencaDias,
} from '../utils/datas.js';
import { formatarReais } from '../utils/dinheiro.js';
import { nesimoDiaUtil, somarDiasCorridosAteUtil, ultimoDiaUtil } from './calendario.js';
import { diasTrabalhados, periodoCompetencia, valorDosDias } from './contrato.js';

export const ESTADOS = Object.freeze([
  { id: 'trabalhando', nome: 'Trabalhando', acao: null },
  { id: 'boletim_enviado', nome: 'Boletim enviado', acao: 'Boletim enviado' },
  { id: 'aprovado', nome: 'Aprovado', acao: 'Aprovado pelo supervisor' },
  { id: 'nf_emitida', nome: 'NF emitida', acao: 'NF emitida' },
  { id: 'aguardando_pagamento', nome: 'Aguardando pagamento', acao: 'NF enviada por e-mail' },
  { id: 'pago', nome: 'Pago', acao: 'Pagamento recebido' },
]);

export const PRAZO_APROVACAO_DIA_UTIL = 5;

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

/** Avança uma etapa, guardando a data real. Devolve uma medição nova. */
export function avancar(medicao, data) {
  const proximo = proximoEstado(medicao);
  if (!proximo) throw new Error('A medição já está paga.');
  if (!data) throw new Error('Informe a data.');
  const anterior = ultimaDataRegistrada(medicao);
  if (anterior && data < anterior.data) {
    throw new Error(`A data não pode ser anterior a ${formatarData(anterior.data)} `
      + `(${anterior.estado.nome.toLowerCase()}).`);
  }
  return {
    ...medicao,
    estado: proximo.id,
    historico: { ...medicao.historico, [proximo.id]: data },
  };
}

/** Desfaz a última etapa. */
export function voltar(medicao) {
  const i = indiceEstado(medicao.estado);
  if (i === 0) return medicao;
  const historico = { ...medicao.historico };
  delete historico[medicao.estado];
  return { ...medicao, estado: ESTADOS[i - 1].id, historico };
}

/**
 * Datas-chave da competência. Cada item: { data, real } (real = já aconteceu).
 * - envio do boletim: último dia útil do mês em que o período termina;
 * - aprovação: até o 5º dia útil do mês seguinte;
 * - emissão da NF: data real; senão, a da aprovação (real ou prazo);
 * - pagamento: emissão + prazo do contrato em dias corridos, passando para o próximo dia útil.
 */
export function datasChave(mes, { contrato, feriados, medicao }) {
  const periodo = periodoCompetencia(mes, contrato.diaCorte);
  const h = medicao?.historico || {};
  const mesFim = mesDe(periodo.fim);

  const envioPrazo = ultimoDiaUtil(mesFim, feriados);
  const aprovacaoPrazo = nesimoDiaUtil(somarMeses(mesFim, 1), PRAZO_APROVACAO_DIA_UTIL, feriados);
  const emissao = h.nf_emitida || h.aprovado || aprovacaoPrazo;
  const pagamentoPrevisto = somarDiasCorridosAteUtil(emissao, contrato.prazoPagamentoDias, feriados);

  return {
    periodo,
    envioBoletim: { prazo: envioPrazo, data: h.boletim_enviado || envioPrazo, real: Boolean(h.boletim_enviado) },
    aprovacao: { prazo: aprovacaoPrazo, data: h.aprovado || aprovacaoPrazo, real: Boolean(h.aprovado) },
    emissaoNF: { data: emissao, real: Boolean(h.nf_emitida) },
    envioNF: { data: h.aguardando_pagamento || emissao, real: Boolean(h.aguardando_pagamento) },
    pagamento: { data: h.pago || pagamentoPrevisto, previsto: pagamentoPrevisto, real: Boolean(h.pago) },
  };
}

/** Período "dd/mm/aaaa a dd/mm/aaaa" limitado às datas do contrato. */
export function periodoNoContrato(periodo, contrato) {
  const inicio = contrato.inicio && contrato.inicio > periodo.inicio ? contrato.inicio : periodo.inicio;
  const fim = contrato.fim && contrato.fim < periodo.fim ? contrato.fim : periodo.fim;
  return { inicio, fim };
}

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** Resumo numérico da medição (dias marcados como trabalhados). */
export function resumoMedicao(mes, { contrato, marcas }) {
  const periodo = periodoCompetencia(mes, contrato.diaCorte);
  const dias = diasTrabalhados(periodo, marcas);
  return { periodo, dias, valorCentavos: valorDosDias(dias.length, contrato) };
}

export function textoBoletim(mes, { contrato, perfil, marcas, medicao }) {
  const { periodo, dias, valorCentavos } = resumoMedicao(mes, { contrato, marcas });
  const p = periodoNoContrato(periodo, contrato);
  const linhas = [
    `Boletim de medição — ${rotuloCompetencia(mes)}`,
    '',
  ];
  if (perfil?.nome) linhas.push(`Prestador: ${perfil.nome}${perfil.cnpj ? ` — CNPJ ${perfil.cnpj}` : ''}`);
  if (contrato.tomador) linhas.push(`Tomador: ${contrato.tomador}`);
  linhas.push(`Pedido de compra nº ${contrato.pedidoCompra || '[PENDENTE]'}`);
  linhas.push(`Período: ${formatarData(p.inicio)} a ${formatarData(p.fim)}`);
  linhas.push('');
  linhas.push(`Dias trabalhados (${dias.length}):`);
  for (const d of dias) linhas.push(`- ${formatarData(d)} (${nomeSemana(d, true)})`);
  linhas.push('');
  linhas.push(`Total: ${plural(dias.length, 'dia', 'dias')} × ${formatarReais(contrato.valorDiaCentavos)}`
    + ` = ${formatarReais(valorCentavos)}`);
  const resumo = (medicao?.resumo || '').trim();
  if (resumo) linhas.push('', 'Resumo das atividades:', resumo);
  return linhas.join('\n');
}

export function textoNF(mes, { contrato, marcas }) {
  const { periodo, dias } = resumoMedicao(mes, { contrato, marcas });
  const p = periodoNoContrato(periodo, contrato);
  return `${contrato.descricaoServico.trim()} `
    + `Pedido de compra nº ${contrato.pedidoCompra || '[PENDENTE]'}. `
    + `Período: ${formatarData(p.inicio)} a ${formatarData(p.fim)}. `
    + `${plural(dias.length, 'dia de serviço', 'dias de serviço')} × ${formatarReais(contrato.valorDiaCentavos)}.`;
}

/** Dias entre o último dia trabalhado e o recebimento (real ou previsto). */
export function diasAteReceber(dias, datas) {
  if (!dias.length) return null;
  return diferencaDias(dias[dias.length - 1], datas.pagamento.data);
}
