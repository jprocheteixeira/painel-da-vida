// Painel inicial: KPIs do PJ, próximos prazos e a linha "trabalhado → recebido".

import {
  formatarData, formatarDataCurta, nomeSemana, rotuloCompetencia, diferencaDias,
} from '../../utils/datas.js';
import { formatarReais, somar } from '../../utils/dinheiro.js';
import { competenciaDoDia } from '../../dominio/contrato.js';
import { indiceEstado, ESTADOS } from '../../dominio/medicao.js';
import { tarefasPJ, tarefasAutomaticas, proximosPrazos, linhaDoTempo } from '../../dominio/prazos.js';
import { situacaoDas } from '../../dominio/mei.js';
import { gerarICS, tarefasParaEventos, carimboICS } from '../../dominio/agenda.js';
import { precisaLembreteBackup } from '../../storage/backup.js';
import { saldoAtual, projecao } from '../../dominio/caixa.js';
import { resumoDoMes, totalEstimativa } from '../../dominio/gastos.js';
import { mesDe } from '../../utils/datas.js';
import { html, icone, baixarArquivo } from '../util.js';
import { faixaExemplo } from './pj.js';

export function titulo() {
  return 'Painel';
}

export function render(ctx) {
  const { estado, hoje } = ctx;
  const { contrato } = estado;
  const nome = estado.perfil.nome ? estado.perfil.nome.split(' ')[0] : '';

  if (!contrato.inicio) {
    return html`
      <div class="cabecalho-pagina"><div><h1>${saudacao()}${nome ? `, ${nome}` : ''}</h1>
        <p class="subtitulo">Dinheiro, trabalho PJ e prazos num lugar só, sem sair deste aparelho.</p></div></div>
      ${html.cru(lembreteBackup(ctx))}
      <div class="cartao vazio-grande">
        <h2>Primeiros passos</h2>
        <ol class="passos">
          <li>Configure o contrato (valor por dia, dias da semana e data de início) em <a href="#/ajustes">Ajustes</a>.</li>
          <li>Se você já tem um backup ou um arquivo de perfil, importe-o em <a href="#/ajustes">Ajustes → Dados</a>.</li>
          <li>Marque os dias trabalhados em <a href="#/pj">Trabalho PJ</a>; o app calcula boletim, NF e pagamento.</li>
        </ol>
        <div class="linha-acoes">
          <a class="btn btn-primario" href="#/ajustes">Configurar</a>
          <button type="button" class="btn" data-acao="carregarExemplo">Ver com dados de exemplo</button>
        </div>
      </div>`;
  }

  const dados = { contrato, feriados: estado.feriados, marcas: estado.marcas, medicoes: estado.medicoes };
  const linhas = linhaDoTempo(dados, hoje);
  const mesAtual = competenciaDoDia(hoje, contrato.diaCorte);
  const atual = linhas.find((l) => l.mes === mesAtual);

  const aReceber = linhas.filter((l) => {
    const i = indiceEstado(l.medicao.estado);
    return i >= 2 && i <= 4;
  });
  const totalAReceber = somar(aReceber.map((l) => l.valorCentavos));
  const proximoPagamento = linhas
    .filter((l) => l.medicao.estado !== 'pago' && l.diasPrevistos > 0)
    .sort((a, b) => a.datas.pagamento.data.localeCompare(b.datas.pagamento.data))[0];
  const recebidoTotal = somar(linhas.filter((l) => l.medicao.estado === 'pago').map((l) => l.valorCentavos));
  const previstoTotal = somar(linhas.map((l) => (l.medicao.estado === 'trabalhando' ? l.valorPrevistoCentavos : l.valorCentavos)));

  const prazos = proximosPrazos(tarefasAutomaticas(estado, hoje), hoje, 14);
  const gastosMes = resumoDoMes(estado, mesDe(hoje));
  const gastoEstimado = totalEstimativa(estado.estimativas);
  const abaixoReserva = projecao(estado, hoje).filter((p) => p.abaixoDaReserva).length
    ? `${projecao(estado, hoje).filter((p) => p.abaixoDaReserva).length} mês(es)` : '';

  return html`
    <div class="cabecalho-pagina">
      <div>
        <h1>${saudacao()}${nome ? `, ${nome}` : ''}</h1>
        <p class="subtitulo">${nomeSemana(hoje)}, ${formatarData(hoje)}</p>
      </div>
    </div>
    ${html.cru(estado.meta.exemplo ? faixaExemplo() : '')}
    ${html.cru(lembreteBackup(ctx))}

    <section class="bento bento-5" aria-label="Resumo">
      <article class="kpi kpi-destaque">
        <p class="kpi-rotulo">Próximo pagamento</p>
        ${html.cru(proximoPagamento ? html`
          <p class="kpi-valor">${formatarReais(proximoPagamento.medicao.estado === 'trabalhando' ? proximoPagamento.valorPrevistoCentavos : proximoPagamento.valorCentavos)}</p>
          <p class="kpi-detalhe">${rotuloCompetencia(proximoPagamento.mes)} · ${proximoPagamento.datas.pagamento.real ? 'em' : 'previsto para'}
            <strong class="num">${formatarData(proximoPagamento.datas.pagamento.data)}</strong>
            (${emDias(diferencaDias(hoje, proximoPagamento.datas.pagamento.data))})</p>`
          : '<p class="kpi-valor">—</p><p class="kpi-detalhe">Nada previsto.</p>')}
      </article>
      <article class="kpi">
        <p class="kpi-rotulo">Trabalhado em ${rotuloCompetencia(mesAtual).split('/')[0].toLowerCase()}</p>
        <p class="kpi-valor">${formatarReais(atual?.valorCentavos ?? 0)}</p>
        <p class="kpi-detalhe num">${atual?.diasTrabalhados ?? 0} ${(atual?.diasTrabalhados ?? 0) === 1 ? 'dia' : 'dias'} · previsto ${formatarReais(atual?.valorPrevistoCentavos ?? 0)}</p>
      </article>
      <article class="kpi ${totalAReceber > 0 ? 'kpi-bom' : ''}">
        <p class="kpi-rotulo">A receber</p>
        <p class="kpi-valor">${formatarReais(totalAReceber)}</p>
        <p class="kpi-detalhe">aprovado ou com NF emitida</p>
      </article>
      <a class="kpi kpi-link ${gastoEstimado && gastosMes.total > gastoEstimado ? 'kpi-ruim' : ''}" href="#/gastos">
        <p class="kpi-rotulo">Gastos do mês</p>
        <p class="kpi-valor">${formatarReais(gastosMes.total)}</p>
        <p class="kpi-detalhe">${gastoEstimado ? `de ${formatarReais(gastoEstimado)} estimados` : `contrato: ${formatarReais(recebidoTotal)} de ${formatarReais(previstoTotal)} recebidos`}</p>
      </a>
      <a class="kpi kpi-link ${!estado.caixa.saldoEm ? '' : abaixoReserva ? 'kpi-ruim' : 'kpi-bom'}" href="#/caixa">
        <p class="kpi-rotulo">Saldo hoje</p>
        <p class="kpi-valor">${formatarReais(saldoAtual(estado, hoje))}</p>
        <p class="kpi-detalhe">${!estado.caixa.saldoEm ? 'informe seu saldo em Caixa →' : abaixoReserva ? `⚠ abaixo da reserva em ${abaixoReserva}` : 'ver projeção →'}</p>
      </a>
    </section>

    <div class="grade grade-2">
      <section class="cartao" aria-labelledby="t-prazos">
        <h2 id="t-prazos">Próximos 14 dias
          <button type="button" class="btn btn-pequeno" data-acao="exportarAgenda" title="Baixa um arquivo .ics com avisos na véspera e no dia">
            ${html.cru(icone('calendario'))} Pôr na agenda</button></h2>
        ${html.cru(prazos.length ? html`<ul class="lista-prazos">${html.cru(prazos.map((t) => html`
          <li class="prazo prazo--${t.urgencia}">
            <span class="prazo-data"><small>${nomeSemana(t.data, true)}</small>${formatarDataCurta(t.data)}</span>
            <span class="prazo-titulo">${t.titulo}${html.cru(t.valorCentavos && t.origem === 'das' ? ` · <span class="num">${formatarReais(t.valorCentavos)}</span>` : '')}
              <small>${rotuloUrgencia(t, hoje)}${t.detalhe ? ` · ${t.detalhe}` : ''}</small></span>
            ${html.cru(t.origem === 'das'
              ? html`<button type="button" class="btn btn-pequeno" data-acao="pagarDas" data-competencia="${t.competencia}">${html.cru(icone('check'))} Paguei</button>`
              : html`<a class="btn btn-pequeno" href="#/pj/${t.mes}">Abrir</a>`)}
          </li>`))}</ul>` : '<p class="vazio">Nenhum prazo nos próximos 14 dias.</p>')}
      </section>

      <section class="cartao" aria-labelledby="t-linha">
        <h2 id="t-linha">Trabalhado → recebido</h2>
        <div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr><th scope="col">Competência</th><th scope="col" class="dir">Valor</th><th scope="col">Etapa</th><th scope="col" class="dir">Recebe</th></tr></thead>
            <tbody>${html.cru(linhas.map((l) => linhaCompetencia(l, mesAtual)))}</tbody>
          </table>
        </div>
        <p class="subtitulo" style="margin-top:8px">Valores de meses em andamento são previstos (dias marcados + sugeridos).</p>
      </section>
    </div>`;
}

