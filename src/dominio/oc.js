// Ordem de Compra (OC): itens mensais de valor fixo, janela de emissão da NFS-e, prazo de pagamento
// e textos (descrição da nota e aceite da OC).
//
// Premissas (da OC; o que não está escrito nela fica editável e marcado "a confirmar"):
// - cada item vale um valor FIXO; os dias trabalhados são só informação;
// - o mês do item é o mês da data de despacho; o período do item vai do dia seguinte ao despacho
//   anterior até o despacho dele (o 1º começa no início do contrato ou na entrada da OC);
// - a NFS-e só pode ser emitida do dia `nfDiaAbre` ao dia `nfDiaLimite` (15 a 20) do mês; nota emitida
//   do dia 21 ao fim do mês é recusada. Perdeu a janela: só na janela do mês seguinte;
// - pagamento = base + `prazoPagamentoDias` dias corridos, passando para o próximo dia útil. A base de
//   contagem não está escrita na OC: padrão "data de emissão", a confirmar com Compras.

import {
  mesDe, somarMeses, somarDias, ultimoDiaDoMes, formatarData,
} from '../utils/datas.js';
import { formatarReais, somar } from '../utils/dinheiro.js';
import { somarDiasCorridosAteUtil } from './calendario.js';

export const BASES_PRAZO = Object.freeze({
  emissao: 'Data de emissão da NF',
  entrada: 'Data de entrada da NF na empresa (envio por e-mail)',
  fimMes: 'Fim do mês da emissão',
});

/** Base de contagem no meio de uma frase ("contados …"). */
export const BASES_PRAZO_FRASE = Object.freeze({
  emissao: 'da data de emissão da NF',
  entrada: 'da data de entrada da NF na empresa',
  fimMes: 'do fim do mês da emissão',
});

const dd = (n) => String(n).padStart(2, '0');

/** Itens da OC em ordem: [{ n, despacho, valorCentavos }]. */
export function itensDaOC(contrato) {
  return [...(contrato.itensOC || [])].sort((a, b) => a.n - b.n);
}

/** Mesma data `k` meses depois (dia limitado ao fim do mês). */
function mesmaDataDepois(iso, k) {
  const mes = somarMeses(mesDe(iso), k);
  const fim = ultimoDiaDoMes(mes);
  const dia = `${mes}-${iso.slice(8)}`;
  return dia > fim ? fim : dia;
}

/** Gera `quantidade` itens mensais a partir do 1º despacho. */
export function gerarItens({ quantidade, valorCentavos, primeiroDespacho }) {
  return Array.from({ length: quantidade }, (_, k) => ({
    n: k + 1, despacho: mesmaDataDepois(primeiroDespacho, k), valorCentavos,
  }));
}

export function totalDaOC(contrato) {
  return somar(itensDaOC(contrato).map((i) => i.valorCentavos));
}

/** Item cujo despacho cai no mês ("aaaa-mm"), ou null. */
export function itemDoMes(contrato, mes) {
  return itensDaOC(contrato).find((i) => mesDe(i.despacho) === mes) || null;
}

/** Meses ("aaaa-mm") dos itens da OC. */
export function mesesDaOC(contrato) {
  return itensDaOC(contrato).map((i) => mesDe(i.despacho));
}

/** Período de atividade coberto pelo item. */
export function periodoItem(contrato, item) {
  const itens = itensDaOC(contrato);
  const k = itens.findIndex((i) => i.n === item.n);
  if (k > 0) return { inicio: somarDias(itens[k - 1].despacho, 1), fim: item.despacho };
  const candidatos = [contrato.inicio, contrato.dataEntradaOC].filter((d) => d && d <= item.despacho).sort();
  return { inicio: candidatos[0] || somarDias(mesmaDataDepois(item.despacho, -1), 1), fim: item.despacho };
}

/** Item que cobre o dia (o primeiro com despacho a partir dele), ou null depois do último. */
export function itemDoDia(contrato, iso) {
  return itensDaOC(contrato).find((i) => iso <= i.despacho) || null;
}

/** Janela de emissão da NF no mês: { abre, lembrete, limite }. */
export function janelaNF(mes, contrato) {
  const abre = Math.min(contrato.nfDiaAbre, contrato.nfDiaLimite);
  const limite = contrato.nfDiaLimite;
  const fim = Number(ultimoDiaDoMes(mes).slice(8));
  return {
    abre: `${mes}-${dd(Math.min(abre, fim))}`,
    lembrete: `${mes}-${dd(Math.min(Math.max(abre, limite - 2), fim))}`,
    limite: `${mes}-${dd(Math.min(limite, fim))}`,
  };
}

export function dentroDaJanela(data, contrato) {
  const j = janelaNF(mesDe(data), contrato);
  return data >= j.abre && data <= j.limite;
}

