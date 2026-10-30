// Trabalho PJ: item da OC do mês, calendário de dias (informativo), etapas, datas, boletim e NFS-e.

import {
  ehMesISO, mesDe, nomeMes, inicioSemana, somarDias, intervaloDias, formatarData,
  dataPorExtenso, diaDaSemana, rotuloCompetencia, nomeSemana,
} from '../../utils/datas.js';
import { formatarReais } from '../../utils/dinheiro.js';
import {
  situacaoDia, proximaMarca, marcarDia, ehDiaSugerido, contagemPorSemana, DIA, diasPrevistos,
} from '../../dominio/contrato.js';
import { mesesDaOC, itemDoDia, itemDoMes, BASES_PRAZO_FRASE } from '../../dominio/oc.js';
import { feriadoEm } from '../../dominio/feriados.js';
import {
  ESTADOS, indiceEstado, novaMedicao, proximoEstado, avancar, voltar, datasChave, resumoMedicao,
  textoBoletim, textoNF, diasAteReceber, periodoDaMedicao,
} from '../../dominio/medicao.js';
import { html, icone, copiarTexto } from '../util.js';

const CABECALHO_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Mês do item que cobre hoje (ou o último item, se a OC já acabou). */
function mesDoItemAtual(contrato, hoje) {
  const meses = mesesDaOC(contrato);
  if (!meses.length) return mesDe(hoje);
  const item = itemDoDia(contrato, hoje);
  return item ? mesDe(item.despacho) : meses.at(-1);
}

/** Mês exibido: o da rota; senão o do item atual da OC. */
function mesSelecionado(ctx) {
  const pedido = ctx.rota.params[0];
  if (ehMesISO(pedido)) return pedido;
  return mesDoItemAtual(ctx.estado.contrato, ctx.hoje);
}

const medicaoDe = (estado, mes) => estado.medicoes[mes] || novaMedicao(mes);

export function titulo(ctx) {
  return `Trabalho PJ · ${rotuloCompetencia(mesSelecionado(ctx))}`;
}

export function render(ctx) {
  const { estado, hoje } = ctx;
  const { contrato } = estado;
  const mes = mesSelecionado(ctx);

  const meses = mesesDaOC(contrato);
  if (!contrato.inicio || !meses.length) {
    return html`
      <div class="cabecalho-pagina"><h1>Trabalho PJ</h1></div>
      <div class="cartao vazio-grande">
        <h2>Configure o contrato e os itens da OC para começar</h2>
        <p class="subtitulo">Com a data de início, os dias da semana e os itens da Ordem de Compra (data de despacho e valor),
          o app sugere os dias de trabalho e calcula a janela da nota e o pagamento de cada item.</p>
        <div class="linha-acoes">
          <a class="btn btn-primario" href="#/ajustes">Configurar contrato</a>
          <button type="button" class="btn" data-acao="carregarExemplo">Ver com dados de exemplo</button>
        </div>
      </div>`;
  }

  const medicao = medicaoDe(estado, mes);
  const datas = datasChave(mes, { contrato, feriados: estado.feriados, medicao, hoje });
  const resumo = resumoMedicao(mes, { contrato, marcas: estado.marcas });
  const previstos = diasPrevistos(datas.periodo, estado.marcas, contrato, estado.feriados, hoje);
  const anterior = meses.filter((m) => m < mes).at(-1);
  const seguinte = meses.find((m) => m > mes);
  const navegar = (alvo, rotulo, ic) => (alvo
    ? html`<a class="btn btn-icone" href="#/pj/${alvo}" aria-label="${rotulo}">${html.cru(icone(ic))}</a>`
    : html`<span class="btn btn-icone" aria-hidden="true" style="visibility:hidden">${html.cru(icone(ic))}</span>`);

  const cabecalho = html`
    <div class="cabecalho-pagina">
      <div class="navegador-mes">
        ${html.cru(navegar(anterior, 'Item anterior', 'esquerda'))}
        <h1><span>${datas.item ? `Item ${datas.item.n} · ` : ''}${nomeMes(mes)}</span></h1>
        ${html.cru(navegar(seguinte, 'Próximo item', 'direita'))}
      </div>
      ${html.cru(mes !== mesDoItemAtual(contrato, hoje)
        ? html`<a class="btn btn-pequeno" href="#/pj">Ir para o item atual</a>` : '')}
    </div>`;

  if (!datas.item) {
    return html`${html.cru(cabecalho)}
      <div class="cartao vazio-grande">
        <h2>${nomeMes(mes)} não tem item na OC</h2>
        <p class="subtitulo">Os itens da OC vão de ${nomeMes(meses[0])} a ${nomeMes(meses.at(-1))}.</p>
        <div class="linha-acoes"><a class="btn btn-primario" href="#/pj">Ir para o item atual</a></div>
      </div>`;
  }

  return html`
    ${html.cru(cabecalho)}
    ${html.cru(avisoOC(contrato))}
    ${html.cru(faixaJanela(datas, medicao, hoje))}
    ${html.cru(estado.meta.exemplo ? faixaExemplo() : '')}

    <div class="grade grade-pj">
      <div class="col">
        ${html.cru(cartaoBoletim(ctx, mes, medicao, resumo))}
        ${html.cru(cartaoCalendario(ctx, mes, datas.periodo, previstos, resumo.dias.length))}
      </div>
      <div class="col">
        ${html.cru(cartaoEtapas(ctx, mes, medicao, datas))}
        ${html.cru(cartaoDatas(contrato, datas, resumo, hoje, medicao))}
        ${html.cru(cartaoNF(ctx, mes, medicao))}
      </div>
    </div>`;
}

