// Datas como texto ISO "aaaa-mm-dd" (dia civil, sem hora). Toda a aritmética é feita em UTC
// para não sofrer com horário de verão; "hoje" é sempre o dia em America/Sao_Paulo.

export const FUSO = 'America/Sao_Paulo';
const DIA_MS = 86400000;

const NOMES_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho',
  'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const NOMES_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

const doisDigitos = (n) => String(n).padStart(2, '0');

/** Dia de hoje no fuso de São Paulo, em ISO. */
export function hojeISO(agora = new Date()) {
  // en-CA formata como aaaa-mm-dd
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(agora);
}

export function ehDataISO(texto) {
  if (typeof texto !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  return deUTC(paraUTC(texto)) === texto;
}

export function paraUTC(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function deUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function somarDias(iso, n) {
  return deUTC(paraUTC(iso) + n * DIA_MS);
}

/** Diferença em dias corridos (b − a). */
export function diferencaDias(a, b) {
  return Math.round((paraUTC(b) - paraUTC(a)) / DIA_MS);
}

/** 0 = domingo … 6 = sábado */
export function diaDaSemana(iso) {
  return new Date(paraUTC(iso)).getUTCDay();
}

/** Segunda-feira da semana do dia (semanas de segunda a domingo). */
export function inicioSemana(iso) {
  return somarDias(iso, -((diaDaSemana(iso) + 6) % 7));
}

export function formatarData(iso) {
  if (!iso) return '—';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function formatarDataCurta(iso) {
  if (!iso) return '—';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

export function nomeSemana(iso, curto = false) {
  return (curto ? SEMANA_CURTA : NOMES_SEMANA)[diaDaSemana(iso)];
}

/** Ex.: "quarta, 14 de outubro de 2026" (para leitores de tela). */
export function dataPorExtenso(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return `${nomeSemana(iso)}, ${d} de ${NOMES_MES[m - 1]} de ${a}`;
}

// ---- meses ("aaaa-mm") ----

export function mesDe(iso) {
  return iso.slice(0, 7);
}

export function ehMesISO(texto) {
  return typeof texto === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(texto);
}

export function somarMeses(mes, n) {
  const [a, m] = mes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${doisDigitos((total % 12) + 1)}`;
}

export function primeiroDiaDoMes(mes) {
  return `${mes}-01`;
}

export function ultimoDiaDoMes(mes) {
  const [a, m] = mes.split('-').map(Number);
  return deUTC(Date.UTC(a, m, 0));
}

/** Lista os dias de `inicio` até `fim`, inclusive. */
export function intervaloDias(inicio, fim) {
  const dias = [];
  for (let d = inicio; d <= fim; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** Ex.: "outubro de 2026" ou "out/2026". */
export function nomeMes(mes, curto = false) {
  const [a, m] = mes.split('-').map(Number);
  const nome = NOMES_MES[m - 1];
  return curto ? `${nome.slice(0, 3)}/${a}` : `${nome} de ${a}`;
}

/** Ex.: "Outubro/2026". */
export function rotuloCompetencia(mes) {
  const [a, m] = mes.split('-').map(Number);
  const nome = NOMES_MES[m - 1];
  return `${nome[0].toUpperCase()}${nome.slice(1)}/${a}`;
}

/** Meses de `inicio` até `fim`, inclusive ("aaaa-mm"). */
export function intervaloMeses(inicio, fim) {
  const meses = [];
  for (let m = inicio; m <= fim; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}
