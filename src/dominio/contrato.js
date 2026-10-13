// Contrato PJ: dias sugeridos, marcação de dias, teto semanal e competência.

import {
  diaDaSemana, inicioSemana, intervaloDias, somarMeses, ultimoDiaDoMes, mesDe,
} from '../utils/datas.js';
import { feriadoEm } from './feriados.js';

export const CONTRATO_PADRAO = Object.freeze({
  valorDiaCentavos: 20000,
  diasSemana: [2, 3, 4], // 0 = dom … 6 = sáb
  tetoSemanal: 3,
  inicio: null,
  fim: null,
  prazoPagamentoDias: 30,
  diaCorte: 0, // 0 = competência é o mês inteiro; N = do dia N+1 do mês anterior ao dia N
  avisoRescisaoDias: 30,
  pedidoCompra: '',
  tomador: '',
  emailEnvio: '',
  descricaoServico: 'Preparação de documentos e apoio técnico-administrativo: '
    + 'organização de bases de dados, cadastros e controles.',
});

/** Estados possíveis de um dia no calendário. */
export const DIA = Object.freeze({ TRABALHADO: 'trabalhado', FOLGA: 'folga' });

export function dentroDoContrato(iso, contrato) {
  if (contrato.inicio && iso < contrato.inicio) return false;
  if (contrato.fim && iso > contrato.fim) return false;
  return Boolean(contrato.inicio);
}

/** Dia que o app sugere como de trabalho: dia da semana do contrato, sem feriado. */
export function ehDiaSugerido(iso, contrato, feriados) {
  return dentroDoContrato(iso, contrato)
    && contrato.diasSemana.includes(diaDaSemana(iso))
    && !feriadoEm(iso, feriados);
}

/**
 * Situação do dia, combinando a marcação do usuário com a sugestão:
 * 'trabalhado' | 'folga' (sugerido, mas não vai trabalhar) | 'sugerido' | null.
 */
export function situacaoDia(iso, marcas, contrato, feriados) {
  const marca = marcas[iso];
  if (marca === DIA.TRABALHADO) return DIA.TRABALHADO;
  const sugerido = ehDiaSugerido(iso, contrato, feriados);
  if (marca === DIA.FOLGA && sugerido) return DIA.FOLGA;
  return sugerido ? 'sugerido' : null;
}

/**
 * Próxima marcação ao clicar num dia (um clique por vez):
 * sugerido: vazio → trabalhado → folga → vazio; outros dias: vazio ↔ trabalhado.
 */
export function proximaMarca(marcaAtual, sugerido) {
  if (marcaAtual === DIA.TRABALHADO) return sugerido ? DIA.FOLGA : null;
  if (marcaAtual === DIA.FOLGA) return null;
  return DIA.TRABALHADO;
}

/** Aplica uma marcação, devolvendo um objeto novo (null apaga). */
export function marcarDia(marcas, iso, marca) {
  const novas = { ...marcas };
  if (marca) novas[iso] = marca; else delete novas[iso];
  return novas;
}

/** Período da competência `mes` ("aaaa-mm"). */
export function periodoCompetencia(mes, diaCorte = 0) {
  if (!diaCorte) return { inicio: `${mes}-01`, fim: ultimoDiaDoMes(mes) };
  const anterior = somarMeses(mes, -1);
  const corteAnterior = Math.min(diaCorte, Number(ultimoDiaDoMes(anterior).slice(8)));
  const corteAtual = Math.min(diaCorte, Number(ultimoDiaDoMes(mes).slice(8)));
  const inicio = corteAnterior === Number(ultimoDiaDoMes(anterior).slice(8))
    ? `${mes}-01`
    : `${anterior}-${String(corteAnterior + 1).padStart(2, '0')}`;
  return { inicio, fim: `${mes}-${String(corteAtual).padStart(2, '0')}` };
}

/** Competência ("aaaa-mm") à qual pertence um dia. */
export function competenciaDoDia(iso, diaCorte = 0) {
  const mes = mesDe(iso);
  if (!diaCorte) return mes;
  return iso <= periodoCompetencia(mes, diaCorte).fim ? mes : somarMeses(mes, 1);
}

export function diasTrabalhados(periodo, marcas) {
  return Object.keys(marcas)
    .filter((d) => marcas[d] === DIA.TRABALHADO && d >= periodo.inicio && d <= periodo.fim)
    .sort();
}

/**
 * Dias previstos no período: os trabalhados + os sugeridos de hoje em diante que não foram
 * marcados como folga. Dias passados só contam se marcados.
 */
export function diasPrevistos(periodo, marcas, contrato, feriados, hoje) {
  return intervaloDias(periodo.inicio, periodo.fim).filter((d) => {
    const s = situacaoDia(d, marcas, contrato, feriados);
    return s === DIA.TRABALHADO || (s === 'sugerido' && d >= hoje);
  });
}

/** Dias trabalhados por semana (chave = segunda-feira). */
export function contagemPorSemana(marcas) {
  const semanas = {};
  for (const [d, m] of Object.entries(marcas)) {
    if (m !== DIA.TRABALHADO) continue;
    const s = inicioSemana(d);
    semanas[s] = (semanas[s] || 0) + 1;
  }
  return semanas;
}

/** Semanas em que os dias trabalhados passam do teto: [{ semana, dias }]. */
export function semanasAcimaDoTeto(marcas, teto) {
  if (!teto) return [];
  return Object.entries(contagemPorSemana(marcas))
    .filter(([, n]) => n > teto)
    .map(([semana, dias]) => ({ semana, dias }))
    .sort((a, b) => a.semana.localeCompare(b.semana));
}

export function valorDosDias(qtdDias, contrato) {
  return qtdDias * contrato.valorDiaCentavos;
}

/** Estimativa do contrato inteiro pelos dias sugeridos (sem marcações). */
export function estimativaContrato(contrato, feriados) {
  if (!contrato.inicio || !contrato.fim) return null;
  const dias = intervaloDias(contrato.inicio, contrato.fim)
    .filter((d) => ehDiaSugerido(d, contrato, feriados)).length;
  return { dias, centavos: valorDosDias(dias, contrato) };
}

/** Competências ("aaaa-mm") cobertas pelo contrato. */
export function competenciasDoContrato(contrato) {
  if (!contrato.inicio) return [];
  const primeira = competenciaDoDia(contrato.inicio, contrato.diaCorte);
  const ultima = competenciaDoDia(contrato.fim || contrato.inicio, contrato.diaCorte);
  const meses = [];
  for (let m = primeira; m <= ultima; m = somarMeses(m, 1)) meses.push(m);
  return meses;
}
