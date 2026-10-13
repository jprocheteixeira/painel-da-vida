// Exportação de prazos para agenda (iCalendar, RFC 5545): eventos de dia inteiro com dois avisos,
// na véspera às 9h e no dia às 9h (horário do aparelho).

import { somarDias } from '../utils/datas.js';
import { formatarReais } from '../utils/dinheiro.js';

/** Escapa texto para um campo iCalendar. */
export function escaparICS(texto) {
  return String(texto ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Quebra linhas com mais de 75 octetos (aproximado por caracteres), como pede a RFC 5545. */
function dobrar(linha) {
  const partes = [];
  let resto = linha;
  while (resto.length > 74) {
    partes.push(resto.slice(0, 74));
    resto = ` ${resto.slice(74)}`;
  }
  partes.push(resto);
  return partes.join('\r\n');
}

const dataICS = (iso) => iso.replace(/-/g, '');

/**
 * eventos: [{ id, data (ISO), titulo, descricao? }]; carimbo: data-hora UTC "aaaammddThhmmssZ".
 * O id fixo faz a agenda atualizar o evento (e não duplicar) se o arquivo for importado de novo.
 */
export function gerarICS(eventos, carimbo) {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Painel da Vida//Prazos//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Painel da Vida',
  ];
  for (const e of eventos) {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${e.id.replace(/[^\w:.-]/g, '-')}@painel-da-vida`,
      `DTSTAMP:${carimbo}`,
      `DTSTART;VALUE=DATE:${dataICS(e.data)}`,
      `DTEND;VALUE=DATE:${dataICS(somarDias(e.data, 1))}`,
      `SUMMARY:${escaparICS(e.titulo)}`,
    );
    if (e.descricao) linhas.push(`DESCRIPTION:${escaparICS(e.descricao)}`);
    linhas.push(
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparICS(e.titulo)}`, 'TRIGGER:-PT15H', 'END:VALARM',
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escaparICS(e.titulo)}`, 'TRIGGER:PT9H', 'END:VALARM',
      'END:VEVENT',
    );
  }
  linhas.push('END:VCALENDAR');
  return `${linhas.map(dobrar).join('\r\n')}\r\n`;
}

/** Converte tarefas do app em eventos de agenda. */
export function tarefasParaEventos(tarefas) {
  return tarefas.map((t) => ({
    id: t.id,
    data: t.data,
    titulo: t.valorCentavos ? `${t.titulo} · ${formatarReais(t.valorCentavos)}` : t.titulo,
    descricao: [t.detalhe, 'Criado pelo Painel da Vida.'].filter(Boolean).join('\n'),
  }));
}

/** Carimbo UTC no formato do iCalendar. */
export function carimboICS(data = new Date()) {
  return data.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
