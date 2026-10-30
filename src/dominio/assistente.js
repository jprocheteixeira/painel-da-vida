// Assistente "?": respostas prontas a perguntas comuns, calculadas com os dados do próprio aparelho
// (sem internet), e um resumo em texto para colar numa conversa com o Claude.
// O resumo não leva CNPJ, e-mails nem nº da OC: só o necessário para tirar dúvidas.

import { diferencaDias, formatarData, nomeMes } from '../utils/datas.js';
import { formatarReais, somar } from '../utils/dinheiro.js';
import { ESTADOS, indiceEstado } from './medicao.js';
import { textoNFItem } from './oc.js';
import { linhaDoTempo, proximosPrazos, tarefasAutomaticas } from './prazos.js';
import { situacaoDas } from './mei.js';
import { listaPendencias } from './pendencias.js';
import { saldoAtual } from './caixa.js';

export const PERGUNTAS = Object.freeze([
  { id: 'pendencia', texto: 'Qual a minha próxima pendência?' },
  { id: 'semana', texto: 'O que tenho para fazer nos próximos 7 dias?' },
  { id: 'nota', texto: 'Quando emito a próxima nota?' },
  { id: 'recebo', texto: 'Quando eu recebo?' },
  { id: 'das', texto: 'Quando é o próximo DAS?' },
  { id: 'oc', texto: 'Quanto já recebi da OC?' },
]);

const curta = (iso) => formatarData(iso).slice(0, 5);

/** "hoje", "amanhã", "em 3 dias", "há 2 dias". */
export function quando(data, hoje) {
  const n = diferencaDias(hoje, data);
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n === -1) return 'ontem';
  return n > 0 ? `em ${n} dias` : `há ${-n} dias`;
}

const linhaTarefa = (t, hoje) => `${formatarData(t.data)} (${quando(t.data, hoje)}): ${t.titulo}`
  + `${t.detalhe ? ` (${t.detalhe})` : ''}${t.urgencia === 'atrasado' ? ' ⚠ atrasado' : ''}`;

function prazos(estado, hoje, dias) {
  return proximosPrazos(tarefasAutomaticas(estado, hoje), hoje, dias);
}

const notaPendente = (l) => indiceEstado(l.medicao.estado) < indiceEstado('nf_emitida');

/** Resposta: { titulo, linhas: [texto], ir: rota sugerida ou null }. */
export function responder(id, estado, hoje) {
  const linhas = linhaDoTempo(estado, hoje);
  switch (id) {
    case 'pendencia': {
      const t = prazos(estado, hoje, 3650)[0];
      const abertas = listaPendencias(estado).filter((p) => !p.feita);
      const r = [t ? linhaTarefa(t, hoje) : 'Nenhum prazo pela frente.'];
      if (abertas.length) {
        r.push(`Checklist: ${abertas.length} em aberto. ${abertas.slice(0, 3).map((p) => p.texto).join(' · ')}`
          + `${abertas.length > 3 ? ' …' : ''}`);
      }
      return { titulo: 'Próxima pendência', linhas: r, ir: t?.mes ? `#/pj/${t.mes}` : '#/' };
    }
    case 'semana': {
      const lista = prazos(estado, hoje, 7);
      return {
        titulo: 'Próximos 7 dias',
        linhas: lista.length ? lista.map((t) => linhaTarefa(t, hoje)) : ['Nada nos próximos 7 dias.'],
        ir: '#/',
      };
    }
    case 'nota': {
      const l = linhas.find(notaPendente);
      if (!l) {
        return { titulo: 'Próxima nota', linhas: [linhas.length ? 'Todas as notas da OC já foram emitidas.' : 'Cadastre os itens da OC em Ajustes.'], ir: linhas.length ? '#/' : '#/ajustes' };
      }
      const j = l.datas.janela;
      const r = [];
      if (l.datas.perdida) r.push(`⚠ A janela do item ${l.item.n} passou: só no próximo mês.`);
      r.push(`Item ${l.item.n} (${nomeMes(l.mes)}): emitir de ${formatarData(j.abre)} a ${formatarData(j.limite)} `
        + `(${hoje < j.abre ? `abre ${quando(j.abre, hoje)}` : hoje <= j.limite ? `fecha ${quando(j.limite, hoje)}` : 'fechada'}).`);
      r.push(`Antes: boletim ${l.medicao.historico.boletim_enviado ? 'enviado ✓' : `até ${formatarData(l.datas.envioBoletim.prazo)}`}, `
        + `aprovação ${l.medicao.historico.aprovado ? 'feita ✓' : `até ${formatarData(l.datas.aprovacao.prazo)}`}.`);
      r.push(`Valor: ${formatarReais(l.valorCentavos)}. Descrição: ${textoNFItem(l.item, estado.contrato)}`);
      r.push('Do dia 21 em diante a nota é recusada.');
      return { titulo: 'Próxima nota', linhas: r, ir: `#/pj/${l.mes}` };
    }
    case 'recebo': {
      const futuros = linhas.filter((l) => l.medicao.estado !== 'pago');
      if (!futuros.length) return { titulo: 'Recebimentos', linhas: [linhas.length ? 'Todos os itens da OC já foram pagos.' : 'Cadastre os itens da OC em Ajustes.'], ir: '#/caixa' };
      const r = futuros.slice(0, 3).map((l) => {
        const p = l.datas.pagamento;
        const faixa = p.maisCedo !== p.maisTarde ? ` (entre ${curta(p.maisCedo)} e ${curta(p.maisTarde)})` : '';
        return `Item ${l.item.n}: ${formatarReais(l.valorCentavos)} em ${formatarData(p.data)}${faixa}, ${quando(p.data, hoje)}.`;
      });
      r.push(`Ainda a receber: ${formatarReais(somar(futuros.map((l) => l.valorCentavos)))} em ${futuros.length} `
        + `${futuros.length === 1 ? 'item' : 'itens'}. Previsão com 30 DDL; a base de contagem está a confirmar.`);
      return { titulo: 'Quando eu recebo', linhas: r, ir: '#/caixa' };
    }
    case 'das': {
      const d = situacaoDas(estado, estado.caixa.horizonte).find((x) => !x.pagoEm);
      if (!d) return { titulo: 'DAS do MEI', linhas: [estado.perfil.aberturaMei ? 'Nenhum DAS em aberto até o fim da projeção.' : 'Informe a abertura do MEI em Ajustes → Perfil.'], ir: '#/caixa' };
      const comp = `${d.competencia.slice(5)}/${d.competencia.slice(0, 4)}`;
      const r = [`DAS de ${comp}: ${formatarReais(d.valorCentavos)}, pagar até ${formatarData(d.pagarAte)} (${quando(d.pagarAte, hoje)}).`];
      if (d.pagarAte !== d.vencimento) r.push(`O vencimento é ${formatarData(d.vencimento)}, mas cai em dia não útil.`);
      if (d.pagoPor) r.push(d.pedidoEm ? `Dinheiro do ${d.pagoPor}: já pedido.` : `Dinheiro do ${d.pagoPor}: lembre de pedir.`);
      return { titulo: 'Próximo DAS', linhas: r, ir: '#/caixa' };
    }
    case 'oc': {
      if (!linhas.length) return { titulo: 'Ordem de Compra', linhas: ['Cadastre os itens da OC em Ajustes.'], ir: '#/ajustes' };
      const soma = (f) => somar(linhas.filter(f).map((l) => l.valorCentavos));
      const pago = soma((l) => l.medicao.estado === 'pago');
      const emitido = soma((l) => !notaPendente(l) && l.medicao.estado !== 'pago');
      const total = soma(() => true);
      return {
        titulo: 'Ordem de Compra',
        linhas: [
          `Recebido: ${formatarReais(pago)} de ${formatarReais(total)}.`,
          `Com nota emitida, aguardando: ${formatarReais(emitido)}.`,
          `Falta emitir: ${formatarReais(total - pago - emitido)} (${linhas.filter(notaPendente).length} de ${linhas.length} itens).`,
        ],
        ir: '#/',
      };
    }
    default:
      return { titulo: 'Pergunta desconhecida', linhas: [], ir: null };
  }
}

