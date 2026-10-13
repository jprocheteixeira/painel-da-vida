// Gastos: lançamento rápido, resumo por categoria, lançamentos do mês, fixos, parcelados e categorias.

import {
  ehMesISO, mesDe, somarMeses, nomeMes, rotuloCompetencia, formatarData, formatarDataCurta, nomeSemana, ehDataISO,
} from '../../utils/datas.js';
import { formatarReais, lerReais, centavosParaCampo } from '../../utils/dinheiro.js';
import {
  resumoDoMes, ocorrenciasParcelamento, parcelasPagas, novoId, CATEGORIA_RESERVA,
  totalEstimativa, estimativasPadrao, SUGESTOES_ESTIMATIVA,
} from '../../dominio/gastos.js';
import { html, icone } from '../util.js';
import { faixaExemplo } from './pj.js';

function mesSelecionado(ctx) {
  const pedido = ctx.rota.params[0];
  return ehMesISO(pedido) ? pedido : mesDe(ctx.hoje);
}

export function titulo(ctx) {
  return `Gastos · ${rotuloCompetencia(mesSelecionado(ctx))}`;
}

const nomeCategoria = (estado, id) => estado.categorias.find((c) => c.id === id)?.nome || 'Outros';

export function render(ctx) {
  const { estado, hoje } = ctx;
  const mes = mesSelecionado(ctx);
  const r = resumoDoMes(estado, mes);
  const maior = r.categorias.find((c) => c.total > 0);
  const comOrcamento = r.categorias.filter((c) => c.orcamento != null);
  const orcado = comOrcamento.reduce((s, c) => s + c.orcamento, 0);
  const gastoOrcado = comOrcamento.reduce((s, c) => s + c.total, 0);
  const ativos = estado.parcelamentos.filter((p) => parcelasPagas(p, hoje) < p.parcelas);
  const tomVariacao = r.totalAnterior === 0 ? '' : r.variacao > 0 ? 'valor-ruim' : r.variacao < 0 ? 'valor-bom' : '';

  return html`
    <div class="cabecalho-pagina">
      <div class="navegador-mes">
        <a class="btn btn-icone" href="#/gastos/${somarMeses(mes, -1)}" aria-label="Mês anterior">${html.cru(icone('esquerda'))}</a>
        <h1>Gastos · ${nomeMes(mes)}</h1>
        <a class="btn btn-icone" href="#/gastos/${somarMeses(mes, 1)}" aria-label="Próximo mês">${html.cru(icone('direita'))}</a>
      </div>
      ${html.cru(mes !== mesDe(hoje) ? '<a class="btn btn-pequeno" href="#/gastos">Mês atual</a>' : '')}
    </div>
    ${html.cru(estado.meta.exemplo ? faixaExemplo() : '')}

    ${html.cru(cartaoLancar(estado, hoje, mes))}

    <section class="bento" aria-label="Resumo dos gastos">
      <article class="kpi kpi-destaque">
        <p class="kpi-rotulo">Gasto em ${nomeMes(mes).split(' de ')[0]}</p>
        <p class="kpi-valor">${formatarReais(r.total)}</p>
        <p class="kpi-detalhe">${html.cru(r.totalAnterior ? html`<span class="${tomVariacao}">${formatarReais(r.variacao, { sinal: true })}</span> em relação a ${nomeMes(somarMeses(mes, -1)).split(' de ')[0]}` : 'sem gastos no mês anterior')}</p>
      </article>
      <article class="kpi">
        <p class="kpi-rotulo">Maior categoria</p>
        <p class="kpi-valor">${maior ? maior.nome : '—'}</p>
        <p class="kpi-detalhe">${maior ? `${formatarReais(maior.total)} · ${Math.round(maior.fracao * 100)}% do mês` : 'nenhum gasto ainda'}</p>
      </article>
      <article class="kpi ${orcado ? (gastoOrcado > orcado ? 'kpi-ruim' : 'kpi-bom') : ''}">
        <p class="kpi-rotulo">Orçamento</p>
        <p class="kpi-valor">${orcado ? formatarReais(orcado - gastoOrcado) : '—'}</p>
        <p class="kpi-detalhe">${orcado ? (gastoOrcado > orcado ? 'acima do orçado' : `sobram de ${formatarReais(orcado)}`) : 'defina em “Categorias”'}</p>
      </article>
      <article class="kpi">
        <p class="kpi-rotulo">Parcelados ativos</p>
        <p class="kpi-valor">${ativos.length}</p>
        <p class="kpi-detalhe">${ativos.length ? `${formatarReais(ativos.reduce((s, p) => s + p.valorParcelaCentavos, 0))} por mês` : 'nenhum'}</p>
      </article>
    </section>

    <div class="grade grade-2">
      ${html.cru(cartaoEstimativa(estado, r))}
      ${html.cru(cartaoCategorias(r))}
      ${html.cru(cartaoLancamentos(estado, r, mes))}
      ${html.cru(cartaoFixos(estado))}
      ${html.cru(cartaoParcelados(estado, hoje))}
      ${html.cru(cartaoEditarCategorias(estado))}
    </div>`;
}

