// Persistência no localStorage. Tudo fica só neste navegador; nada sai do aparelho.

import { estadoInicial, migrar } from './migracoes.js';

export const CHAVE = 'painel-da-vida:dados';
export const CHAVE_TEMA = 'painel-da-vida:tema';

function armazenamento() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null; // modo privado ou bloqueado
  }
}

/** Carrega e migra os dados. Se estiverem corrompidos, guarda uma cópia e recomeça. */
export function carregar() {
  const ls = armazenamento();
  if (!ls) return { estado: estadoInicial(), aviso: 'O navegador não permite guardar dados: nada será salvo.' };
  let texto;
  try {
    texto = ls.getItem(CHAVE);
  } catch {
    return { estado: estadoInicial(), aviso: 'Não foi possível ler os dados salvos.' };
  }
  if (!texto) return { estado: estadoInicial(), aviso: null };
  try {
    return { estado: migrar(JSON.parse(texto)), aviso: null };
  } catch (erro) {
    try { ls.setItem(`${CHAVE}:corrompido:${Date.now()}`, texto); } catch { /* sem espaço */ }
    return { estado: estadoInicial(), aviso: `Os dados salvos não puderam ser lidos (${erro.message}). Uma cópia foi guardada.` };
  }
}

/** Salva. Devolve false se não conseguiu (ex.: espaço cheio). */
export function salvar(estado) {
  const ls = armazenamento();
  if (!ls) return false;
  try {
    ls.setItem(CHAVE, JSON.stringify(estado));
    return true;
  } catch {
    return false;
  }
}

export function lerTema() {
  try { return armazenamento()?.getItem(CHAVE_TEMA) || 'auto'; } catch { return 'auto'; }
}

export function salvarTema(tema) {
  try { armazenamento()?.setItem(CHAVE_TEMA, tema); } catch { /* sem efeito */ }
}
