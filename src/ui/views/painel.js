// Painel inicial: KPIs do PJ, próximos prazos, a linha "item da OC → recebido" e as pendências.

import {
  formatarData, formatarDataCurta, nomeSemana, rotuloCompetencia, diferencaDias,
} from '../../utils/datas.js';
import { formatarReais, somar } from '../../utils/dinheiro.js';
import { indiceEstado, ESTADOS } from '../../dominio/medicao.js';
import { itemDoDia, itensDaOC, textoAceite, totalDaOC } from '../../dominio/oc.js';
import { listaPendencias } from '../../dominio/pendencias.js';
import {
  tarefasPJ, tarefasDAS, tarefaAceite, tarefasAutomaticas, proximosPrazos, linhaDoTempo,
} from '../../dominio/prazos.js';
import { gerarICS, tarefasParaEventos, carimboICS } from '../../dominio/agenda.js';
import { precisaLembreteBackup, proximoBackup, datasBackup } from '../../storage/backup.js';
import { saldoAtual, projecao } from '../../dominio/caixa.js';
import { resumoDoMes, totalEstimativa } from '../../dominio/gastos.js';
import { mesDe } from '../../utils/datas.js';
import { html, icone, baixarArquivo, copiarTexto } from '../util.js';
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
          <li>Configure o contrato (dias da semana, data de início) e os itens da OC em <a href="#/ajustes">Ajustes</a>.</li>
          <li>Se você já tem um backup ou um arquivo de perfil, importe-o em <a href="#/ajustes">Ajustes → Dados</a>.</li>
          <li>Marque os dias trabalhados em <a href="#/pj">Trabalho PJ</a>; o app calcula boletim, janela da NF e pagamento.</li>
        </ol>
        <div class="linha-acoes">
          <a class="btn btn-primario" href="#/ajustes">Configurar</a>
          <button type="button" class="btn" data-acao="carregarExemplo">Ver com dados de exemplo</button>
        </div>
      </div>`;
  }

  const dados = { contrato, feriados: estado.feriados, marcas: estado.marcas, medicoes: estado.medicoes };
  const linhas = linhaDoTempo(dados, hoje);
  const itemAtual = itemDoDia(contrato, hoje);
  const mesAtual = itemAtual ? mesDe(itemAtual.despacho) : null;
  const atual = linhas.find((l) => l.mes === mesAtual);

  const aReceber = linhas.filter((l) => {
    const i = indiceEstado(l.medicao.estado);
    return i >= 2 && i <= 4;
  });
  const totalAReceber = somar(aReceber.map((l) => l.valorCentavos));
  const proximoPagamento = linhas
    .filter((l) => l.medicao.estado !== 'pago')
    .sort((a, b) => a.datas.pagamento.data.localeCompare(b.datas.pagamento.data))[0];
  const recebidoTotal = somar(linhas.filter((l) => l.medicao.estado === 'pago').map((l) => l.valorCentavos));
  const previstoTotal = totalDaOC(contrato);

  const backup = proximoBackup(estado, hoje);
  const tarefaBackup = backup ? [{ id: `backup:${backup}`, origem: 'backup', data: backup, titulo: 'Fazer o backup do mês' }] : [];
  const prazos = proximosPrazos([...tarefasAutomaticas(estado, hoje), ...tarefaBackup]
    .sort((a, b) => a.data.localeCompare(b.data)), hoje, 14);
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
          <p class="kpi-valor">${formatarReais(proximoPagamento.valorCentavos)}</p>
          <p class="kpi-detalhe">Item ${proximoPagamento.item.n} · ${proximoPagamento.datas.pagamento.real ? 'em' : 'previsto para'}
            <strong class="num">${formatarData(proximoPagamento.datas.pagamento.data)}</strong>
            (${emDias(diferencaDias(hoje, proximoPagamento.datas.pagamento.data))})${html.cru(intervaloPagamento(proximoPagamento.datas.pagamento))}</p>`
          : '<p class="kpi-valor">—</p><p class="kpi-detalhe">Nada previsto.</p>')}
      </article>
      <a class="kpi kpi-link ${atual?.datas.perdida ? 'kpi-ruim' : ''}" href="#/pj">
        <p class="kpi-rotulo">${atual ? `Item ${atual.item.n} da OC · ${rotuloCompetencia(atual.mes).split('/')[0].toLowerCase()}` : 'Item da OC'}</p>
        <p class="kpi-valor">${formatarReais(atual?.valorCentavos ?? 0)}</p>
        <p class="kpi-detalhe num">${atual ? `${atual.diasTrabalhados} ${atual.diasTrabalhados === 1 ? 'dia' : 'dias'} de atividade · NF de ${formatarDataCurta(atual.datas.janela.abre)} a ${formatarDataCurta(atual.datas.janela.limite)}${atual.datas.perdida ? ' · ⚠ janela perdida' : ''}` : linhas.length ? 'OC encerrada' : 'cadastre os itens em Ajustes'}</p>
      </a>
      <article class="kpi ${totalAReceber > 0 ? 'kpi-bom' : ''}">
        <p class="kpi-rotulo">A receber</p>
        <p class="kpi-valor">${formatarReais(totalAReceber)}</p>
        <p class="kpi-detalhe">aprovado ou com NF emitida</p>
      </article>
      <a class="kpi kpi-link ${gastoEstimado && gastosMes.total > gastoEstimado ? 'kpi-ruim' : ''}" href="#/gastos">
        <p class="kpi-rotulo">Gastos do mês</p>
        <p class="kpi-valor">${formatarReais(gastosMes.total)}</p>
        <p class="kpi-detalhe">${gastoEstimado ? `de ${formatarReais(gastoEstimado)} estimados` : `OC: ${formatarReais(recebidoTotal)} de ${formatarReais(previstoTotal)} recebidos`}</p>
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
            <span class="prazo-titulo">${t.titulo}${html.cru(t.valorCentavos && t.origem.startsWith('das') ? ` · <span class="num">${formatarReais(t.valorCentavos)}</span>` : '')}
              <small>${rotuloUrgencia(t, hoje)}${t.detalhe ? ` · ${t.detalhe}` : ''}</small></span>
            ${html.cru(botaoPrazo(t))}
          </li>`))}</ul>` : '<p class="vazio">Nenhum prazo nos próximos 14 dias.</p>')}
        ${html.cru(!contrato.aceiteEnviadoEm && itensDaOC(contrato).length ? html`
          <details class="secao" style="margin-top:12px"><summary>Texto do aceite da OC</summary>
            <pre class="texto-pronto" id="texto-aceite">${textoAceite(contrato, estado.perfil)}</pre>
          </details>` : '')}
      </section>

      <section class="cartao" aria-labelledby="t-linha">
        <h2 id="t-linha">Itens da OC → recebido</h2>
        ${html.cru(linhas.length ? html`<div class="tabela-rolagem">
          <table class="tabela">
            <thead><tr><th scope="col">Item</th><th scope="col" class="dir">Valor</th><th scope="col">Etapa</th><th scope="col" class="dir">Recebe</th></tr></thead>
            <tbody>${html.cru(linhas.map((l) => linhaCompetencia(l, mesAtual)))}</tbody>
          </table>
        </div>
        <p class="subtitulo" style="margin-top:8px">Valor fixo por item. Sem NF emitida, “Recebe” é a previsão com a nota no fim da janela; embaixo, o intervalo.</p>`
          : '<p class="vazio">Cadastre os itens da OC em <a href="#/ajustes">Ajustes</a>.</p>')}
      </section>

      ${html.cru(cartaoPendencias(estado))}
    </div>`;
}

function intervaloPagamento(p) {
  if (p.real || p.maisCedo === p.maisTarde) return '';
  return html`<br><small class="num">entre ${formatarDataCurta(p.maisCedo)} e ${formatarDataCurta(p.maisTarde)}</small>`;
}

function cartaoPendencias(estado) {
  const lista = listaPendencias(estado);
  const abertas = lista.filter((p) => !p.feita).length;
  const travada = (p) => p.automatica && p.feita && !['oc-aceite', 'oc-base'].includes(p.id);
  const itens = lista.map((p, i) => html`<li class="${p.feita ? 'feita' : ''}">
    <label class="interruptor"><input type="checkbox" ${html.cru(p.feita ? 'checked' : '')} ${html.cru(travada(p) ? 'disabled' : '')}
      data-ao-mudar="marcarPendencia" data-indice="${i}" aria-label="${p.texto}"></label>
    <span class="p-texto">${p.texto}${html.cru(p.automatica ? ' <small class="subtitulo">(confere sozinho)</small>' : '')}</span>
    ${html.cru(p.automatica ? '' : html`<button type="button" class="btn btn-icone btn-fantasma btn-pequeno" data-acao="removerPendencia" data-indice="${i}"
      aria-label="Remover ${p.texto}">${html.cru(icone('lixo'))}</button>`)}
  </li>`);
  return html`
    <section class="cartao" aria-labelledby="t-pend">
      <h2 id="t-pend">Pendências <span class="subtitulo num">${abertas} em aberto</span></h2>
      <ul class="lista-pendencias">${html.cru(itens)}</ul>
      <form class="avancar-linha" style="margin-top:10px" data-ao-enviar="adicionarPendencia">
        <label class="campo"><span class="visualmente-oculto">Nova pendência</span>
          <input type="text" name="texto" id="nova-pendencia" required placeholder="Nova pendência"></label>
        <button class="btn" type="submit">${html.cru(icone('mais'))} Adicionar</button>
      </form>
    </section>`;
}

function linhaCompetencia(l, mesAtual) {
  const i = indiceEstado(l.medicao.estado);
  const trilha = ESTADOS.slice(1).map((_, k) => `<div class="${k < i ? 'feito' : ''}"></div>`).join('');
  const p = l.datas.pagamento;
  return html`<tr class="${l.mes === mesAtual ? 'atual' : ''}">
    <td><a href="#/pj/${l.mes}">Item ${l.item.n}</a><br><small class="subtitulo">${rotuloCompetencia(l.mes)}</small></td>
    <td class="dir num">${formatarReais(l.valorCentavos)}</td>
    <td><span class="estado-chip ${l.medicao.estado === 'pago' ? 'pago' : ''}">${ESTADOS[i].nome}</span>
      ${html.cru(l.datas.perdida ? `<br><small class="valor-ruim">${icone('alerta', 'ic ic-p')}perdeu a janela</small>` : '')}
      <div class="trilha" aria-hidden="true">${html.cru(trilha)}</div></td>
    <td class="dir num">${formatarDataCurta(p.data)}${html.cru(p.real ? '' : p.maisCedo !== p.maisTarde
      ? `<br><small class="subtitulo">${formatarDataCurta(p.maisCedo)}–${formatarDataCurta(p.maisTarde)}</small>`
      : '<br><small class="subtitulo">prev.</small>')}</td>
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
        O backup é feito todo mês no último dia útil, junto com o boletim. Os dados vivem só neste aparelho: o backup é o que permite recuperar tudo se o celular for trocado ou o Chrome for limpo.
        <div class="acoes"><button type="button" class="btn btn-pequeno btn-primario" data-acao="exportar">Baixar backup agora</button></div>
      </div>
    </div>`;
}

function botaoPrazo(t) {
  if (t.origem === 'aceite') {
    return html`<span class="celula-acoes"><button type="button" class="btn btn-pequeno" data-acao="copiarAceite">${html.cru(icone('copiar'))} Copiar texto</button>
      <button type="button" class="btn btn-pequeno" data-acao="aceiteEnviado">${html.cru(icone('check'))} Enviei</button></span>`;
  }
  if (t.origem === 'das') {
    return html`<button type="button" class="btn btn-pequeno" data-acao="pagarDas" data-competencia="${t.competencia}">${html.cru(icone('check'))} Paguei</button>`;
  }
  if (t.origem === 'das-pedir') {
    return html`<button type="button" class="btn btn-pequeno" data-acao="pedirDas" data-competencia="${t.competencia}">${html.cru(icone('check'))} Já pedi</button>`;
  }
  if (t.origem === 'backup') {
    return html`<button type="button" class="btn btn-pequeno" data-acao="exportar">Fazer backup</button>`;
  }
  return html`<a class="btn btn-pequeno" href="#/pj/${t.mes}">Abrir</a>`;
}

export const acoes = {
  pagarDas: (el, ev, ctx) => ctx.marcarDasPago(el.dataset.competencia),
  pedirDas: (el, ev, ctx) => ctx.marcarDasPedido(el.dataset.competencia),

  async copiarAceite(el, ev, ctx) {
    const ok = await copiarTexto(textoAceite(ctx.estado.contrato, ctx.estado.perfil));
    ctx.avisar(ok ? 'Texto do aceite copiado. Cole no e-mail de resposta à OC.' : 'Não foi possível copiar.', !ok);
  },
  aceiteEnviado(el, ev, ctx) {
    ctx.atualizar((e) => { e.contrato.aceiteEnviadoEm = ctx.hoje; }, { aviso: 'Aceite da OC marcado como enviado.' });
  },

  marcarPendencia(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    ctx.atualizar((e) => {
      const p = e.pendencias[i];
      if (p.id === 'oc-aceite') e.contrato.aceiteEnviadoEm = el.checked ? (e.contrato.aceiteEnviadoEm || ctx.hoje) : null;
      if (p.id === 'oc-base') e.contrato.basePrazoConfirmada = el.checked;
      p.feita = el.checked;
    });
  },
  removerPendencia(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    if (!confirm(`Remover “${ctx.estado.pendencias[i].texto}”?`)) return;
    ctx.atualizar((e) => { e.pendencias.splice(i, 1); }, { aviso: 'Pendência removida.' });
  },
  adicionarPendencia(form, ev, ctx) {
    const texto = form.elements.texto.value.trim();
    if (!texto) return;
    ctx.atualizar((e) => { e.pendencias.push({ id: `p${Date.now()}`, texto, feita: false }); }, { aviso: 'Pendência adicionada.' });
  },

  exportarAgenda(el, ev, ctx) {
    const { estado, hoje } = ctx;
    // DAS (e pedidos de dinheiro) até o fim da projeção + aceite da OC + etapa e janela da NF de cada item + backups
    const das = tarefasDAS(estado, hoje, estado.caixa.horizonte).filter((t) => t.data >= hoje);
    const { contrato, feriados, marcas, medicoes } = estado;
    const pj = [...tarefaAceite(contrato, hoje), ...tarefasPJ({ contrato, feriados, marcas, medicoes }, hoje)]
      .filter((t) => t.data >= hoje);
    const backups = datasBackup(estado, hoje, estado.caixa.horizonte)
      .map((d) => ({ id: `backup:${d}`, data: d, titulo: 'Fazer o backup do Painel da Vida' }));
    const eventos = tarefasParaEventos([...das, ...pj, ...backups]);
    if (!eventos.length) { ctx.avisar('Nenhum prazo futuro para exportar.', true); return; }
    baixarArquivo(`painel-da-vida-prazos-${hoje}.ics`, gerarICS(eventos, carimboICS()), 'text/calendar');
    ctx.avisar(`${eventos.length} prazos exportados. Abra o arquivo para adicionar à agenda.`);
  },

  carregarExemplo: (el, ev, ctx) => ctx.carregarExemplo(),
  apagarExemplo: (el, ev, ctx) => ctx.apagarExemplo(),
};