function opcoesCategoria(estado, selecionada) {
  return estado.categorias.map((c) =>
    `<option value="${c.id}" ${c.id === selecionada ? 'selected' : ''}>${c.nome.replace(/</g, '&lt;')}</option>`).join('');
}

// ---------- lançamento rápido ----------

let ultimaCategoria = 'mercado';

function cartaoLancar(estado, hoje, mes) {
  const data = mes === mesDe(hoje) ? hoje : `${mes}-01`;
  const cat = estado.categorias.some((c) => c.id === ultimaCategoria) ? ultimaCategoria : estado.categorias[0]?.id;
  const chips = estado.categorias.map((c) => html`<label class="chip-check">
    <input type="radio" name="categoria" value="${c.id}" ${html.cru(c.id === cat ? 'checked' : '')}>
    <span>${c.nome}</span></label>`);
  return html`
    <section class="cartao cartao-lancar" aria-labelledby="t-lancar">
      <h2 id="t-lancar">Lançar gasto <span class="subtitulo">atalho: tecla <kbd>N</kbd></span></h2>
      <form data-ao-enviar="lancar" class="form-lancar" autocomplete="off">
        <div class="lancar-linha">
          <label class="campo campo-valor"><span>Valor (R$)</span>
            <input type="text" id="gasto-valor" name="valor" inputmode="decimal" placeholder="0,00" required></label>
          <label class="campo"><span>Data</span><input type="date" name="data" value="${data}" required></label>
          <label class="campo campo-nota"><span>Nota (opcional)</span><input type="text" name="nota" placeholder="Ex.: feira do sábado"></label>
          <button class="btn btn-primario" type="submit">${html.cru(icone('mais'))} Lançar</button>
        </div>
        <fieldset class="chips-categoria"><legend class="visualmente-oculto">Categoria</legend>${html.cru(chips)}</fieldset>
      </form>
    </section>`;
}

// ---------- estimativa mensal ----------

