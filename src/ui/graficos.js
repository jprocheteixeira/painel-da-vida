// Gráficos em SVG próprio (sem biblioteca). Cores por papel, via variáveis CSS (--serie-1, --serie-2…).
// Cada marca tem data-dica: o app mostra a dica ao passar o mouse ou focar.

import { escapar } from './util.js';
import { formatarReais } from '../utils/dinheiro.js';
import { nomeMes } from '../utils/datas.js';

/** "R$ 2,4 mil" — só para eixos e rótulos (o valor exato fica na dica e na tabela). */
export function reaisCompacto(centavos) {
  const reais = centavos / 100;
  const abs = Math.abs(reais);
  const sinal = reais < 0 ? '−' : '';
  if (abs >= 1000) return `${sinal}R$ ${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1).replace('.', ',')} mil`;
  return `${sinal}R$ ${Math.round(abs)}`;
}

const mesCurto = (mes) => nomeMes(mes, true).split('/')[0];

/** Largura lógica do SVG: menor no celular, para os rótulos não ficarem minúsculos. */
const larguraLogica = () => ((globalThis.innerWidth || 1024) < 600 ? 380 : 640);

/** Escala "bonita" de 0 (ou do mínimo) até o máximo, com 3–5 marcas. */
function escala(min, max) {
  const bruto = Math.max(max - min, 1) / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 2.5, 5, 10].map((m) => m * pot).find((p) => p >= bruto);
  const ini = Math.floor(min / passo) * passo;
  const fim = Math.ceil(max / passo) * passo;
  const marcas = [];
  for (let v = ini; v <= fim + passo / 2; v += passo) marcas.push(v);
  return { ini, fim, marcas };
}

/** Retângulo com só o topo arredondado (raio 4), ancorado na base. */
function barra(x, y, w, h, r = 4) {
  if (h <= 0) return '';
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/**
 * Barras agrupadas por mês.
 * series: [{ nome, chave, cor (var CSS), previsto?: (linha) => bool }]; linhas: [{ mes, [chave]: centavos }]
 */
export function barrasAgrupadas({ linhas, series, titulo, alturaPx = 220 }) {
  const W = larguraLogica();
  const H = alturaPx;
  const m = { t: 12, r: 8, b: 26, l: 54 };
  const max = Math.max(1, ...linhas.flatMap((l) => series.map((s) => l[s.chave])));
  const { fim, marcas } = escala(0, max);
  const larguraGrupo = (W - m.l - m.r) / linhas.length;
  const larguraBarra = Math.max(4, Math.min(22, (larguraGrupo - 10) / series.length - 2));
  const y = (v) => m.t + (H - m.t - m.b) * (1 - v / fim);

  const grade = marcas.map((v) => `
    <line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="g-grade"/>
    <text x="${m.l - 8}" y="${y(v) + 4}" class="g-eixo" text-anchor="end">${reaisCompacto(v)}</text>`).join('');

  const grupos = linhas.map((l, i) => {
    const cx = m.l + larguraGrupo * (i + 0.5);
    const total = series.length * larguraBarra + (series.length - 1) * 2;
    const barras = series.map((s, k) => {
      const v = l[s.chave];
      const x = cx - total / 2 + k * (larguraBarra + 2);
      const prev = s.previsto?.(l);
      const dica = `${s.nome} · ${nomeMes(l.mes)}: ${formatarReais(v)}${prev ? ' (previsto)' : ''}`;
      return `<path d="${barra(x, y(v), larguraBarra, y(0) - y(v))}" fill="var(${s.cor})" class="${prev ? 'g-previsto' : ''}"/>
        <rect x="${x - 1}" y="${m.t}" width="${larguraBarra + 2}" height="${H - m.t - m.b}" class="g-alvo"
          data-dica="${escapar(dica)}" tabindex="-1"/>`;
    }).join('');
    return `${barras}<text x="${cx}" y="${H - 8}" class="g-eixo" text-anchor="middle">${mesCurto(l.mes)}</text>`;
  }).join('');

  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapar(titulo)}">
    ${grade}<line x1="${m.l}" x2="${W - m.r}" y1="${y(0)}" y2="${y(0)}" class="g-base"/>${grupos}</svg>`;
}

/**
 * Linha do saldo projetado no fim de cada mês, com a linha da reserva mínima.
 * pontos: [{ mes, valor, alerta }]
 */
export function linhaSaldo({ pontos, limite, titulo, alturaPx = 220 }) {
  const W = larguraLogica();
  const H = alturaPx;
  const m = { t: 16, r: 16, b: 26, l: 58 };
  const valores = [...pontos.map((p) => p.valor), limite, 0];
  const { ini, fim, marcas } = escala(Math.min(...valores), Math.max(...valores));
  const passoX = (W - m.l - m.r) / Math.max(1, pontos.length - 1);
  const x = (i) => m.l + passoX * i;
  const y = (v) => m.t + (H - m.t - m.b) * (1 - (v - ini) / (fim - ini || 1));

  const grade = marcas.map((v) => `
    <line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'g-base' : 'g-grade'}"/>
    <text x="${m.l - 8}" y="${y(v) + 4}" class="g-eixo" text-anchor="end">${reaisCompacto(v)}</text>`).join('');

  const caminho = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.valor)}`).join('');
  const area = `${caminho}L${x(pontos.length - 1)},${y(Math.max(ini, 0))}L${x(0)},${y(Math.max(ini, 0))}Z`;
  const marcadores = pontos.map((p, i) => {
    const dica = `Saldo no fim de ${nomeMes(p.mes)}: ${formatarReais(p.valor)}${p.alerta ? ' · abaixo da reserva mínima' : ''}`;
    return `<circle cx="${x(i)}" cy="${y(p.valor)}" r="${p.alerta ? 5.5 : 4.5}" class="${p.alerta ? 'g-ponto g-ponto-alerta' : 'g-ponto'}"/>
      <rect x="${x(i) - passoX / 2}" y="${m.t}" width="${passoX}" height="${H - m.t - m.b}" class="g-alvo" data-dica="${escapar(dica)}"/>
      <text x="${x(i)}" y="${H - 8}" class="g-eixo" text-anchor="middle">${mesCurto(p.mes)}</text>`;
  }).join('');
  const yl = y(limite);

  return `<svg class="grafico" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapar(titulo)}">
    ${grade}
    <path d="${area}" class="g-area"/>
    ${limite > 0 ? `<line x1="${m.l}" x2="${W - m.r}" y1="${yl}" y2="${yl}" class="g-limite"/>
      <text x="${W - m.r}" y="${yl - 6}" class="g-eixo g-limite-rotulo" text-anchor="end">reserva mínima</text>` : ''}
    <path d="${caminho}" class="g-linha"/>
    ${marcadores}</svg>`;
}