function linhaCompetencia(l, mesAtual) {
  const i = indiceEstado(l.medicao.estado);
  const valor = i === 0 ? l.valorPrevistoCentavos : l.valorCentavos;
  const trilha = ESTADOS.slice(1).map((_, k) => `<div class="${k < i ? 'feito' : ''}"></div>`).join('');
  return html`<tr class="${l.mes === mesAtual ? 'atual' : ''}">
    <td><a href="#/pj/${l.mes}">${rotuloCompetencia(l.mes)}</a></td>
    <td class="dir num">${formatarReais(valor)}${html.cru(i === 0 ? '<br><small class="subtitulo">previsto</small>' : '')}</td>
    <td><span class="estado-chip ${l.medicao.estado === 'pago' ? 'pago' : ''}">${ESTADOS[i].nome}</span>
      <div class="trilha" aria-hidden="true">${html.cru(trilha)}</div></td>
    <td class="dir num">${formatarDataCurta(l.datas.pagamento.data)}${html.cru(l.datas.pagamento.real ? '' : '<br><small class="subtitulo">prev.</small>')}</td>
  </tr>`;
}

function saudacao() {
  const hora = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: 'America/Sao_Paulo' }).format(new Date()));
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

function emDias(n) {
  if (n === 0) return 'hoje';
  if (n === 1) return 'amanhã';
  if (n < 0) return `há ${-n} dias`;
  return `em ${n} dias`;
}