function cartaoEstimativa(estado, r) {
  const total = totalEstimativa(estado.estimativas);
  const preenchidos = estado.estimativas.filter((e) => e.valorCentavos != null).length;
  const removidos = estimativasPadrao().filter((p) => !estado.estimativas.some((e) => e.id === p.id));
  const nomesUsados = new Set(estado.estimativas.map((e) => e.nome.toLowerCase()));
  const sugestoes = SUGESTOES_ESTIMATIVA.filter((s) => !nomesUsados.has(s.nome.toLowerCase()));
  const linhas = estado.estimativas.map((e, i) => html`<li class="linha-estimativa">
    <label for="est-${e.id}" class="est-nome">${e.nome}</label>
    <input type="text" id="est-${e.id}" inputmode="decimal" placeholder="R$ 0,00"
      value="${e.valorCentavos != null ? centavosParaCampo(e.valorCentavos) : ''}" data-ao-mudar="valorEstimativa" data-indice="${i}">
    <button type="button" class="btn btn-icone btn-fantasma btn-pequeno" data-acao="removerEstimativa" data-indice="${i}"
      aria-label="Excluir ${e.nome} (não tenho esse gasto)" title="Não tenho esse gasto">×</button>
  </li>`);
  const diferenca = r.total - total;
  return html`
    <section class="cartao" aria-labelledby="t-est">
      <h2 id="t-est">Quanto você gasta por mês <span class="subtitulo">estimativa</span></h2>
      <p class="subtitulo">Preencha um valor aproximado em cada item. Não tem esse gasto? Exclua no ×. A soma entra na projeção
        do caixa como o mínimo que sai por mês; o que você lança de verdade desconta dela.</p>
      <ul class="lista-estimativas">${html.cru(linhas)}</ul>
      <div class="adicionar-estimativa">
        <p class="adicionar-titulo">${html.cru(icone('mais'))} Adicionar um gasto seu</p>
        <form class="form-adicionar-estimativa" data-ao-enviar="adicionarEstimativa">
          <label class="campo"><span>O que é</span><input type="text" id="nova-estimativa" name="nome" required placeholder="Ex.: Corte de cabelo"></label>
          <label class="campo"><span>Valor por mês (R$)</span><input type="text" name="valor" inputmode="decimal" placeholder="0,00"></label>
          <label class="campo"><span>Categoria</span><select name="categoria">${html.cru(opcoesCategoria(estado, CATEGORIA_RESERVA))}</select></label>
          <button class="btn btn-primario" type="submit">${html.cru(icone('mais'))} Adicionar</button>
        </form>
        <small class="subtitulo">Gasto que não é todo mês (IPVA, seguro, presente de Natal)? Divida o valor do ano por 12.</small>
        ${html.cru(sugestoes.length ? html`<p class="rotulo" style="margin-top:10px">Sugestões (um toque adiciona):</p>
          <div class="sugestoes">${html.cru(sugestoes.map((s) => html`<button type="button" class="chip-sugestao" data-acao="adicionarSugestao"
            data-nome="${s.nome}" data-categoria="${s.categoriaId}">+ ${s.nome}</button>`))}</div>` : '')}
      </div>
      <div class="total-estimativa">
        <span>Total estimado · ${preenchidos} ${preenchidos === 1 ? 'item preenchido' : 'itens preenchidos'}</span>
        <strong class="num">${formatarReais(total)}<small class="subtitulo"> /mês</small></strong>
      </div>
      ${html.cru(total && r.total ? html`<p class="subtitulo">Neste mês você já tem ${formatarReais(r.total)} em gastos:
        <span class="${diferenca > 0 ? 'valor-ruim' : 'valor-bom'}">${diferenca > 0 ? `${formatarReais(diferenca)} acima` : `${formatarReais(-diferenca)} abaixo`}</span> da estimativa.</p>` : '')}
      ${html.cru(removidos.length ? html`<div class="linha-acoes"><button type="button" class="btn btn-fantasma btn-pequeno" data-acao="restaurarEstimativas">
        ${html.cru(icone('desfazer'))} Trazer de volta os itens excluídos (${removidos.length})</button></div>` : '')}
    </section>`;
}

// ---------- resumo por categoria ----------

function cartaoCategorias(r) {
  const comGasto = r.categorias.filter((c) => c.total > 0 || c.anterior > 0 || c.orcamento != null);
  const max = Math.max(1, ...comGasto.map((c) => Math.max(c.total, c.anterior, c.orcamento || 0)));
  const linhas = comGasto.map((c) => {
    const largura = (c.total / max) * 100;
    const marcaAnterior = (c.anterior / max) * 100;
    const marcaOrcamento = c.orcamento != null ? (c.orcamento / max) * 100 : null;
    const dif = c.total - c.anterior;
    const dica = `${c.nome}: ${formatarReais(c.total)} · mês anterior ${formatarReais(c.anterior)}`
      + (c.orcamento != null ? ` · orçamento ${formatarReais(c.orcamento)}` : '');
    return html`<li class="barra-cat ${c.acimaDoOrcamento ? 'acima' : ''}">
      <div class="barra-cat-topo">
        <span class="barra-cat-nome">${c.nome}</span>
        <span class="num barra-cat-valor">${formatarReais(c.total)}</span>
      </div>
      <div class="barra-trilho" data-dica="${dica}">
        <div class="barra-preenchida" style="width:${largura.toFixed(1)}%"></div>
        ${html.cru(c.anterior ? `<span class="marca-anterior" style="left:${marcaAnterior.toFixed(1)}%" title="Mês anterior"></span>` : '')}
        ${html.cru(marcaOrcamento != null ? `<span class="marca-orcamento" style="left:${Math.min(100, marcaOrcamento).toFixed(1)}%" title="Orçamento"></span>` : '')}
      </div>
      <div class="barra-cat-rodape">
        <span>${html.cru(c.anterior ? html`mês anterior ${formatarReais(c.anterior)} (<span class="${dif > 0 ? 'valor-ruim' : dif < 0 ? 'valor-bom' : ''}">${formatarReais(dif, { sinal: true })}</span>)` : 'sem gasto no mês anterior')}</span>
        ${html.cru(c.orcamento != null ? html`<span class="${c.acimaDoOrcamento ? 'valor-ruim' : 'valor-bom'}">${html.cru(c.acimaDoOrcamento ? icone('alerta', 'ic ic-p') : '')}${c.acimaDoOrcamento ? 'acima' : 'dentro'} do orçamento (${formatarReais(c.orcamento)})</span>` : '')}
      </div>
    </li>`;
  });
  return html`
    <section class="cartao" aria-labelledby="t-cat">
      <h2 id="t-cat">Por categoria</h2>
      ${html.cru(linhas.length ? html`
        <div class="legenda" aria-hidden="true"><span><i class="l-barra"></i>Este mês</span><span><i class="l-anterior"></i>Mês anterior</span><span><i class="l-orcamento"></i>Orçamento</span></div>
        <ul class="barras-cat">${html.cru(linhas)}</ul>` : '<p class="vazio">Nenhum gasto neste mês ainda.</p>')}
    </section>`;
}

