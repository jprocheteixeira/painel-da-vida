// Dinheiro sempre em centavos inteiros. Nada de float: a conversão de texto é feita
// separando reais e centavos como texto.

/** 123456 → "R$ 1.234,56"; −500 → "−R$ 5,00". */
export function formatarReais(centavos, { sinal = false } = {}) {
  if (!Number.isInteger(centavos)) throw new TypeError(`Valor em centavos inválido: ${centavos}`);
  const abs = Math.abs(centavos);
  const reais = String(Math.trunc(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = String(abs % 100).padStart(2, '0');
  const prefixo = centavos < 0 ? '−' : (sinal && centavos > 0 ? '+' : '');
  return `${prefixo}R$ ${reais},${cents}`;
}

/**
 * Lê um valor digitado e devolve centavos (ou null se não der para ler).
 * Aceita "1.234,56", "1234,5", "R$ 200", "86.05" e "-15,00".
 * Com vírgula, ela é o separador decimal e os pontos são de milhar. Sem vírgula, um único
 * ponto seguido de 1 ou 2 dígitos é decimal; nos outros casos, o ponto é de milhar.
 */
export function lerReais(texto) {
  if (typeof texto === 'number') {
    return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  }
  if (typeof texto !== 'string') return null;
  let t = texto.replace(/R\$|\s/gi, '').replace('−', '-');
  if (!t) return null;
  let negativo = false;
  if (t.startsWith('-')) { negativo = true; t = t.slice(1); }

  let inteiro;
  let fracao = '';
  if (t.includes(',')) {
    const partes = t.split(',');
    if (partes.length !== 2) return null;
    inteiro = partes[0].replace(/\./g, '');
    fracao = partes[1];
  } else if (/^\d+\.\d{1,2}$/.test(t)) {
    [inteiro, fracao] = t.split('.');
  } else {
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(t)) return null;
    inteiro = t.replace(/\./g, '');
  }
  if (!/^\d*$/.test(inteiro) || !/^\d{0,2}$/.test(fracao) || (inteiro + fracao) === '') return null;
  const centavos = Number(inteiro || '0') * 100 + Number(fracao.padEnd(2, '0'));
  if (!Number.isSafeInteger(centavos)) return null;
  return negativo ? -centavos : centavos;
}

/** Formato de edição (sem "R$"): 123456 → "1.234,56". */
export function centavosParaCampo(centavos) {
  if (centavos == null) return '';
  return formatarReais(centavos).replace('R$ ', '');
}

export function somar(valores) {
  return valores.reduce((total, v) => total + v, 0);
}

/** Esconde os valores em reais de um texto ou HTML ("R$ 1.234,56", "−R$ 5,00", "R$ 2,4 mil" → "R$ ••••"). */
export function ocultarValores(texto) {
  return String(texto).replace(/[−+-]?R\$\s?\d[\d.]*(?:,\d+)?(?:\s?mil)?/g, 'R$ ••••');
}