function rotuloUrgencia(t, hoje) {
  const n = diferencaDias(hoje, t.data);
  if (n < 0) return `Atrasado ${-n} ${-n === 1 ? 'dia' : 'dias'}`;
  return emDias(n).replace(/^./, (c) => c.toUpperCase());
}

function lembreteBackup(ctx) {
  if (!precisaLembreteBackup(ctx.estado, ctx.hoje)) return '';
  const ultimo = ctx.estado.meta.ultimoBackup;
  return html`
    <div class="faixa faixa-alerta">
      ${html.cru(icone('alerta'))}
      <div><strong>Hora do backup mensal</strong>
        ${ultimo ? `O último foi em ${formatarData(ultimo)}.` : 'Você ainda não fez nenhum.'}
        Os dados vivem só neste navegador; o backup é o que permite recuperar ou levar para outro aparelho.
        <div class="acoes"><button type="button" class="btn btn-pequeno btn-primario" data-acao="exportar">Baixar backup agora</button></div>
      </div>
    </div>`;
}

export const acoes = {
  pagarDas(el, ev, ctx) {
    const comp = el.dataset.competencia;
    ctx.atualizar((e) => { e.dasPagos = { ...e.dasPagos, [comp]: ctx.hoje }; },
      { aviso: `DAS ${comp.slice(5)}/${comp.slice(0, 4)} marcado como pago em ${formatarData(ctx.hoje)}.` });
  },

  exportarAgenda(el, ev, ctx) {
    const { estado, hoje } = ctx;
    // DAS de todos os meses até o fim da projeção + a próxima etapa de cada mês do contrato
    const das = situacaoDas(estado, estado.caixa.horizonte)
      .filter((d) => !d.pagoEm && d.pagarAte >= hoje)
      .map((d) => ({
        id: `das:${d.competencia}`, data: d.pagarAte, valorCentavos: d.valorCentavos,
        titulo: `Pagar o DAS do MEI (${d.competencia.slice(5)}/${d.competencia.slice(0, 4)})`,
        detalhe: d.pagarAte !== d.vencimento ? `Vence ${formatarData(d.vencimento)}.` : '',
      }));
    const { contrato, feriados, marcas, medicoes } = estado;
    const pj = tarefasPJ({ contrato, feriados, marcas, medicoes }, hoje).filter((t) => t.data >= hoje);
    const eventos = tarefasParaEventos([...das, ...pj]);
    if (!eventos.length) { ctx.avisar('Nenhum prazo futuro para exportar.', true); return; }
    baixarArquivo(`painel-da-vida-prazos-${hoje}.ics`, gerarICS(eventos, carimboICS()), 'text/calendar');
    ctx.avisar(`${eventos.length} prazos exportados. Abra o arquivo para adicionar à agenda.`);
  },

  carregarExemplo: (el, ev, ctx) => ctx.carregarExemplo(),
  apagarExemplo: (el, ev, ctx) => ctx.apagarExemplo(),
};

