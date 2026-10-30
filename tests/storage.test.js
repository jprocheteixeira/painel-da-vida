import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estadoInicial, migrar, VERSAO_ATUAL } from '../src/storage/migracoes.js';
import { gerarBackup, lerBackup, precisaLembreteBackup, proximoBackup } from '../src/storage/backup.js';
import { estadoDeExemplo } from '../src/storage/exemplo.js';

test('migra dados sem versão e completa padrões', () => {
  const d = migrar({ perfil: { nome: 'Fulano' }, marcas: { '2026-10-14': 'trabalhado' } });
  assert.equal(d.versao, VERSAO_ATUAL);
  assert.equal(d.perfil.nome, 'Fulano');
  assert.equal(d.perfil.cnpj, '');
  assert.equal(d.contrato.prazoPagamentoDias, 30);
  assert.equal(d.contrato.nfDiaLimite, 20);
  assert.deepEqual(d.contrato.itensOC, []);
  assert.ok(d.feriados.length > 20);
  assert.deepEqual(d.marcas, { '2026-10-14': 'trabalhado' });
});

test('migração v5 → v6 (Ordem de Compra) não perde dados', () => {
  const descricaoV5 = 'Preparação de documentos e apoio técnico-administrativo: '
    + 'organização de bases de dados, cadastros e controles.';
  const v5 = {
    versao: 5,
    perfil: { nome: 'Fulano', cnpj: '00.000.000/0001-00', aberturaMei: '2026-10-03' },
    contrato: { valorDiaCentavos: 20000, diasSemana: [2, 3, 4], tetoSemanal: 3, inicio: '2026-10-13', fim: '2027-04-13',
      prazoPagamentoDias: 60, diaCorte: 0, pedidoCompra: '1234567', tomador: 'Empresa (fictícia)',
      emailEnvio: 'nf@exemplo.invalid', descricaoServico: descricaoV5 },
    marcas: { '2026-10-13': 'trabalhado', '2026-10-14': 'folga' },
    medicoes: { '2026-10': { mes: '2026-10', estado: 'boletim_enviado', historico: { boletim_enviado: '2026-10-30' },
      resumo: 'Relatório de outubro.', numeroNF: '' } },
    lancamentos: [{ id: 'g1', data: '2026-10-20', valorCentavos: 1500, categoriaId: 'mercado', nota: '' }],
    dasPagos: { '2026-10': '2026-11-19' },
    dasTerceiros: { '2026-10': { quem: 'Pai', pedidoEm: null } },
    caixa: { saldoEm: '2026-10-20', reservaMinimaCentavos: 100000, horizonte: '2027-06' },
    meta: { ultimoBackup: '2026-10-30', exemplo: false },
  };
  const d = migrar(structuredClone(v5));
  assert.equal(d.versao, 6);
  assert.equal(d.contrato.numeroOC, '1234567');
  assert.equal(d.contrato.emailDanfse, 'nf@exemplo.invalid');
  assert.ok(!('pedidoCompra' in d.contrato) && !('emailEnvio' in d.contrato));
  assert.equal(d.contrato.prazoPagamentoDias, 30);
  assert.equal(d.contrato.basePrazo, 'emissao');
  assert.equal(d.contrato.basePrazoConfirmada, false);
  assert.equal(d.contrato.valorDiaReferenciaCentavos, 20000); // guardado, mas não multiplica mais nada
  assert.match(d.contrato.descricaoServico, /^Contratação de serviço técnico/);
  assert.equal(d.contrato.tomador, 'Empresa (fictícia)');
  // a medição de outubro (nota em novembro) vira a do item de novembro
  assert.deepEqual(Object.keys(d.medicoes), ['2026-11']);
  assert.equal(d.medicoes['2026-11'].estado, 'boletim_enviado');
  assert.equal(d.medicoes['2026-11'].resumo, 'Relatório de outubro.');
  assert.equal(d.medicoes['2026-11'].competenciaOrigem, '2026-10');
  for (const chave of ['perfil', 'marcas', 'lancamentos', 'dasPagos', 'dasTerceiros', 'caixa', 'meta']) {
    assert.deepEqual(d[chave], v5[chave], chave);
  }
  assert.ok(d.pendencias.length > 5);
  // descrição personalizada é mantida
  assert.equal(migrar({ ...structuredClone(v5), contrato: { descricaoServico: 'Minha descrição' } }).contrato.descricaoServico,
    'Minha descrição');
});

test('não traz de volta feriado apagado pelo usuário', () => {
  const e = estadoInicial();
  e.feriados = e.feriados.filter((f) => f.data !== '2026-12-09');
  const d = migrar(e);
  assert.ok(!d.feriados.some((f) => f.data === '2026-12-09'));
});

test('recusa dados de versão futura e lixo', () => {
  assert.throws(() => migrar({ versao: VERSAO_ATUAL + 1 }), /versão mais nova/);
  assert.throws(() => migrar(null));
  assert.throws(() => lerBackup('não é json'), /JSON/);
  assert.throws(() => lerBackup('{"app":"outro","dados":{}}'), /não é um backup/);
});

test('backup vai e volta igual', () => {
  const e = estadoDeExemplo('2026-11-18');
  const texto = JSON.stringify(gerarBackup(e, '2026-11-18T10:00:00Z'));
  assert.deepEqual(lerBackup(texto), e);
});

test('lembrete de backup no último dia útil do mês', () => {
  const e = estadoInicial();
  assert.equal(precisaLembreteBackup(e, '2026-10-30'), false); // sem dados
  e.contrato.inicio = '2026-10-13';
  assert.equal(proximoBackup(e, '2026-10-13'), '2026-10-30');
  assert.equal(precisaLembreteBackup(e, '2026-10-29'), false);
  assert.equal(precisaLembreteBackup(e, '2026-10-30'), true);
  assert.equal(precisaLembreteBackup(e, '2026-11-03'), true); // continua até fazer
  e.meta.ultimoBackup = '2026-10-30';
  assert.equal(precisaLembreteBackup(e, '2026-11-03'), false);
  assert.equal(proximoBackup(e, '2026-11-03'), '2026-11-30');
  assert.equal(proximoBackup(e, '2027-01-04'), '2026-12-31'); // dezembro ficou para trás
  e.meta.ultimoBackup = '2026-12-31';
  assert.equal(proximoBackup(e, '2026-12-31'), '2027-01-29');
});

test('pendências automáticas se resolvem pelos dados', async () => {
  const { listaPendencias } = await import('../src/dominio/pendencias.js');
  const e = estadoInicial();
  e.pendencias[0].texto = 'texto antigo';
  const feita = (id) => listaPendencias(e).find((p) => p.id === id).feita;
  assert.equal(feita('oc-numero'), false);
  assert.match(listaPendencias(e)[0].texto, /Ajustes → Ordem de Compra/); // texto atualizado
  e.contrato.numeroOC = '9999999';
  e.contrato.emailDanfse = 'a@exemplo.invalid';
  assert.equal(feita('oc-numero'), true);
  assert.equal(feita('oc-emails'), false); // precisa dos dois
  e.contrato.emailXml = 'b@exemplo.invalid';
  assert.equal(feita('oc-emails'), true);
  assert.equal(feita('node'), false);
});