/** Resumo em texto para colar numa conversa com o Claude (sem CNPJ, e-mails nem nº da OC). */
export function resumoParaClaude(estado, hoje, pergunta = '') {
  const c = estado.contrato;
  const r = [
    `Contexto do meu app "Painel da Vida" (hoje é ${formatarData(hoje)}).`,
    'Sou MEI e presto serviço por uma Ordem de Compra com itens mensais de valor fixo. '
      + `A NFS-e só pode ser emitida do dia ${c.nfDiaAbre} ao ${c.nfDiaLimite} do mês do item (depois é recusada); `
      + `pagamento ${c.prazoPagamentoDias} DDL${c.basePrazoConfirmada ? '' : ' (base de contagem a confirmar)'}.`,
    '',
    'Itens da OC:',
  ];
  for (const l of linhaDoTempo(estado, hoje)) {
    const p = l.datas.pagamento;
    r.push(`- Item ${l.item.n} (${nomeMes(l.mes, true)}): ${formatarReais(l.valorCentavos)} · ${ESTADOS[indiceEstado(l.medicao.estado)].nome}`
      + ` · NF de ${curta(l.datas.janela.abre)} a ${curta(l.datas.janela.limite)}${l.datas.perdida ? ' (janela perdida)' : ''}`
      + ` · ${p.real ? `pago em ${curta(p.data)}` : p.maisCedo !== p.maisTarde ? `recebe entre ${curta(p.maisCedo)} e ${curta(p.maisTarde)}` : `recebe ${curta(p.data)}`}`);
  }
  const lista = prazos(estado, hoje, 30);
  r.push('', 'Prazos dos próximos 30 dias:', ...(lista.length ? lista.map((t) => `- ${linhaTarefa(t, hoje)}`) : ['- nenhum']));
  const das = situacaoDas(estado, estado.caixa.horizonte).find((d) => !d.pagoEm);
  if (das) r.push('', `Próximo DAS: ${formatarReais(das.valorCentavos)} até ${formatarData(das.pagarAte)}${das.pagoPor ? ` (dinheiro do ${das.pagoPor})` : ''}.`);
  const abertas = listaPendencias(estado).filter((p) => !p.feita);
  if (abertas.length) r.push('', 'Pendências em aberto:', ...abertas.map((p) => `- ${p.texto}`));
  r.push('', estado.caixa.saldoEm
    ? `Saldo hoje: ${formatarReais(saldoAtual(estado, hoje))} (informado em ${formatarData(estado.caixa.saldoEm)}).`
    : 'Saldo das contas: ainda não informado.');
  r.push('', `Minha pergunta: ${pergunta.trim() || ''}`);
  return r.join('\n');
}
