// Backup em JSON: exportar, importar e lembrete mensal (último dia útil do mês).

import { mesDe, somarMeses, somarDias } from '../utils/datas.js';
import { ultimoDiaUtil } from '../dominio/calendario.js';
import { migrar, VERSAO_ATUAL } from './migracoes.js';

export const APP = 'painel-da-vida';

export function gerarBackup(estado, agoraISO) {
  return { app: APP, versao: VERSAO_ATUAL, exportadoEm: agoraISO, dados: estado };
}

/** Lê o texto de um backup (ou dos dados puros) e devolve o estado migrado. */
export function lerBackup(texto) {
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error('O arquivo não é um JSON válido.');
  }
  if (json && json.app && json.app !== APP) throw new Error('Este arquivo não é um backup do Painel da Vida.');
  const dados = json && json.app === APP ? json.dados : json;
  return migrar(dados);
}

export function nomeArquivoBackup(hoje) {
  return `painel-da-vida-backup-${hoje}.json`;
}

/**
 * Backup mensal no ÚLTIMO DIA ÚTIL do mês (o mesmo dia de enviar o boletim, para virar um hábito só).
 * Devolve a data do próximo backup devido: o do mês passado, se ficou para trás; senão o deste mês;
 * se o deste mês já foi feito, o do mês que vem. null quando não há dados para guardar.
 */
export function proximoBackup(estado, hoje) {
  const temDados = Object.keys(estado.marcas).length > 0 || Boolean(estado.contrato.inicio);
  if (!temDados || estado.meta.exemplo) return null;
  // referência: o último backup; se nunca houve, a véspera do primeiro dado (contrato ou dia marcado)
  const inicio = [estado.contrato.inicio, ...Object.keys(estado.marcas)].filter(Boolean).sort()[0];
  const base = estado.meta.ultimoBackup || somarDias(inicio, -1);
  const mes = mesDe(hoje);
  const anterior = ultimoDiaUtil(somarMeses(mes, -1), estado.feriados);
  const desteMes = ultimoDiaUtil(mes, estado.feriados);
  if (base < anterior) return anterior;
  if (base < desteMes) return desteMes;
  return ultimoDiaUtil(somarMeses(mes, 1), estado.feriados);
}

/** true se o backup do mês já venceu (aparece a faixa de lembrete no Painel). */
export function precisaLembreteBackup(estado, hoje) {
  const data = proximoBackup(estado, hoje);
  return Boolean(data) && data <= hoje;
}

/** Datas de backup (último dia útil de cada mês) de hoje até `ateMes`, para pôr na agenda. */
export function datasBackup(estado, hoje, ateMes) {
  const primeira = proximoBackup(estado, hoje);
  if (!primeira) return [];
  const datas = [];
  for (let m = mesDe(primeira); m <= ateMes; m = somarMeses(m, 1)) {
    const d = ultimoDiaUtil(m, estado.feriados);
    if (d >= hoje) datas.push(d);
  }
  return datas;
}
