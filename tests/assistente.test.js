import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial } from '../src/storage/migracoes.js';
import { gerarItens } from '../src/dominio/oc.js';
import { responder, resumoParaClaude, quando, PERGUNTAS } from '../src/dominio/assistente.js';

// valores fictícios
function cenario() {
  const e = estadoInicial();
  e.perfil.aberturaMei = '2026-10-03';
  Object.assign(e.contrato, {
    inicio: '2026-10-13', fim: '2027-04-15', numeroOC: '9999999', codigoItemOC: 'ABC000000001',
    cnpjTomador: '00.000.000/0002-00', emailDanfse: 'notas@exemplo.invalid', aceiteEnviadoEm: '2026-10-30',
    itensOC: gerarItens({ quantidade: 6, valorCentavos: 260000, primeiroDespacho: '2026-11-15' }),
  });
  e.dasTerceiros = { '2026-10': { quem: 'Pai', pedidoEm: null } };
  return e;
}

test('quando: hoje, amanhã, em N dias, há N dias', () => {
  assert.equal(quando('2026-11-02', '2026-11-02'), 'hoje');
  assert.equal(quando('2026-11-03', '2026-11-02'), 'amanhã');
  assert.equal(quando('2026-11-12', '2026-11-02'), 'em 10 dias');
  assert.equal(quando('2026-10-30', '2026-11-02'), 'há 3 dias');
});

test('respostas prontas usam os dados do aparelho', () => {
  const e = cenario();
  const hoje = '2026-11-02';
  for (const p of PERGUNTAS) assert.ok(responder(p.id, e, hoje).linhas.length, p.id);
  assert.match(responder('pendencia', e, hoje).linhas[0], /^12\/11\/2026 \(em 10 dias\): Pedir ao Pai o dinheiro do DAS/);
  const nota = responder('nota', e, hoje);
  assert.match(nota.linhas[0], /Item 1 \(novembro de 2026\): emitir de 15\/11\/2026 a 20\/11\/2026 \(abre em 13 dias\)/);
  assert.match(nota.linhas[1], /boletim até 13\/11\/2026, aprovação até 18\/11\/2026/);
  assert.match(nota.linhas[2], /OC 9999999 – Item 1 – ABC000000001/);
  assert.equal(nota.ir, '#/pj/2026-11');
  assert.match(responder('recebo', e, hoje).linhas[0], /Item 1: R\$ 2\.600,00 em 21\/12\/2026 \(entre 15\/12 e 21\/12\)/);
  assert.match(responder('recebo', e, hoje).linhas.at(-1), /Ainda a receber: R\$ 15\.600,00 em 6 itens/);
  const das = responder('das', e, hoje).linhas;
  assert.match(das[0], /DAS de 10\/2026: R\$ 86,05, pagar até 19\/11\/2026/);
  assert.match(das.join(' '), /Dinheiro do Pai: lembre de pedir/);
  assert.match(responder('oc', e, hoje).linhas[0], /Recebido: R\$ 0,00 de R\$ 15\.600,00/);
  assert.match(responder('semana', e, hoje).linhas[0], /Nada nos próximos 7 dias/);
});

test('janela perdida aparece na resposta da nota', () => {
  const e = cenario();
  e.medicoes['2026-11'] = { mes: '2026-11', estado: 'aprovado', historico: { boletim_enviado: '2026-11-13', aprovado: '2026-11-17' } };
  const r = responder('nota', e, '2026-11-21').linhas;
  assert.match(r[0], /janela do item 1 passou: só no próximo mês/);
  assert.match(r[1], /emitir de 15\/12\/2026 a 20\/12\/2026/);
});

test('resumo para o Claude não leva CNPJ, e-mails nem nº da OC', () => {
  const t = resumoParaClaude(cenario(), '2026-11-02', 'Como emito a nota?');
  assert.match(t, /hoje é 02\/11\/2026/);
  assert.match(t, /- Item 1 \(nov\/2026\): R\$ 2\.600,00 · Trabalhando · NF de 15\/11 a 20\/11 · recebe entre 15\/12 e 21\/12/);
  assert.match(t, /Próximo DAS: R\$ 86,05 até 19\/11\/2026 \(dinheiro do Pai\)/);
  assert.match(t, /Minha pergunta: Como emito a nota\?$/);
  assert.doesNotMatch(t, /9999999|00\.000\.000|exemplo\.invalid/);
});
