// Prazos gerados automaticamente: medições e notas dos itens da OC, aceite da OC e DAS do MEI.

import { diferencaDias, rotuloCompetencia, mesDe, formatarData, somarDias } from '../utils/datas.js';
import { diasPrevistos } from './contrato.js';
import { datasChave, indiceEstado, novaMedicao } from './medicao.js';
import { itensDaOC } from './oc.js';
import { situacaoDas } from './mei.js';

/** Urgência pela distância até a data: 'atrasado' | 'hoje' | 'proximo' (≤ 3 dias) | 'normal'. */
export function urgencia(data, hoje) {
  const d = diferencaDias(hoje, data);
  if (d < 0) return 'atrasado';
  if (d === 0) return 'hoje';
  if (d <= 3) return 'proximo';
  return 'normal';
}

const curta = (iso) => formatarData(iso).slice(0, 5);

/** Lembretes da janela da NF: abre (15), lembrete forte (18) e último dia (20). Só os de hoje em diante. */
function lembretesJanela(base, n, janela, hoje) {
  return [
    { sufixo: 'abre', data: janela.abre, titulo: `Abriu a janela da NF do item ${n}`, detalhe: `emitir até ${curta(janela.limite)}` },
    { sufixo: 'forte', data: janela.lembrete, titulo: `Emitir a NF do item ${n}: a janela fecha dia ${janela.limite.slice(8)}`, detalhe: 'depois do dia 20 a nota é recusada' },
    { sufixo: 'ultimo', data: janela.limite, titulo: `Último dia para emitir a NF do item ${n}`, detalhe: 'nota emitida do dia 21 em diante é recusada' },
  ]
    .filter((l, k, todos) => l.data >= hoje && todos.findIndex((o) => o.data === l.data) === k)
    .map((l) => ({ ...base, id: `pj:${base.mes}:nf-${l.sufixo}:${mesDe(janela.abre)}`, data: l.data, titulo: l.titulo, detalhe: l.detalhe }));
}

/**
 * Tarefas de cada item da OC: a próxima ação pendente do fluxo e, enquanto a NF não sai, os lembretes
 * da janela. Perdeu a janela: alerta vermelho e lembretes da janela do mês seguinte.
 * Itens futuros sem dia previsto e ainda em "trabalhando" não geram tarefa de boletim.
 */
export function tarefasPJ({ contrato, feriados, marcas, medicoes }, hoje) {
  const tarefas = [];
  for (const item of itensDaOC(contrato)) {
    const mes = mesDe(item.despacho);
    const medicao = medicoes[mes] || novaMedicao(mes);
    const datas = datasChave(mes, { contrato, feriados, medicao, hoje });
    const competencia = rotuloCompetencia(mes);
    const i = indiceEstado(medicao.estado);
    const base = { mes, origem: 'pj', competencia, item: item.n };
    const previstos = diasPrevistos(datas.periodo, marcas, contrato, feriados, hoje);
    if (i === 0 && (previstos.length || datas.periodo.inicio <= hoje)) {
      tarefas.push({ ...base, id: `pj:${mes}:boletim`, data: datas.envioBoletim.prazo,
        titulo: `Enviar boletim e relatório do item ${item.n} (${competencia})` });
    } else if (i === 1) {
      tarefas.push({ ...base, id: `pj:${mes}:aprovacao`, data: datas.aprovacao.prazo,
        titulo: `Aprovação do boletim do item ${item.n} (${competencia})` });
    }
    if (i <= 2) {
      if (datas.perdida) {
        tarefas.push({ ...base, id: `pj:${mes}:perdeu`, origem: 'pj-perdeu', data: datas.janelaItem.limite,
          titulo: `Perdeu a janela da NF do item ${item.n}: só no próximo mês`,
          detalhe: `nova janela ${curta(datas.janela.abre)} a ${curta(datas.janela.limite)}; recebe entre `
            + `${curta(datas.pagamento.maisCedo)} e ${curta(datas.pagamento.maisTarde)}` });
      }
      if (i > 0 || previstos.length || datas.periodo.inicio <= hoje) tarefas.push(...lembretesJanela(base, item.n, datas.janela, hoje));
    } else if (i === 3) {
      tarefas.push({ ...base, id: `pj:${mes}:email`, data: datas.emissaoNF.data,
        titulo: `Enviar DANFSE (PDF) e XML do item ${item.n} por e-mail` });
    } else if (i === 4) {
      tarefas.push({ ...base, id: `pj:${mes}:pagamento`, data: datas.pagamento.data,
        titulo: `Pagamento previsto do item ${item.n} (${competencia})`, valorCentavos: item.valorCentavos });
    }
  }
  return tarefas.sort((a, b) => a.data.localeCompare(b.data));
}