function avisoOC(contrato) {
  if (contrato.numeroOC && contrato.codigoItemOC) return '';
  const falta = [!contrato.numeroOC && 'o nº da OC', !contrato.codigoItemOC && 'o código do item'].filter(Boolean).join(' e ');
  return html`
    <div class="faixa faixa-perigo" role="alert">
      ${html.cru(icone('alerta'))}
      <div>
        <strong>Falta ${falta}</strong>
        A NFS-e precisa do número da OC e do item enumerado como no documento; sem isso a descrição sai com “[PENDENTE]”.
        Preencha no cartão da nota fiscal ou em Ajustes → Ordem de Compra (fica só neste aparelho).
        <div class="acoes"><button type="button" class="btn btn-pequeno" data-acao="irParaNF">Preencher agora</button></div>
      </div>
    </div>`;
}

/** Alerta da janela da NF: perdida (vermelho) ou aberta agora (atenção). */
function faixaJanela(datas, medicao, hoje) {
  if (indiceEstado(medicao.estado) >= indiceEstado('nf_emitida')) return '';
  const { item, janela, janelaItem, pagamento } = datas;
  if (datas.perdida) {
    return html`
      <div class="faixa faixa-perigo" role="alert">
        ${html.cru(icone('alerta'))}
        <div>
          <strong>Perdeu a janela: só no próximo mês</strong>
          A NF do item ${item.n} não foi emitida até ${formatarData(janelaItem.limite)}. Nova janela:
          <span class="num">${formatarData(janela.abre).slice(0, 5)} a ${formatarData(janela.limite)}</span>.
          O recebimento passa para entre <strong class="num">${formatarData(pagamento.maisCedo)}</strong> e
          <strong class="num">${formatarData(pagamento.maisTarde)}</strong>.
        </div>
      </div>`;
  }
  if (hoje < janela.abre || hoje > janela.limite) return '';
  return html`
    <div class="faixa faixa-alerta" role="status">
      ${html.cru(icone('alerta'))}
      <div>
        <strong>Janela da NF do item ${item.n} aberta até ${formatarData(janela.limite)}</strong>
        Nota emitida do dia ${Number(janela.limite.slice(8)) + 1} em diante é recusada.
      </div>
    </div>`;
}

