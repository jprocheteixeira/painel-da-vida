// Feriados. A lista vive nos dados do usuário (editável); aqui ficam só os padrões.
// Premissas (conferidas em 13/10/2026):
// - nacionais: Lei 662/1949, Lei 6.802/1980 (12/10), Lei 14.759/2023 (20/11) e Sexta-feira Santa;
// - Carnaval e Corpus Christi são pontos facultativos no setor privado: entram desligados;
// - Guarapuava: 09/12, aniversário do município (feriado local no calendário do TJPR);
// - 19/12 (Emancipação do Paraná) NÃO é feriado desde a Lei estadual 18.384/2014.

import { deUTC, somarDias } from '../utils/datas.js';

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher). */
export function pascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return deUTC(Date.UTC(ano, mes - 1, dia));
}

const fixo = (ano, mmdd, nome, tipo = 'nacional', ativo = true) =>
  ({ data: `${ano}-${mmdd}`, nome, tipo, ativo });

export function feriadosPadrao(ano) {
  const p = pascoa(ano);
  return [
    fixo(ano, '01-01', 'Confraternização Universal'),
    { data: somarDias(p, -48), nome: 'Carnaval (segunda)', tipo: 'facultativo', ativo: false },
    { data: somarDias(p, -47), nome: 'Carnaval (terça)', tipo: 'facultativo', ativo: false },
    { data: somarDias(p, -2), nome: 'Sexta-feira Santa', tipo: 'nacional', ativo: true },
    fixo(ano, '04-21', 'Tiradentes'),
    fixo(ano, '05-01', 'Dia do Trabalho'),
    { data: somarDias(p, 60), nome: 'Corpus Christi', tipo: 'facultativo', ativo: false },
    fixo(ano, '09-07', 'Independência do Brasil'),
    fixo(ano, '10-12', 'Nossa Senhora Aparecida'),
    fixo(ano, '11-02', 'Finados'),
    fixo(ano, '11-15', 'Proclamação da República'),
    fixo(ano, '11-20', 'Dia Nacional de Zumbi e da Consciência Negra'),
    fixo(ano, '12-09', 'Aniversário de Guarapuava', 'municipal'),
    fixo(ano, '12-25', 'Natal'),
  ].sort((x, y) => x.data.localeCompare(y.data));
}

export const TIPOS_FERIADO = {
  nacional: 'Nacional',
  municipal: 'Municipal',
  facultativo: 'Ponto facultativo',
  pessoal: 'Pessoal',
};

const cache = new WeakMap();

/** Mapa data → feriado, só dos ativos (memorizado por lista). */
export function indiceFeriados(lista) {
  if (!lista) return new Map();
  let mapa = cache.get(lista);
  if (!mapa) {
    mapa = new Map(lista.filter((f) => f.ativo).map((f) => [f.data, f]));
    cache.set(lista, mapa);
  }
  return mapa;
}

export function feriadoEm(iso, lista) {
  return indiceFeriados(lista).get(iso) || null;
}

/** Garante que existam os padrões dos anos pedidos, sem duplicar nem sobrescrever edições. */
export function completarFeriados(lista, anos) {
  const existentes = new Set(lista.map((f) => `${f.data}|${f.nome}`));
  const datas = new Set(lista.map((f) => f.data));
  const novos = anos.flatMap(feriadosPadrao)
    .filter((f) => !existentes.has(`${f.data}|${f.nome}`) && !datas.has(f.data));
  return [...lista, ...novos].sort((x, y) => x.data.localeCompare(y.data));
}
