// Substituto mínimo de "node:test" para rodar os mesmos testes no navegador (tests/index.html).
export const testes = [];
export function test(nome, fn) {
  testes.push({ nome, fn });
}
export default test;
