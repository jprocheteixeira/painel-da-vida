// Prazos gerados automaticamente: medições do PJ e DAS do MEI (a agenda manual vem na F4).

import { diferencaDias, rotuloCompetencia, mesDe, formatarData, somarDias } from '../utils/datas.js';
import { competenciasDoContrato, diasPrevistos, periodoCompetencia } from './contrato.js';
import { datasChave, indiceEstado, novaMedicao, resumoMedicao } from './medicao.js';
import { situacaoDas } from './mei.js';

/** Urgência pela distância até a data: 'atrasado' | 'hoje' | 'proximo' (≤ 3 dias) | 'normal'. */
export function urgencia(data, hoje) {
  const d = diferencaDias(hoje, data);
  if (d < 0) return 'atrasado';
  if (d === 0) return 'hoje';
  if (d <= 3) return 'proximo';
  return 'normal';
}

/**
 * Uma tarefa por competência: a próxima ação pendente do fluxo.
 * Competências futuras sem dia previsto não geram tarefa.
 */
export function tarefasPJ({ contrato, feriados, marcas, medicoes }, hoje) {
  const tarefas = [];
  for (const mes of competenciasDoContrato(contrato)) {
    const medicao = medicoes[mes] || novaMedicao(mes);
    const periodo = periodoCompetencia(mes, contrato.diaCorte);
    const previstos = diasPrevistos(periodo, marcas, contrato, feriados, hoje);
    if (!previstos.length && medicao.estado === 'trabalhando') continue;

    const datas = datasChave(mes, { contrato, feriados, medicao });
    const competencia = rotuloCompetencia(mes);
    const i = indiceEstado(medicao.estado);
    const base = { mes, origem: 'pj', competencia };
    if (i === 0) {
      tarefas.push({ ...base, id: `pj:${mes}:boletim`, data: datas.envioBoletim.prazo,
        titulo: `Enviar boletim de medição (${competencia})` });
    } else if (i === 1) {
      tarefas.push({ ...base, id: `pj:${mes}:aprovacao`, data: datas.aprovacao.prazo,
        titulo: `Prazo de aprovação do boletim (${competencia})` });
    } else if (i === 2) {
      tarefas.push({ ...base, id: `pj:${mes}:nf`, data: datas.aprovacao.data,
        titulo: `Emitir a NFS-e (${competencia})` });
    } else if (i === 3) {
      tarefas.push({ ...base, id: `pj:${mes}:email`, data: datas.emissaoNF.data,
        titulo: `Enviar a NF por e-mail (${competencia})` });
    } else if (i === 4) {
      tarefas.push({ ...base, id: `pj:${mes}:pagamento`, data: datas.pagamento.data,
        titulo: `Pagamento previsto (${competencia})`,
        valorCentavos: resumoMedicao(mes, { contrato, marcas }).valorCentavos });
    }
  }
  return tarefas.sort((a, b) => a.data.localeCompare(b.data));
}

/** Tarefas até `dias` à frente, mais as atrasadas. */
export function proximosPrazos(tarefas, hoje, dias = 14) {
  return tarefas
    .filter((t) => diferencaDias(hoje, t.data) <= dias)
    .map((t) => ({ ...t, urgencia: urgencia(t.data, hoje) }));
}

/**
 * Linha "trabalhado → recebido" de cada competência do contrato:
 * dias (marcados e previstos), valor previsto e datas de recebimento.
 */
export function linhaDoTempo({ contrato, feriados, marcas, medicoes }, hoje) {
  return competenciasDoContrato(contrato).map((mes) => {
    const medicao = medicoes[mes] || novaMedicao(mes);
    const periodo = periodoCompetencia(mes, contrato.diaCorte);
    const { dias } = resumoMedicao(mes, { contrato, marcas });
    const previstos = diasPrevistos(periodo, marcas, contrato, feriados, hoje);
    const datas = datasChave(mes, { contrato, feriados, medicao });
    return {
      mes,
      medicao,
      diasTrabalhados: dias.length,
      diasPrevistos: previstos.length,
      valorCentavos: dias.length * contrato.valorDiaCentavos,
      valorPrevistoCentavos: previstos.length * contrato.valorDiaCentavos,
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

/** Todas as tarefas automáticas (PJ + DAS), em ordem de data. */
export function tarefasAutomaticas(estado, hoje) {
  const { contrato, feriados, marcas, medicoes } = estado;
  return [...tarefasPJ({ contrato, feriados, marcas, medicoes }, hoje), ...tarefasDAS(estado, hoje)]
    .sort((a, b) => a.data.localeCompare(b.data));
}