// ---------- lista ----------

const ROTULO_ORIGEM = { fixo: 'fixo', parcela: 'parcela' };

function cartaoLancamentos(estado, r, mes) {
  const porDia = {};
  for (const i of r.itens) (porDia[i.data] ||= []).push(i);
  const blocos = Object.keys(porDia).sort().reverse().map((d) => html`
    <li class="dia-gastos">
      <p class="dia-gastos-titulo">${nomeSemana(d, true)}, ${formatarDataCurta(d)}</p>
      <ul>${html.cru(porDia[d].map((i) => html`<li class="gasto">
        <span class="gasto-desc">${i.descricao || nomeCategoria(estado, i.categoriaId)}
          <small>${nomeCategoria(estado, i.categoriaId)}${html.cru(ROTULO_ORIGEM[i.origem] ? ` · <span class="etiqueta">${ROTULO_ORIGEM[i.origem]}</span>` : '')}</small></span>
        <span class="num">${formatarReais(i.valorCentavos)}</span>
        ${html.cru(i.origem === 'manual'
          ? html`<button type="button" class="btn btn-icone btn-fantasma btn-pequeno" data-acao="apagarLancamento" data-id="${i.refId}" aria-label="Apagar gasto de ${formatarReais(i.valorCentavos)} em ${formatarData(i.data)}">${html.cru(icone('lixo'))}</button>`
          : '<span class="gasto-auto" title="Gerado automaticamente; edite no cartão de fixos ou parcelados">auto</span>')}
      </li>`))}</ul>
    </li>`);
  return html`
    <section class="cartao" aria-labelledby="t-lanc">
      <h2 id="t-lanc">Lançamentos de ${nomeMes(mes).split(' de ')[0]} <span class="subtitulo num">${r.itens.length}</span></h2>
      ${html.cru(blocos.length ? `<ul class="lista-dias-gastos">${blocos.join('')}</ul>` : '<p class="vazio">Nada lançado.</p>')}
    </section>`;
}

// ---------- fixos ----------