export function faixaExemplo() {
  return html`
    <div class="faixa faixa-info">
      ${html.cru(icone('info'))}
      <div>
        <strong>Você está vendo dados de exemplo</strong>
        Pessoa, empresa e valores fictícios, só para demonstração.
        <div class="acoes"><button type="button" class="btn btn-pequeno" data-acao="apagarExemplo">Apagar dados de exemplo</button></div>
      </div>
    </div>`;
}

// ---------- calendário ----------

function cartaoCalendario(ctx, mes, periodo, previstos, marcados) {
  const { estado, hoje } = ctx;
  const { contrato, feriados, marcas } = estado;
  const porSemana = contagemPorSemana(marcas);
  const inicio = inicioSemana(periodo.inicio);
  const fim = somarDias(inicioSemana(periodo.fim), 6);
  const semanas = [];
  for (let s = inicio; s <= fim; s = somarDias(s, 7)) semanas.push(s);
  const acima = semanas.filter((s) => (porSemana[s] || 0) > contrato.tetoSemanal);
  const pendentesPassados = intervaloDias(periodo.inicio, periodo.fim)
    .filter((d) => d < hoje && situacaoDia(d, marcas, contrato, feriados) === 'sugerido');

  const linhas = semanas.map((s) => {
    const celulas = intervaloDias(s, somarDias(s, 6)).map((d) => {
      if (d < periodo.inicio || d > periodo.fim) return '<td><span class="dia dia--fora" aria-hidden="true"></span></td>';
      const sit = situacaoDia(d, marcas, contrato, feriados);
      const feriado = feriadoEm(d, feriados);
      const dow = diaDaSemana(d);
      const classes = ['dia'];
      if (sit) classes.push(`dia--${sit}`);
      if (feriado) classes.push('dia--feriado');
      if (dow === 0 || dow === 6) classes.push('dia--fds');
      if (d === hoje) classes.push('dia--hoje');
      const rotuloSit = { trabalhado: 'trabalhado', folga: 'folga', sugerido: 'sugerido, não marcado' }[sit] || 'sem trabalho';
      const extra = feriado ? `, feriado: ${feriado.nome}` : '';
      const marca = sit === 'trabalhado' ? '✓' : sit === 'folga' ? 'folga' : feriado ? 'feriado' : '';
      return html`<td><button type="button" class="${classes.join(' ')}" data-acao="alternarDia" data-dia="${d}"
        aria-pressed="${sit === 'trabalhado'}" aria-label="${dataPorExtenso(d)}: ${rotuloSit}${extra}"
        ${html.cru(feriado ? `title="${feriado.nome.replace(/"/g, '&quot;')}"` : '')}>
        ${Number(d.slice(8))}<small>${marca}</small></button></td>`;
    });
    const n = porSemana[s] || 0;
    const passou = n > contrato.tetoSemanal;
    return html`<tr>${html.cru(celulas)}<td class="col-semana"><span class="cont-semana${passou ? ' cont-semana--acima' : ''}"
      title="Dias trabalhados na semana">${n ? `${n}/${contrato.tetoSemanal}` : ''}</span></td></tr>`;
  });

  return html`
    <section class="cartao" aria-labelledby="t-cal">
      ${html.cru(acima.length ? html`
        <div class="faixa faixa-alerta" role="alert">${html.cru(icone('alerta'))}
          <div><strong>Teto semanal ultrapassado</strong>
          ${acima.map((s) => `semana de ${formatarData(s)}: ${porSemana[s]} dias`).join('; ')} (teto: ${contrato.tetoSemanal}).</div>
        </div>` : '')}
      <details class="secao" ${html.cru(marcados ? 'open' : '')}>
      <summary><h2 id="t-cal">Dias de atividade <span class="subtitulo num">opcional · ${marcados ? `${marcados} marcados` : `${previstos.length} previstos`}</span></h2></summary>
      <p class="subtitulo">Não precisa marcar: o valor do item é fixo. Se quiser, marque para listar os dias no boletim e acompanhar o limite de ${contrato.tetoSemanal} dias presenciais por semana.</p>
      <div class="legenda" aria-hidden="true">
        <span><i class="l-trab"></i>Trabalhado</span><span><i class="l-sug"></i>Sugerido</span>
        <span><i class="l-folga"></i>Folga</span><span><i class="l-fer"></i>Feriado</span>
      </div>
      <table class="calendario" aria-label="Calendário de ${nomeMes(mes)}">
        <thead><tr>${html.cru(CABECALHO_SEMANA.map((c) => `<th scope="col">${c}</th>`))}<th class="col-semana" scope="col"><span class="visualmente-oculto">Dias na semana</span>Σ</th></tr></thead>
        <tbody>${html.cru(linhas)}</tbody>
      </table>
      <p class="subtitulo">Um clique marca como trabalhado; no dia sugerido, o segundo clique marca folga.</p>
      ${html.cru(pendentesPassados.length ? html`
        <div class="linha-acoes">
          <button type="button" class="btn btn-pequeno" data-acao="marcarSugeridos">
            ${html.cru(icone('check'))} Marcar ${pendentesPassados.length} dia(s) sugerido(s) que já passaram
          </button>
        </div>` : '')}
      </details>
    </section>`;
}

// ---------- etapas ----------

function cartaoEtapas(ctx, mes, medicao, datas) {
  const i = indiceEstado(medicao.estado);
  const prox = proximoEstado(medicao);
  const itens = ESTADOS.map((e, k) => {
    const cls = k < i ? 'etapa--feita' : k === i ? 'etapa--atual' : '';
    const data = medicao.historico[e.id];
    const marca = k <= i ? '✓' : k + 1;
    return html`<li class="etapa ${cls}" ${html.cru(k === i ? 'aria-current="step"' : '')}>
      <span class="etapa-marca" aria-hidden="true">${marca}</span>
      <span class="etapa-nome">${e.nome}</span>
      <span class="etapa-data num">${data ? formatarData(data) : ''}</span>
    </li>`;
  });
  const vaiEmitir = prox?.id === 'nf_emitida';
  const j = datas.janela;
  return html`
    <section class="cartao" aria-labelledby="t-etapas">
      <h2 id="t-etapas">Etapas do item ${datas.item.n} · ${rotuloCompetencia(mes)}</h2>
      <ol class="etapas">${html.cru(itens)}</ol>
      ${html.cru(prox ? html`
        <form class="avancar" data-ao-enviar="avancarEtapa">
          <div class="avancar-linha">
            <label class="campo"><span>Data</span>
              <input type="date" name="data" id="data-etapa" value="${ctx.hoje}" required></label>
            <button type="submit" class="btn btn-primario">
              ${html.cru(icone('check'))} ${prox.acao}${vaiEmitir ? ` (item ${datas.item.n})` : ''}</button>
          </div>
          ${html.cru(vaiEmitir ? html`<small class="subtitulo">Só vale de ${formatarData(j.abre).slice(0, 5)} a ${formatarData(j.limite)}
            (dia ${ctx.estado.contrato.nfDiaAbre} ao ${ctx.estado.contrato.nfDiaLimite}). Uma nota por item da OC.</small>` : '')}
        </form>` : '<p class="destaque-espera"><strong>Recebido.</strong> Esta competência está encerrada.</p>')}
      ${html.cru(i > 0 ? html`<div class="linha-acoes"><button type="button" class="btn btn-fantasma btn-pequeno" data-acao="voltarEtapa">
        ${html.cru(icone('desfazer'))} Desfazer “${ESTADOS[i].nome}”</button></div>` : '')}
    </section>`;
}

// ---------- datas ----------

function linhaData(rotulo, item, hoje, { prazo } = {}) {
  let selo = item.real
    ? '<span class="selo selo-real">real</span>'
    : '<span class="selo selo-prev">previsto</span>';
  if (!item.real && prazo && item.data < hoje) selo = '<span class="selo selo-atraso">atrasado</span>';
  return html`<div><dt>${rotulo}</dt><dd><span class="num">${formatarData(item.data)}</span> ${html.cru(selo)}
    <small>${nomeSemana(item.data)}</small></dd></div>`;
}

function cartaoDatas(contrato, datas, resumo, hoje, medicao) {
  const espera = diasAteReceber(resumo.dias, datas);
  const pago = medicao.estado === 'pago';
  const emitida = datas.emissaoNF.real;
  const j = datas.janela;
  const seloJanela = datas.perdida
    ? '<span class="selo selo-atraso">perdida</span>'
    : emitida ? '<span class="selo selo-real">emitida</span>' : hoje >= j.abre ? '<span class="selo selo-prev">aberta</span>' : '';
  const intervalo = !datas.pagamento.real && datas.pagamento.maisCedo !== datas.pagamento.maisTarde;
  return html`
    <section class="cartao" aria-labelledby="t-datas">
      <h2 id="t-datas">Do trabalho ao dinheiro</h2>
      <dl class="datas">
        <div><dt>Período do item</dt><dd class="num">${formatarData(datas.periodo.inicio).slice(0, 5)} a ${formatarData(datas.periodo.fim)}</dd></div>
        ${html.cru(linhaData('Enviar boletim e relatório até', datas.envioBoletim, hoje, { prazo: true }))}
        ${html.cru(linhaData('Aprovação até', datas.aprovacao, hoje, { prazo: true }))}
        <div><dt>Janela da NF${datas.perdida ? ' (nova)' : ''}</dt><dd><span class="num">${formatarData(j.abre).slice(0, 5)} a ${formatarData(j.limite)}</span>
          ${html.cru(seloJanela)}<small>do dia 21 em diante a nota é recusada</small></dd></div>
        ${html.cru(linhaData('Emissão da NF', datas.emissaoNF, hoje))}
        ${html.cru(linhaData(pago ? 'Pago em' : 'Pagamento', datas.pagamento, hoje))}
        ${html.cru(intervalo ? html`<div><dt>Intervalo do pagamento</dt><dd><span class="num">${formatarData(datas.pagamento.maisCedo)} a ${formatarData(datas.pagamento.maisTarde)}</span>
          <small>emitindo no início ou no fim da janela</small></dd></div>` : '')}
      </dl>
      <p class="subtitulo" style="margin-top:8px">Prazo: ${contrato.prazoPagamentoDias} DDL, contados
        ${BASES_PRAZO_FRASE[contrato.basePrazo] || ''}${contrato.basePrazoConfirmada ? '' : ' (a confirmar)'}, passando para o próximo dia útil.
        Pagamento por ${contrato.formaPagamento || 'DDA ou depósito bancário'}; não aceita factoring.</p>
      ${html.cru(espera != null ? html`<p class="destaque-espera">
        Do último dia trabalhado até o dinheiro na conta: <strong class="num">${espera} dias</strong>.</p>` : '')}
    </section>`;
}

// ---------- boletim ----------

function cartaoBoletim(ctx, mes, medicao, resumo) {
  const { estado } = ctx;
  const texto = textoBoletim(mes, { contrato: estado.contrato, perfil: estado.perfil, marcas: estado.marcas, medicao });
  return html`
    <section class="cartao" aria-labelledby="t-boletim">
      <h2 id="t-boletim">Boletim de medição</h2>
      <div class="totais">
        <span class="grande">${formatarReais(resumo.valorCentavos)}</span>
        <span class="num">Item ${resumo.item.n} · valor fixo mensal da OC${resumo.dias.length ? ` · ${resumo.dias.length} ${resumo.dias.length === 1 ? 'dia marcado' : 'dias marcados'}` : ''}</span>
      </div>
      <label class="campo"><span>Relatório mensal de atividades</span>
        <textarea id="resumo-atividades" data-ao-digitar="editarResumo" placeholder="O que você fez no período do item (vai no texto do boletim)">${medicao.resumo}</textarea>
      </label>
      <details class="secao" style="margin-top:12px">
        <summary>Texto do boletim</summary>
        <pre class="texto-pronto" id="texto-boletim">${texto}</pre>
      </details>
      <div class="linha-acoes">
        <button type="button" class="btn btn-primario" data-acao="copiarBoletim">${html.cru(icone('copiar'))} Copiar texto do boletim</button>
      </div>
    </section>`;
}

// ---------- NF ----------

function cartaoNF(ctx, mes, medicao) {
  const { contrato } = ctx.estado;
  const texto = textoNF(mes, { contrato });
  const n = itemDoMes(contrato, mes).n;
  const assunto = encodeURIComponent(`NFS-e — OC ${contrato.numeroOC || ''} — Item ${n}`);
  const campo = (rotulo, id, campoNome, tipo = 'text', extra = '') => html`<label class="campo"><span>${rotulo}</span>
    <input type="${tipo}" id="${id}" value="${contrato[campoNome] || ''}" data-ao-mudar="campoContrato" data-campo="${campoNome}" ${html.cru(extra)}></label>`;
  return html`
    <section class="cartao" aria-labelledby="t-nf">
      <h2 id="t-nf">Nota fiscal (NFS-e)</h2>
      <div class="campos">
        <div class="campos campos-2">
          ${html.cru(campo('Nº da OC', 'numero-oc', 'numeroOC', 'text', `inputmode="numeric" ${!contrato.numeroOC ? 'aria-invalid="true"' : ''}`))}
          ${html.cru(campo('Código do item na OC', 'codigo-item-oc', 'codigoItemOC', 'text', !contrato.codigoItemOC ? 'aria-invalid="true"' : ''))}
        </div>
        <small class="subtitulo">Valem para todos os itens. Ficam só neste aparelho (e nos backups).</small>
        <div class="campos campos-2">
          ${html.cru(campo('Tomador', 'tomador', 'tomador'))}
          ${html.cru(campo('CNPJ do tomador (matriz)', 'cnpj-tomador', 'cnpjTomador', 'text', 'inputmode="numeric"'))}
        </div>
        <div class="campos campos-2">
          ${html.cru(campo('E-mail do DANFSE (PDF)', 'email-danfse', 'emailDanfse', 'email'))}
          ${html.cru(campo('E-mail do XML', 'email-xml', 'emailXml', 'email'))}
        </div>
        <label class="campo"><span>Nº da NFS-e emitida (item ${n})</span>
          <input type="text" id="numero-nf" value="${medicao.numeroNF}" data-ao-mudar="numeroNF"></label>
      </div>
      <p class="rotulo" style="margin-top:12px">Descrição do serviço · item ${n} (Mês ${n})</p>
      <pre class="texto-pronto" id="texto-nf">${texto}</pre>
      <div class="linha-acoes">
        <button type="button" class="btn btn-primario" data-acao="copiarNF">${html.cru(icone('copiar'))} Copiar descrição</button>
        ${html.cru(contrato.emailDanfse ? html`<a class="btn" href="mailto:${contrato.emailDanfse}?subject=${assunto}">E-mail do DANFSE (PDF)</a>` : '')}
        ${html.cru(contrato.emailXml ? html`<a class="btn" href="mailto:${contrato.emailXml}?subject=${assunto}">E-mail do XML</a>` : '')}
      </div>
    </section>`;
}

// ---------- ações ----------

function atualizarMedicao(ctx, mes, fn, opcoes) {
  ctx.atualizar((e) => {
    e.medicoes[mes] = fn(e.medicoes[mes] || novaMedicao(mes));
  }, opcoes);
}

let temporizadorResumo;

export const acoes = {
  alternarDia(el, ev, ctx) {
    const d = el.dataset.dia;
    ctx.atualizar((e) => {
      const sugerido = ehDiaSugerido(d, e.contrato, e.feriados);
      e.marcas = marcarDia(e.marcas, d, proximaMarca(e.marcas[d], sugerido));
    });
    document.querySelector(`[data-dia="${d}"]`)?.focus();
  },

  marcarSugeridos(el, ev, ctx) {
    const mes = mesSelecionado(ctx);
    ctx.atualizar((e) => {
      const p = periodoDaMedicao(mes, e.contrato);
      for (const d of intervaloDias(p.inicio, p.fim)) {
        if (d < ctx.hoje && situacaoDia(d, e.marcas, e.contrato, e.feriados) === 'sugerido') e.marcas[d] = DIA.TRABALHADO;
      }
    }, { aviso: 'Dias marcados.' });
  },

  avancarEtapa(form, ev, ctx) {
    const mes = mesSelecionado(ctx);
    const data = form.elements.data.value;
    try {
      const nova = avancar(medicaoDe(ctx.estado, mes), data, { contrato: ctx.estado.contrato, medicoes: ctx.estado.medicoes });
      atualizarMedicao(ctx, mes, () => nova, { aviso: `${ESTADOS[indiceEstado(nova.estado)].nome} em ${formatarData(data)}.` });
    } catch (erro) {
      ctx.avisar(erro.message, true);
    }
  },

  voltarEtapa(el, ev, ctx) {
    atualizarMedicao(ctx, mesSelecionado(ctx), voltar, { aviso: 'Etapa desfeita.' });
  },

  editarResumo(el, ev, ctx) {
    const mes = mesSelecionado(ctx);
    const valor = el.value;
    clearTimeout(temporizadorResumo);
    temporizadorResumo = setTimeout(() => {
      atualizarMedicao(ctx, mes, (m) => ({ ...m, resumo: valor }), { renderizar: false });
      const e = ctx.estado;
      const alvo = document.getElementById('texto-boletim');
      if (alvo) alvo.textContent = textoBoletim(mes, { contrato: e.contrato, perfil: e.perfil, marcas: e.marcas, medicao: e.medicoes[mes] });
    }, 300);
  },

  campoContrato(el, ev, ctx) {
    ctx.atualizar((e) => { e.contrato[el.dataset.campo] = el.value.trim(); }, { aviso: 'Salvo.' });
  },

  numeroNF(el, ev, ctx) {
    const mes = mesSelecionado(ctx);
    const numero = el.value.trim();
    const repetida = numero && Object.values(ctx.estado.medicoes).find((m) => m.mes !== mes && m.numeroNF === numero);
    if (repetida) {
      el.setAttribute('aria-invalid', 'true');
      ctx.avisar(`A NFS-e ${numero} já está no item de ${rotuloCompetencia(repetida.mes)}: uma nota por item.`, true);
      return;
    }
    atualizarMedicao(ctx, mes, (m) => ({ ...m, numeroNF: numero }), { aviso: 'Salvo.' });
  },

  async copiarBoletim(el, ev, ctx) {
    const mes = mesSelecionado(ctx);
    const e = ctx.estado;
    const ok = await copiarTexto(textoBoletim(mes, { contrato: e.contrato, perfil: e.perfil, marcas: e.marcas, medicao: medicaoDe(e, mes) }));
    ctx.avisar(ok ? 'Texto do boletim copiado.' : 'Não foi possível copiar.', !ok);
  },

  async copiarNF(el, ev, ctx) {
    const e = ctx.estado;
    const ok = await copiarTexto(textoNF(mesSelecionado(ctx), { contrato: e.contrato }));
    ctx.avisar(ok ? 'Descrição da NF copiada.' : 'Não foi possível copiar.', !ok);
  },

  irParaNF() {
    const alvo = document.getElementById('t-nf');
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('numero-oc')?.focus({ preventScroll: true }), 400);
  },

  carregarExemplo: (el, ev, ctx) => ctx.carregarExemplo(),
  apagarExemplo: (el, ev, ctx) => ctx.apagarExemplo(),
};

export { mesSelecionado };