/** Tarefa "enviar o aceite da OC" enquanto não for marcada como enviada (prazo: o quanto antes = hoje). */
export function tarefaAceite(contrato, hoje) {
  if (!itensDaOC(contrato).length || contrato.aceiteEnviadoEm) return [];
  return [{ id: 'oc:aceite', origem: 'aceite', data: hoje, titulo: 'Enviar aceite da OC por e-mail',
    detalhe: 'pendente · o quanto antes, citando os itens e as condições' }];
}

/** Tarefas até `dias` à frente, mais as atrasadas. */
export function proximosPrazos(tarefas, hoje, dias = 14) {
  return tarefas
    .filter((t) => diferencaDias(hoje, t.data) <= dias)
    .map((t) => ({ ...t, urgencia: t.origem === 'pj-perdeu' ? 'atrasado' : urgencia(t.data, hoje) }));
}

/**
 * Linha "trabalhado → recebido" de cada item da OC: valor fixo, dias (só informação) e datas.
 */
export function linhaDoTempo({ contrato, feriados, marcas, medicoes }, hoje) {
  return itensDaOC(contrato).map((item) => {
    const mes = mesDe(item.despacho);
    const medicao = medicoes[mes] || novaMedicao(mes);
    const datas = datasChave(mes, { contrato, feriados, medicao, hoje });
    const dias = Object.keys(marcas).filter((d) => marcas[d] === 'trabalhado' && d >= datas.periodo.inicio && d <= datas.periodo.fim);
    const previstos = diasPrevistos(datas.periodo, marcas, contrato, feriados, hoje);
    return {
      mes,
      item,
      medicao,
      diasTrabalhados: dias.length,
      diasPrevistos: previstos.length,
      valorCentavos: item.valorCentavos,
      datas,
    };
  });
}

export const DIAS_ANTES_PEDIR = 7;

/**
 * Lembretes do DAS ainda não pago (até o mês que vem). Se outra pessoa paga, vem antes um lembrete
 * para pedir o dinheiro (uma semana antes do prazo, ou hoje se já passou).
 */
export function tarefasDAS(estado, hoje, ateMes = mesDe(hoje)) {
  return situacaoDas(estado, ateMes)
    .filter((d) => !d.pagoEm)
    .flatMap((d) => {
      const comp = `${d.competencia.slice(5)}/${d.competencia.slice(0, 4)}`;
      const prazo = d.pagarAte !== d.vencimento ? `vence ${formatarData(d.vencimento)}; pague até ${formatarData(d.pagarAte)}` : '';
      const pagar = {
        id: `das:${d.competencia}`, origem: 'das', competencia: d.competencia, data: d.pagarAte,
        titulo: `Pagar o DAS do MEI (${comp})${d.pagoPor ? ` · dinheiro do ${d.pagoPor}` : ''}`,
        detalhe: prazo, valorCentavos: d.valorCentavos,
      };
      if (!d.pagoPor || d.pedidoEm) return [pagar];
      const pedirEm = somarDias(d.pagarAte, -DIAS_ANTES_PEDIR);
      const pedir = {
        id: `das-pedir:${d.competencia}`, origem: 'das-pedir', competencia: d.competencia,
        data: pedirEm > hoje ? pedirEm : hoje,
        titulo: `Pedir ao ${d.pagoPor} o dinheiro do DAS (${comp})`,
        detalhe: `para pagar até ${formatarData(d.pagarAte)}`, valorCentavos: d.valorCentavos,
      };
      return [pedir, pagar];
    });
}

/** Todas as tarefas automáticas (aceite + PJ + DAS), em ordem de data. */
export function tarefasAutomaticas(estado, hoje) {
  const { contrato, feriados, marcas, medicoes } = estado;
  return [...tarefaAceite(contrato, hoje), ...tarefasPJ({ contrato, feriados, marcas, medicoes }, hoje), ...tarefasDAS(estado, hoje)]
    .sort((a, b) => a.data.localeCompare(b.data));
}