function cartaoFixos(estado) {
  const itens = estado.recorrencias.map((r, i) => html`<li>
    <span><strong>${r.descricao}</strong><br><small class="subtitulo">${nomeCategoria(estado, r.categoriaId)} · todo dia ${r.dia}${r.fim ? ` · até ${formatarData(r.fim)}` : ''}</small></span>
    <span class="num">${formatarReais(r.valorCentavos)}</span>
    <button type="button" class="btn btn-icone btn-fantasma" data-acao="removerFixo" data-indice="${i}" aria-label="Remover ${r.descricao}">${html.cru(icone('lixo'))}</button>
  </li>`);
  return html`
    <section class="cartao" aria-labelledby="t-fixos">
      <h2 id="t-fixos">Gastos fixos mensais</h2>
      ${html.cru(itens.length ? `<ul class="lista-fixos">${itens.join('')}</ul>` : '<p class="vazio">Aluguel, internet, celular e assinaturas: lance uma vez e eles entram todo mês.</p>')}
      <form class="form-fixo" data-ao-enviar="adicionarFixo">
        <label class="campo"><span>Descrição</span><input type="text" name="descricao" required placeholder="Ex.: Aluguel"></label>
        <label class="campo"><span>Valor (R$)</span><input type="text" name="valor" inputmode="decimal" required placeholder="0,00"></label>
        <label class="campo"><span>Dia</span><input type="number" name="dia" min="1" max="31" value="10" required></label>
        <label class="campo"><span>Categoria</span><select name="categoria">${html.cru(opcoesCategoria(estado, 'contas'))}</select></label>
        <label class="campo"><span>Até (opcional)</span><input type="date" name="fim"></label>
        <button class="btn btn-primario" type="submit">${html.cru(icone('mais'))} Adicionar</button>
      </form>
    </section>`;
}

// ---------- parcelados ----------

function cartaoParcelados(estado, hoje) {
  const itens = estado.parcelamentos.map((p, i) => {
    const pagas = parcelasPagas(p, hoje);
    const ult = ocorrenciasParcelamento(p).at(-1);
    return html`<li>
      <span><strong>${p.descricao}</strong><br><small class="subtitulo">${nomeCategoria(estado, p.categoriaId)} · ${pagas}/${p.parcelas} pagas · última em ${formatarData(ult.data)}</small>
        <span class="progresso" aria-hidden="true"><span style="width:${((pagas / p.parcelas) * 100).toFixed(0)}%"></span></span></span>
      <span class="num">${formatarReais(p.valorParcelaCentavos)}<small class="subtitulo"> /mês</small></span>
      <button type="button" class="btn btn-icone btn-fantasma" data-acao="removerParcelado" data-indice="${i}" aria-label="Remover ${p.descricao}">${html.cru(icone('lixo'))}</button>
    </li>`;
  });
  return html`
    <section class="cartao" aria-labelledby="t-parc">
      <h2 id="t-parc">Parcelados</h2>
      ${html.cru(itens.length ? `<ul class="lista-fixos">${itens.join('')}</ul>` : '<p class="vazio">Compras parceladas geram as parcelas futuras sozinhas.</p>')}
      <form class="form-fixo" data-ao-enviar="adicionarParcelado">
        <label class="campo"><span>Descrição</span><input type="text" name="descricao" required placeholder="Ex.: Notebook"></label>
        <label class="campo"><span>Valor da parcela (R$)</span><input type="text" name="valor" inputmode="decimal" required placeholder="0,00"></label>
        <label class="campo"><span>Parcelas</span><input type="number" name="parcelas" min="2" max="72" value="10" required></label>
        <label class="campo"><span>Categoria</span><select name="categoria">${html.cru(opcoesCategoria(estado, CATEGORIA_RESERVA))}</select></label>
        <label class="campo"><span>1ª parcela</span><input type="date" name="primeira" value="${hoje}" required></label>
        <button class="btn btn-primario" type="submit">${html.cru(icone('mais'))} Adicionar</button>
      </form>
    </section>`;
}

// ---------- categorias ----------

function cartaoEditarCategorias(estado) {
  const linhas = estado.categorias.map((c, i) => html`<li class="linha-categoria">
    <label class="campo"><span class="visualmente-oculto">Nome da categoria</span>
      <input type="text" id="cat-nome-${c.id}" value="${c.nome}" data-ao-mudar="nomeCategoria" data-indice="${i}"></label>
    <label class="campo"><span class="visualmente-oculto">Orçamento mensal de ${c.nome}</span>
      <input type="text" id="cat-orc-${c.id}" inputmode="decimal" placeholder="sem orçamento" value="${c.orcamentoCentavos != null ? centavosParaCampo(c.orcamentoCentavos) : ''}" data-ao-mudar="orcamentoCategoria" data-indice="${i}"></label>
    <button type="button" class="btn btn-icone btn-fantasma" data-acao="removerCategoria" data-indice="${i}" aria-label="Remover categoria ${c.nome}"
      ${html.cru(c.id === CATEGORIA_RESERVA ? 'disabled title="“Outros” não pode ser removida"' : '')}>${html.cru(icone('lixo'))}</button>
  </li>`);
  return html`
    <section class="cartao" aria-labelledby="t-cats">
      <details class="secao">
        <summary><h2 id="t-cats">Categorias e orçamentos</h2></summary>
        <p class="subtitulo">Orçamento é opcional: deixe em branco para não ter limite. Gastos de uma categoria removida passam para “Outros”.</p>
        <div class="cabecalho-categorias rotulo"><span>Categoria</span><span>Orçamento/mês</span><span></span></div>
        <ul class="lista-categorias">${html.cru(linhas)}</ul>
        <form class="avancar-linha" style="margin-top:10px" data-ao-enviar="adicionarCategoria">
          <label class="campo"><span>Nova categoria</span><input type="text" name="nome" required placeholder="Ex.: Pet"></label>
          <button class="btn" type="submit">${html.cru(icone('mais'))} Adicionar</button>
        </form>
      </details>
    </section>`;
}