/** Motivo para recusar a emissão da NF do item nesta data, ou null se pode. */
export function motivoRecusaEmissao(data, item, contrato) {
  const j = janelaNF(mesDe(item.despacho), contrato);
  if (data < j.abre) return `A janela da NF do item ${item.n} só abre em ${formatarData(j.abre)}.`;
  if (!dentroDaJanela(data, contrato)) {
    return `A NFS-e só pode ser emitida do dia ${contrato.nfDiaAbre} ao dia ${contrato.nfDiaLimite} do mês. `
      + `Nota emitida em ${formatarData(data)} é recusada.`;
  }
  return null;
}

/**
 * Emissão prevista da NF do item ainda não emitida: o dia escolhido (`diaEmissao`, dentro da janela)
 * do mês do item; se essa data já passou, hoje (se a janela ainda está aberta); se a janela fechou,
 * a do mês seguinte. Devolve { data, maisCedo, maisTarde, mes, perdida }.
 */
export function emissaoPrevista(item, contrato, hoje, diaEmissao = contrato.diaEmissaoPrevisto) {
  const mesItem = mesDe(item.despacho);
  for (let mes = mesItem; ; mes = somarMeses(mes, 1)) {
    const j = janelaNF(mes, contrato);
    if (hoje > j.limite) continue;
    const pedido = `${mes}-${dd(diaEmissao)}`;
    const escolhido = pedido < j.abre ? j.abre : pedido > j.limite ? j.limite : pedido;
    const maisCedo = hoje > j.abre ? hoje : j.abre;
    return {
      data: escolhido < hoje ? hoje : escolhido,
      maisCedo,
      maisTarde: j.limite,
      mes,
      perdida: mes !== mesItem,
    };
  }
}

/** Base da contagem do prazo de pagamento. */
export function basePagamento(emissao, contrato, envio) {
  if (contrato.basePrazo === 'fimMes') return ultimoDiaDoMes(mesDe(emissao));
  if (contrato.basePrazo === 'entrada') return envio && envio > emissao ? envio : emissao;
  return emissao;
}

/** Data de pagamento: base + prazo em dias corridos, passando para o próximo dia útil. */
export function dataPagamento(emissao, contrato, feriados, envio = null) {
  return somarDiasCorridosAteUtil(basePagamento(emissao, contrato, envio), contrato.prazoPagamentoDias, feriados);
}

const PENDENTE = '[PENDENTE]';

/** Descrição da NFS-e no formato exigido pela OC. */
export function textoNFItem(item, contrato) {
  return [
    `OC ${contrato.numeroOC || PENDENTE}`,
    `Item ${item.n}`,
    contrato.codigoItemOC || '[CÓDIGO DO ITEM]',
    (contrato.descricaoServico || '').trim(),
    `Mês ${item.n}`,
  ].join(' – ');
}

/** Texto do e-mail de aceite da OC, citando os itens e as condições. */
export function textoAceite(contrato, perfil = {}) {
  const itens = itensDaOC(contrato);
  const oc = contrato.numeroOC || PENDENTE;
  const linhas = [
    `Assunto: Aceite da Ordem de Compra nº ${oc}`,
    '',
    'Prezados,',
    '',
    `Confirmo o recebimento e o aceite da Ordem de Compra nº ${oc}`
      + `${contrato.dataEntradaOC ? `, com entrada em ${formatarData(contrato.dataEntradaOC)}` : ''}, nas condições abaixo.`,
    '',
    'Itens:',
    ...itens.map((i) => `- Item ${i.n} – Mês ${i.n} – data para despacho ${formatarData(i.despacho)} – ${formatarReais(i.valorCentavos)}`),
    `Total: ${formatarReais(totalDaOC(contrato))}`,
  ];
  if (itens.length) linhas.push(`Entrega final: ${formatarData(itens.at(-1).despacho)}`);
  linhas.push(
    '',
    'Condições:',
    `- Nota fiscal (NFS-e) emitida entre os dias ${contrato.nfDiaAbre} e ${contrato.nfDiaLimite} do mês de cada item, `
      + 'com o número da OC e o item na descrição.',
  );
  const envio = [
    contrato.emailDanfse && `PDF (DANFSE) para ${contrato.emailDanfse}`,
    contrato.emailXml && `XML para ${contrato.emailXml}`,
  ].filter(Boolean);
  if (envio.length) linhas.push(`- Envio da nota: ${envio.join('; ')}.`);
  linhas.push(
    `- Pagamento: ${contrato.prazoPagamentoDias} DDL${contrato.formaPagamento ? `, por ${contrato.formaPagamento}` : ''}.`,
    '',
    'Atenciosamente,',
    [perfil.nome, perfil.cnpj && `CNPJ ${perfil.cnpj}`].filter(Boolean).join(' — ') || '[seu nome e CNPJ]',
  );
  return linhas.join('\n');
}

