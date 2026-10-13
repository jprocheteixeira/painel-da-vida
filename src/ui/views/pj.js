// Trabalho PJ: calendário de dias, etapas da medição, datas, boletim e NFS-e.

import {
  ehMesISO, mesDe, somarMeses, nomeMes, inicioSemana, somarDias, intervaloDias, formatarData,
  dataPorExtenso, diaDaSemana, rotuloCompetencia, nomeSemana,
} from '../../utils/datas.js';
import { formatarReais } from '../../utils/dinheiro.js';
import {
  situacaoDia, proximaMarca, marcarDia, ehDiaSugerido, periodoCompetencia, contagemPorSemana,
  competenciasDoContrato, competenciaDoDia, DIA, diasPrevistos,
} from '../../dominio/contrato.js';
import { feriadoEm } from '../../dominio/feriados.js';
import {
  ESTADOS, indiceEstado, novaMedicao, proximoEstado, avancar, voltar, datasChave, resumoMedicao,
  textoBoletim, textoNF, diasAteReceber,
} from '../../dominio/medicao.js';
import { html, icone, copiarTexto } from '../util.js';

const CABECALHO_SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/** Mês exibido: o da rota; senão o atual, limitado ao período do contrato. */
function mesSelecionado(ctx) {
  const pedido = ctx.rota.params[0];
  if (ehMesISO(pedido)) return pedido;
  const { contrato } = ctx.estado;
  const atual = competenciaDoDia(ctx.hoje, contrato.diaCorte);
  const meses = competenciasDoContrato(contrato);
  if (!meses.length) return atual;
  if (atual < meses[0]) return meses[0];
  if (atual > meses.at(-1)) return meses.at(-1);
  return atual;
}

const medicaoDe = (estado, mes) => estado.medicoes[mes] || novaMedicao(mes);

export function titulo(ctx) {
  return `Trabalho PJ · ${rotuloCompetencia(mesSelecionado(ctx))}`;
}

export function render(ctx) {
  const { estado, hoje } = ctx;
  const { contrato } = estado;
  const mes = mesSelecionado(ctx);

  if (!contrato.inicio) {
    return html`
      <div class="cabecalho-pagina"><h1>Trabalho PJ</h1></div>
      <div class="cartao vazio-grande">
        <h2>Configure o contrato para começar</h2>
        <p class="subtitulo">Com a data de início, o valor por dia e os dias da semana, o app sugere os dias de trabalho e calcula todos os prazos.</p>
        <div class="linha-acoes">
          <a class="btn btn-primario" href="#/ajustes">Configurar contrato</a>
          <button type="button" class="btn" data-acao="carregarExemplo">Ver com dados de exemplo</button>
        </div>
      </div>`;
  }

  const medicao = medicaoDe(estado, mes);
  const datas = datasChave(mes, { contrato, feriados: estado.feriados, medicao });
  const resumo = resumoMedicao(mes, { contrato, marcas: estado.marcas });
  const previstos = diasPrevistos(datas.periodo, estado.marcas, contrato, estado.feriados, hoje);

  return html`
    <div class="cabecalho-pagina">
      <div class="navegador-mes">
        <a class="btn btn-icone" href="#/pj/${somarMeses(mes, -1)}" aria-label="Mês anterior">${html.cru(icone('esquerda'))}</a>
        <h1><span>${nomeMes(mes)}</span></h1>
        <a class="btn btn-icone" href="#/pj/${somarMeses(mes, 1)}" aria-label="Próximo mês">${html.cru(icone('direita'))}</a>
      </div>
      ${html.cru(mes !== competenciaDoDia(hoje, contrato.diaCorte)
        ? html`<a class="btn btn-pequeno" href="#/pj">Ir para hoje</a>` : '')}
    </div>

    ${html.cru(avisoPedido(contrato))}
    ${html.cru(estado.meta.exemplo ? faixaExemplo() : '')}

    <div class="grade grade-pj">
      <div class="col">
        ${html.cru(cartaoCalendario(ctx, mes, datas.periodo, previstos))}
        ${html.cru(cartaoBoletim(ctx, mes, medicao, resumo))}
      </div>
      <div class="col">
        ${html.cru(cartaoEtapas(ctx, mes, medicao, resumo))}
        ${html.cru(cartaoDatas(mes, datas, resumo, hoje, medicao))}
        ${html.cru(cartaoNF(ctx, mes, medicao))}
      </div>
    </div>`;
}