// ---------- ações ----------

function valorValido(texto, ctx) {
  const v = lerReais(texto);
  if (v == null || v <= 0) { ctx.avisar('Valor inválido. Use, por exemplo, 45,90.', true); return null; }
  return v;
}

export const acoes = {
  lancar(form, ev, ctx) {
    const f = form.elements;
    const valor = valorValido(f.valor.value, ctx);
    if (valor == null) { f.valor.focus(); return; }
    if (!ehDataISO(f.data.value)) { ctx.avisar('Data inválida.', true); return; }
    const categoriaId = form.querySelector('input[name="categoria"]:checked')?.value || CATEGORIA_RESERVA;
    ultimaCategoria = categoriaId;
    ctx.atualizar((e) => {
      e.lancamentos.push({ id: novoId('g'), data: f.data.value, valorCentavos: valor, categoriaId, nota: f.nota.value.trim() });
    }, { aviso: `${formatarReais(valor)} em ${nomeCategoria(ctx.estado, categoriaId)} lançado.` });
    document.getElementById('gasto-valor')?.focus();
  },

  apagarLancamento(el, ev, ctx) {
    const id = el.dataset.id;
    const l = ctx.estado.lancamentos.find((x) => x.id === id);
    if (!l || !confirm(`Apagar o gasto de ${formatarReais(l.valorCentavos)} (${formatarData(l.data)})?`)) return;
    ctx.atualizar((e) => { e.lancamentos = e.lancamentos.filter((x) => x.id !== id); }, { aviso: 'Gasto apagado.' });
  },

  adicionarFixo(form, ev, ctx) {
    const f = form.elements;
    const valor = valorValido(f.valor.value, ctx);
    const dia = Number(f.dia.value);
    if (valor == null) return;
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) { ctx.avisar('Dia entre 1 e 31.', true); return; }
    ctx.atualizar((e) => {
      e.recorrencias.push({ id: novoId('r'), descricao: f.descricao.value.trim(), valorCentavos: valor, dia,
        inicio: `${mesDe(ctx.hoje)}-01`, fim: f.fim.value || null, categoriaId: f.categoria.value });
    }, { aviso: 'Gasto fixo adicionado.' });
  },

  removerFixo(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    const r = ctx.estado.recorrencias[i];
    if (!confirm(`Remover “${r.descricao}”? Some de todos os meses.`)) return;
    ctx.atualizar((e) => { e.recorrencias.splice(i, 1); }, { aviso: 'Removido.' });
  },

  adicionarParcelado(form, ev, ctx) {
    const f = form.elements;
    const valor = valorValido(f.valor.value, ctx);
    const parcelas = Number(f.parcelas.value);
    if (valor == null) return;
    if (!Number.isInteger(parcelas) || parcelas < 2 || parcelas > 72) { ctx.avisar('Use de 2 a 72 parcelas.', true); return; }
    if (!ehDataISO(f.primeira.value)) { ctx.avisar('Data da 1ª parcela inválida.', true); return; }
    ctx.atualizar((e) => {
      e.parcelamentos.push({ id: novoId('p'), descricao: f.descricao.value.trim(), valorParcelaCentavos: valor,
        parcelas, primeiraData: f.primeira.value, categoriaId: f.categoria.value });
    }, { aviso: `${parcelas} parcelas de ${formatarReais(valor)} adicionadas.` });
  },

  removerParcelado(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    const p = ctx.estado.parcelamentos[i];
    if (!confirm(`Remover “${p.descricao}” e todas as parcelas?`)) return;
    ctx.atualizar((e) => { e.parcelamentos.splice(i, 1); }, { aviso: 'Removido.' });
  },

  nomeCategoria(el, ev, ctx) {
    const nome = el.value.trim();
    if (!nome) { ctx.avisar('O nome não pode ficar vazio.', true); return; }
    ctx.atualizar((e) => { e.categorias[Number(el.dataset.indice)].nome = nome; }, { aviso: 'Salvo.' });
  },

  orcamentoCategoria(el, ev, ctx) {
    const texto = el.value.trim();
    const v = texto ? lerReais(texto) : null;
    if (texto && (v == null || v < 0)) { ctx.avisar('Orçamento inválido.', true); return; }
    ctx.atualizar((e) => { e.categorias[Number(el.dataset.indice)].orcamentoCentavos = v; }, { aviso: 'Salvo.' });
  },

  removerCategoria(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    const c = ctx.estado.categorias[i];
    if (c.id === CATEGORIA_RESERVA) return;
    if (!confirm(`Remover a categoria “${c.nome}”? Os gastos dela passam para “Outros”.`)) return;
    ctx.atualizar((e) => {
      e.categorias.splice(i, 1);
      const mover = (x) => (x.categoriaId === c.id ? { ...x, categoriaId: CATEGORIA_RESERVA } : x);
      e.lancamentos = e.lancamentos.map(mover);
      e.recorrencias = e.recorrencias.map(mover);
      e.parcelamentos = e.parcelamentos.map(mover);
    }, { aviso: 'Categoria removida.' });
  },

  adicionarCategoria(form, ev, ctx) {
    const nome = form.elements.nome.value.trim();
    if (!nome) return;
    ctx.atualizar((e) => { e.categorias.push({ id: novoId('c'), nome, orcamentoCentavos: null }); }, { aviso: 'Categoria adicionada.' });
  },

  valorEstimativa(el, ev, ctx) {
    const texto = el.value.trim();
    const v = texto ? lerReais(texto) : null;
    if (texto && (v == null || v < 0)) { el.setAttribute('aria-invalid', 'true'); ctx.avisar('Valor inválido. Use, por exemplo, 350,00.', true); return; }
    ctx.atualizar((e) => { e.estimativas[Number(el.dataset.indice)].valorCentavos = v; }, { aviso: 'Salvo.' });
  },

  removerEstimativa(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    const nome = ctx.estado.estimativas[i].nome;
    ctx.atualizar((e) => { e.estimativas.splice(i, 1); }, { aviso: `“${nome}” excluído.` });
  },

  adicionarEstimativa(form, ev, ctx) {
    const nome = form.elements.nome.value.trim();
    const texto = form.elements.valor.value.trim();
    const v = texto ? lerReais(texto) : null;
    if (!nome) return;
    if (texto && (v == null || v < 0)) { ctx.avisar('Valor inválido.', true); return; }
    const categoriaId = form.elements.categoria?.value || CATEGORIA_RESERVA;
    ctx.atualizar((e) => { e.estimativas.push({ id: novoId('e'), nome, categoriaId, valorCentavos: v }); },
      { aviso: `“${nome}” adicionado.` });
    document.getElementById('nova-estimativa')?.focus();
  },

  adicionarSugestao(el, ev, ctx) {
    const id = novoId('e');
    const { nome, categoria } = el.dataset;
    ctx.atualizar((e) => { e.estimativas.push({ id, nome, categoriaId: categoria, valorCentavos: null }); },
      { aviso: `“${nome}” adicionado. Coloque o valor.` });
    const campo = document.getElementById(`est-${id}`);
    campo?.scrollIntoView({ block: 'center' });
    campo?.focus();
  },

  restaurarEstimativas(el, ev, ctx) {
    ctx.atualizar((e) => {
      const faltando = estimativasPadrao().filter((p) => !e.estimativas.some((x) => x.id === p.id));
      e.estimativas.push(...faltando);
    }, { aviso: 'Itens de volta.' });
  },

  carregarExemplo: (el, ev, ctx) => ctx.carregarExemplo(),
  apagarExemplo: (el, ev, ctx) => ctx.apagarExemplo(),
};
