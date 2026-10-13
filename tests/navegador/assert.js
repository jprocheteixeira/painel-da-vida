// Substituto mínimo de "node:assert/strict" para o navegador.
class FalhaDeTeste extends Error {}

function falhar(msg, atual, esperado) {
  throw new FalhaDeTeste(`${msg}\n  obtido:   ${JSON.stringify(atual)}\n  esperado: ${JSON.stringify(esperado)}`);
}

function igualProfundo(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => igualProfundo(a[k], b[k]));
}

const assert = {
  equal(atual, esperado, msg = 'valores diferentes') {
    if (!Object.is(atual, esperado)) falhar(msg, atual, esperado);
  },
  deepEqual(atual, esperado, msg = 'estruturas diferentes') {
    if (!igualProfundo(atual, esperado)) falhar(msg, atual, esperado);
  },
  ok(valor, msg = 'esperado verdadeiro') {
    if (!valor) falhar(msg, valor, true);
  },
  match(texto, regex, msg = 'texto não confere') {
    if (!regex.test(texto)) falhar(msg, texto, String(regex));
  },
  throws(fn, padrao, msg = 'esperava um erro') {
    try { fn(); } catch (e) {
      if (padrao instanceof RegExp && !padrao.test(e.message)) falhar('mensagem de erro diferente', e.message, String(padrao));
      return;
    }
    falhar(msg, 'sem erro', 'erro');
  },
};
export default assert;
