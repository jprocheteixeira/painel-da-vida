// Checklist de pendências. Algumas se resolvem sozinhas pelos dados (ex.: nº da OC preenchido);
// as outras o usuário marca. Os textos são genéricos: nenhum dado pessoal no código.

import { itensDaOC } from './oc.js';

/** Pendências que o app sabe conferir: id → (estado) => feita? */
const AUTOMATICAS = {
  'oc-numero': (e) => Boolean(e.contrato.numeroOC),
  'oc-emails': (e) => Boolean(e.contrato.emailDanfse && e.contrato.emailXml),
  'oc-cnpj': (e) => Boolean(e.contrato.cnpjTomador),
  'oc-prazo': (e) => e.contrato.prazoPagamentoDias === 30,
  'oc-valor': (e) => itensDaOC(e.contrato).length > 0,
  'oc-base': (e) => Boolean(e.contrato.basePrazoConfirmada),
  'oc-aceite': (e) => Boolean(e.contrato.aceiteEnviadoEm),
  'saldo': (e) => Boolean(e.caixa.saldoEm),
};

export function pendenciasPadrao() {
  return [
    { id: 'oc-numero', texto: 'Nº da OC (Ajustes → Ordem de Compra)', feita: false },
    { id: 'oc-emails', texto: 'E-mails de envio da nota: DANFSE (PDF) e XML (Ajustes → Ordem de Compra)', feita: false },
    { id: 'oc-cnpj', texto: 'CNPJ do tomador, matriz (Ajustes → Ordem de Compra)', feita: false },
    { id: 'oc-prazo', texto: 'Prazo de pagamento: 30 DDL', feita: false },
    { id: 'oc-valor', texto: 'Valor fixo mensal: gerar os itens em Ajustes → Ordem de Compra', feita: false },
    { id: 'oc-base', texto: 'Confirmar com Compras a base de contagem dos 30 dias (depois marque aqui)', feita: false },
    { id: 'oc-aceite', texto: 'Enviar o aceite da OC por e-mail (Copiar texto → Enviei, acima)', feita: false },
    { id: 'saldo', texto: 'Informar o saldo atual das contas (Caixa) e os gastos fixos (Gastos)', feita: false },
    { id: 'contador-mei', texto: 'Contador: faturamento MEI pelo valor da NF, DAS no dia 20 e limite de R$ 20.250 em 2026', feita: false },
    { id: 'contador-cnae', texto: 'Contador: o código do serviço da nota combina com o CNAE do MEI?', feita: false },
    { id: 'node', texto: 'Instalar o Node LTS no PC de casa', feita: false },
  ];
}

/** Lista para mostrar: [{ id, texto, feita, automatica }]. As automáticas usam o texto atual do app. */
export function listaPendencias(estado) {
  const textos = Object.fromEntries(pendenciasPadrao().map((p) => [p.id, p.texto]));
  return (estado.pendencias || []).map((p) => {
    const regra = AUTOMATICAS[p.id];
    return {
      ...p,
      texto: regra ? textos[p.id] || p.texto : p.texto,
      feita: regra ? regra(estado) || Boolean(p.feita) : Boolean(p.feita),
      automatica: Boolean(regra),
    };
  });
}