function avisoPedido(contrato) {
  if (contrato.pedidoCompra) return '';
  return html`
    <div class="faixa faixa-perigo" role="alert">
      ${html.cru(icone('alerta'))}
      <div>
        <strong>Falta o nº do pedido de compra</strong>
        Sem ele, a NFS-e sai com “[PENDENTE]”. Peça o número ao supervisor e preencha abaixo, no cartão da nota fiscal.
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

function cartaoCalendario(ctx, mes, periodo, previstos) {
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
      const marca = sit === 'trabalhado' ? 'R$' : sit === 'folga' ? 'folga' : feriado ? 'feriado' : '';
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
      <h2 id="t-cal">Dias trabalhados <span class="subtitulo num">${previstos.length} previstos</span></h2>
      ${html.cru(acima.length ? html`
        <div class="faixa faixa-alerta" role="alert">${html.cru(icone('alerta'))}
          <div><strong>Teto semanal ultrapassado</strong>
          ${acima.map((s) => `semana de ${formatarData(s)}: ${porSemana[s]} dias`).join('; ')} (teto: ${contrato.tetoSemanal}).</div>
        </div>` : '')}
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
    </section>`;
}

// ---------- etapas ----------

function cartaoEtapas(ctx, mes, medicao, resumo) {
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
  const semDias = !resumo.dias.length && i === 0;
  return html`
    <section class="cartao" aria-labelledby="t-etapas">
      <h2 id="t-etapas">Etapas de ${rotuloCompetencia(mes)}</h2>
      <ol class="etapas">${html.cru(itens)}</ol>
      ${html.cru(prox ? html`
        <form class="avancar" data-ao-enviar="avancarEtapa">
          <div class="avancar-linha">
            <label class="campo"><span>Data</span>
              <input type="date" name="data" id="data-etapa" value="${ctx.hoje}" required></label>
            <button type="submit" class="btn btn-primario" ${html.cru(semDias ? 'disabled' : '')}>
              ${html.cru(icone('check'))} ${prox.acao}</button>
          </div>
          ${html.cru(semDias ? '<small class="subtitulo">Marque os dias trabalhados antes de enviar o boletim.</small>' : '')}
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

function cartaoDatas(mes, datas, resumo, hoje, medicao) {
  const espera = diasAteReceber(resumo.dias, datas);
  const pago = medicao.estado === 'pago';
  return html`
    <section class="cartao" aria-labelledby="t-datas">
      <h2 id="t-datas">Do trabalho ao dinheiro</h2>
      <dl class="datas">
        <div><dt>Período</dt><dd class="num">${formatarData(datas.periodo.inicio).slice(0, 5)} a ${formatarData(datas.periodo.fim)}</dd></div>
        ${html.cru(linhaData('Enviar boletim até', datas.envioBoletim, hoje, { prazo: true }))}
        ${html.cru(linhaData('Aprovação até (5º dia útil)', datas.aprovacao, hoje, { prazo: true }))}
        ${html.cru(linhaData('Emissão da NF', datas.emissaoNF, hoje))}
        ${html.cru(linhaData(pago ? 'Pago em' : 'Pagamento', datas.pagamento, hoje))}
      </dl>
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
        <span class="num">${resumo.dias.length} ${resumo.dias.length === 1 ? 'dia' : 'dias'} × ${formatarReais(estado.contrato.valorDiaCentavos)}</span>
      </div>
      <label class="campo"><span>Resumo das atividades</span>
        <textarea id="resumo-atividades" data-ao-digitar="editarResumo" placeholder="O que você fez no mês (vai no texto do boletim)">${medicao.resumo}</textarea>
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
  const texto = textoNF(mes, { contrato, marcas: ctx.estado.marcas });
  const faltaPedido = !contrato.pedidoCompra;
  return html`
    <section class="cartao" aria-labelledby="t-nf">
      <h2 id="t-nf">Nota fiscal (NFS-e)</h2>
      <div class="campos">
        <label class="campo"><span>Nº do pedido de compra</span>
          <input type="text" id="pedido-compra" inputmode="numeric" value="${contrato.pedidoCompra}"
            data-ao-mudar="campoContrato" data-campo="pedidoCompra" ${html.cru(faltaPedido ? 'aria-invalid="true"' : '')}
            aria-describedby="ajuda-pedido">
          <small id="ajuda-pedido">${faltaPedido ? 'Obrigatório na descrição da nota.' : 'Vale para todos os meses do contrato.'}</small>
        </label>
        <div class="campos campos-2">
          <label class="campo"><span>Tomador</span>
            <input type="text" id="tomador" value="${contrato.tomador}" data-ao-mudar="campoContrato" data-campo="tomador"></label>
          <label class="campo"><span>E-mail de envio</span>
            <input type="email" id="email-envio" value="${contrato.emailEnvio}" data-ao-mudar="campoContrato" data-campo="emailEnvio"></label>
        </div>
        <label class="campo"><span>Nº da NFS-e emitida (${rotuloCompetencia(mes)})</span>
          <input type="text" id="numero-nf" value="${medicao.numeroNF}" data-ao-mudar="numeroNF"></label>
      </div>
      <p class="rotulo" style="margin-top:12px">Descrição do serviço · competência ${rotuloCompetencia(mes)}</p>
      <pre class="texto-pronto" id="texto-nf">${texto}</pre>
      <div class="linha-acoes">
        <button type="button" class="btn btn-primario" data-acao="copiarNF">${html.cru(icone('copiar'))} Copiar descrição</button>
        ${html.cru(contrato.emailEnvio ? html`<a class="btn" href="mailto:${contrato.emailEnvio}?subject=${encodeURIComponent(`NFS-e — competência ${rotuloCompetencia(mes)}`)}">Abrir e-mail</a>` : '')}
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
      const p = periodoCompetencia(mes, e.contrato.diaCorte);
      for (const d of intervaloDias(p.inicio, p.fim)) {
        if (d < ctx.hoje && situacaoDia(d, e.marcas, e.contrato, e.feriados) === 'sugerido') e.marcas[d] = DIA.TRABALHADO;
      }
    }, { aviso: 'Dias marcados.' });
  },

  avancarEtapa(form, ev, ctx) {
    const mes = mesSelecionado(ctx);
    const data = form.elements.data.value;
    try {
      const nova = avancar(medicaoDe(ctx.estado, mes), data);
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
    atualizarMedicao(ctx, mesSelecionado(ctx), (m) => ({ ...m, numeroNF: el.value.trim() }), { aviso: 'Salvo.' });
  },

  async copiarBoletim(el, ev, ctx) {
    const mes = mesSelecionado(ctx);
    const e = ctx.estado;
    const ok = await copiarTexto(textoBoletim(mes, { contrato: e.contrato, perfil: e.perfil, marcas: e.marcas, medicao: medicaoDe(e, mes) }));
    ctx.avisar(ok ? 'Texto do boletim copiado.' : 'Não foi possível copiar.', !ok);
  },

  async copiarNF(el, ev, ctx) {
    const e = ctx.estado;
    const ok = await copiarTexto(textoNF(mesSelecionado(ctx), { contrato: e.contrato, marcas: e.marcas }));
    ctx.avisar(ok ? 'Descrição da NF copiada.' : 'Não foi possível copiar.', !ok);
  },

  carregarExemplo: (el, ev, ctx) => ctx.carregarExemplo(),
  apagarExemplo: (el, ev, ctx) => ctx.apagarExemplo(),
};

export { mesSelecionado };
