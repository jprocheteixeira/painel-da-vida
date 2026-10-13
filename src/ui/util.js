// Utilitários de interface (sem regra de negócio).

const MAPA = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa texto vindo dos dados antes de entrar no HTML. */
export function escapar(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => MAPA[c]);
}

/** Template literal que escapa as interpolações; use `html.cru(x)` para HTML já pronto. */
export function html(partes, ...valores) {
  return partes.reduce((saida, parte, i) => {
    if (i === 0) return parte;
    const v = valores[i - 1];
    const texto = v && v.__cru ? v.valor : Array.isArray(v) ? v.join('') : escapar(v);
    return saida + texto + parte;
  }, '');
}
html.cru = (valor) => ({ __cru: true, valor: Array.isArray(valor) ? valor.join('') : String(valor ?? '') });

const ICONES = {
  alerta: '<path d="M12 3l9.5 17h-19z"/><path d="M12 10v4.5M12 17.5v.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.01"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
  esquerda: '<path d="M15 5l-7 7 7 7"/>',
  direita: '<path d="M9 5l7 7-7 7"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  desfazer: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  lixo: '<path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/>',
};

export function icone(nome, classe = 'ic') {
  return `<svg class="${classe}" viewBox="0 0 24 24" aria-hidden="true">${ICONES[nome] || ''}</svg>`;
}

/** Copia texto (com alternativa para quando a API de área de transferência não está disponível). */
export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const area = document.createElement('textarea');
    area.value = texto;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.append(area);
    area.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    area.remove();
    return ok;
  }
}

/** Oferece um arquivo para baixar (gerado no próprio navegador). */
export function baixarArquivo(nome, conteudo, tipo = 'application/json') {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
