// Backup em JSON: exportar, importar e lembrete mensal.

import { diferencaDias } from '../utils/datas.js';
import { migrar, VERSAO_ATUAL } from './migracoes.js';

export const APP = 'painel-da-vida';
export const LEMBRETE_BACKUP_DIAS = 30;

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

/** true se é hora de lembrar do backup: há dados e o último backup tem 30+ dias (ou nunca houve). */
export function precisaLembreteBackup(estado, hoje) {
  const temDados = Object.keys(estado.marcas).length > 0 || Boolean(estado.contrato.inicio);
  if (!temDados || estado.meta.exemplo) return false;
  const ultimo = estado.meta.ultimoBackup;
  return !ultimo || diferencaDias(ultimo, hoje) >= LEMBRETE_BACKUP_DIAS;
}
