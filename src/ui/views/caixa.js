// Fluxo de caixa: contas, competência × caixa, projeção de saldo, simulador e gastos fixos.

import { formatarData, nomeMes, rotuloCompetencia, ehMesISO, ehDataISO, mesDe } from '../../utils/datas.js';
import { formatarReais, lerReais, centavosParaCampo } from '../../utils/dinheiro.js';
import {
  projecao, saldoAtual, competenciaVsCaixa, gradeSimulador, saldoNoFimDe, recebimentos,
} from '../../dominio/caixa.js';
import { BASES_PRAZO, BASES_PRAZO_FRASE } from '../../dominio/oc.js';
import { totalEstimativa } from '../../dominio/gastos.js';
import { situacaoDas } from '../../dominio/mei.js';
import { html, icone } from '../util.js';
import { barrasAgrupadas, linhaSaldo } from '../graficos.js';
import { faixaExemplo } from './pj.js';

export function titulo() {
  return 'Caixa';
}

/** Mês da "virada do ano": dezembro do ano corrente (ou do último ano da projeção). */
function mesVirada(hoje, horizonte) {
  const dez = `${hoje.slice(0, 4)}-12`;
  return dez <= horizonte ? dez : horizonte;
}

export function render(ctx) {
  const { estado, hoje } = ctx;
  const proj = projecao(estado, hoje);
  const reserva = estado.caixa.reservaMinimaCentavos;
  const virada = mesVirada(hoje, estado.caixa.horizonte);
  const menor = proj.reduce((a, b) => (b.saldoFinal < a.saldoFinal ? b : a), proj[0]);
  const abaixo = proj.filter((p) => p.abaixoDaReserva);
  const hojeSaldo = saldoAtual(estado, hoje);
  // sem saldo informado, a projeção parte de R$ 0: não pinta de bom/ruim para não dar falso alarme
  const tom = (v) => (!estado.caixa.saldoEm ? '' : v < reserva ? 'kpi-ruim' : 'kpi-bom');

  return html`
    <div class="cabecalho-pagina"><div><h1>Fluxo de caixa</h1>
      <p class="subtitulo">Quando você trabalha (competência) × quando o dinheiro entra (caixa), e o saldo até ${nomeMes(estado.caixa.horizonte)}.</p></div></div>
    ${html.cru(estado.meta.exemplo ? faixaExemplo() : '')}
    ${html.cru(!estado.caixa.saldoEm ? html`<div class="faixa faixa-info">${html.cru(icone('info'))}
      <div><strong>Informe quanto você tem hoje</strong>Preencha o saldo das contas abaixo para a projeção partir do valor real. Por enquanto ela parte de R$ 0,00.</div></div>` : '')}
    ${html.cru(abaixo.length && estado.caixa.saldoEm ? html`<div class="faixa faixa-alerta" role="alert">${html.cru(icone('alerta'))}
      <div><strong>Saldo abaixo da reserva mínima (${formatarReais(reserva)})</strong>
      Em ${abaixo.map((p) => nomeMes(p.mes, true)).join(', ')}. O motivo mais comum: cada item da OC só é pago cerca de 30 dias depois da nota (emitida de 15 a 20).</div></div>` : '')}
    ${html.cru(foraDoHorizonte(estado, hoje))}

    <section class="bento" aria-label="Resumo do caixa">
      <article class="kpi kpi-destaque">
        <p class="kpi-rotulo">Saldo na virada do ano</p>
        <p class="kpi-valor">${formatarReais(saldoNoFimDe(proj, virada) ?? 0)}</p>
        <p class="kpi-detalhe">projetado para o fim de ${nomeMes(virada)}</p>
      </article>
      <article class="kpi ${estado.caixa.saldoEm ? tom(hojeSaldo) : ''}">
        <p class="kpi-rotulo">Saldo hoje</p>
        <p class="kpi-valor">${formatarReais(hojeSaldo)}</p>
        <p class="kpi-detalhe">${estado.caixa.saldoEm ? `informado em ${formatarData(estado.caixa.saldoEm)}` : 'não informado'}</p>
      </article>
      <article class="kpi ${menor ? tom(menor.saldoFinal) : ''}">
        <p class="kpi-rotulo">Menor saldo previsto</p>
        <p class="kpi-valor">${formatarReais(menor?.saldoFinal ?? 0)}</p>
        <p class="kpi-detalhe">${menor ? `fim de ${nomeMes(menor.mes)}` : ''}</p>
      </article>
      <article class="kpi ${proj.length ? tom(proj.at(-1).saldoFinal) : ''}">
        <p class="kpi-rotulo">Fim da projeção</p>
        <p class="kpi-valor">${formatarReais(proj.at(-1)?.saldoFinal ?? 0)}</p>
        <p class="kpi-detalhe">${nomeMes(estado.caixa.horizonte)}</p>
      </article>
    </section>

    <div class="grade grade-2">
      ${html.cru(cartaoCompetenciaCaixa(estado, hoje))}
      ${html.cru(cartaoProjecao(estado, proj, reserva))}
      ${html.cru(cartaoSimulador(estado, hoje, virada))}
      ${html.cru(cartaoContas(estado))}
      ${html.cru(cartaoDas(estado, hoje))}
    </div>`;
}

function foraDoHorizonte(estado, hoje) {
  const fora = recebimentos(estado, hoje).filter((r) => mesDe(r.data) > estado.caixa.horizonte);
  if (!fora.length) return '';
  return html`<div class="faixa faixa-info">${html.cru(icone('info'))}
    <div><strong>${fora.length === 1 ? '1 recebimento fica' : `${fora.length} recebimentos ficam`} depois de ${nomeMes(estado.caixa.horizonte)}</strong>
    O último item da OC é pago em ${nomeMes(mesDe(fora.at(-1).data))}. Aumente “Projetar até” em Contas e parâmetros para vê-lo no saldo.</div></div>`;
}

function legenda(itens) {
  return `<div class="legenda">${itens.map(([cor, nome, extra = '']) =>
    `<span><i style="background:var(${cor})${extra}"></i>${nome}</span>`).join('')}</div>`;
}

function cartaoCompetenciaCaixa(estado, hoje) {
  const linhas = competenciaVsCaixa(estado, hoje);
  if (!linhas.length) {
    return html`<section class="cartao"><h2>Competência × caixa</h2>
      <p class="vazio">Configure o contrato em Ajustes para ver quando o dinheiro entra.</p></section>`;
  }
  const grafico = barrasAgrupadas({
    linhas,
    titulo: 'Competência e caixa por mês',
    series: [
      { nome: 'Item da OC (competência)', chave: 'competencia', cor: '--serie-1', previsto: (l) => l.competenciaPrevista },
      { nome: 'Recebido (caixa)', chave: 'caixa', cor: '--serie-2', previsto: (l) => l.caixaPrevisto },
    ],
  });
  return html`
    <section class="cartao" aria-labelledby="t-cc">
      <h2 id="t-cc">Competência × caixa</h2>
      ${html.cru(legenda([['--serie-1', 'Item do mês (valor fixo)'], ['--serie-2', 'Entra na conta no mês']]))}
      ${html.cru(grafico)}
      <p class="subtitulo">Barras mais apagadas são previstas. Cada item vale o valor fixo da OC e entra cerca de 30 dias depois da nota.</p>
      ${html.cru(tabelaRecebimentos(estado, hoje))}
      <details class="secao" style="margin-top:10px"><summary>Ver tabela</summary>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th scope="col">Mês</th><th scope="col" class="dir">Item do mês</th><th scope="col" class="dir">Entra</th></tr></thead>
          <tbody>${html.cru(linhas.map((l) => html`<tr><td>${rotuloCompetencia(l.mes)}</td>
            <td class="dir num">${formatarReais(l.competencia)}${l.competenciaPrevista ? '*' : ''}</td>
            <td class="dir num">${formatarReais(l.caixa)}${l.caixaPrevisto ? '*' : ''}</td></tr>`))}</tbody>
        </table></div>
        <p class="subtitulo">* previsto</p>
      </details>
    </section>`;
}

/** Os recebimentos da OC, sempre com o intervalo (NF no início ou no fim da janela). */
function tabelaRecebimentos(estado, hoje) {
  const recs = recebimentos(estado, hoje);
  return html`
    <p class="rotulo" style="margin-top:12px">Recebimentos da OC</p>
    <div class="tabela-rolagem"><table class="tabela">
      <thead><tr><th scope="col">Item</th><th scope="col" class="dir">Valor</th><th scope="col" class="dir">Previsto</th><th scope="col" class="dir">Intervalo</th></tr></thead>
      <tbody>${html.cru(recs.map((r) => html`<tr class="${r.perdida ? 'linha-atrasada' : ''}">
        <th scope="row">Item ${r.item}${html.cru(r.perdida ? `<br><small class="valor-ruim">${icone('alerta', 'ic ic-p')}perdeu a janela</small>` : '')}</th>
        <td class="dir num">${formatarReais(r.valorCentavos)}</td>
        <td class="dir num">${formatarData(r.data)}${r.real ? ' ✓' : ''}</td>
        <td class="dir num">${r.real ? 'recebido' : r.maisCedo === r.maisTarde ? 'NF emitida' : `${formatarData(r.maisCedo).slice(0, 5)} a ${formatarData(r.maisTarde).slice(0, 5)}`}</td>
      </tr>`))}</tbody>
    </table></div>`;
}

function cartaoProjecao(estado, proj, reserva) {
  const grafico = linhaSaldo({
    titulo: 'Saldo projetado no fim de cada mês',
    limite: reserva,
    pontos: proj.map((p) => ({ mes: p.mes, valor: p.saldoFinal, alerta: p.abaixoDaReserva })),
  });
  return html`
    <section class="cartao" aria-labelledby="t-proj">
      <h2 id="t-proj">Saldo projetado</h2>
      ${html.cru(grafico)}
      <div class="tabela-rolagem"><table class="tabela">
        <thead><tr><th scope="col">Mês</th><th scope="col" class="dir">Entradas</th><th scope="col" class="dir">Saídas</th><th scope="col" class="dir">Saldo final</th></tr></thead>
        <tbody>${html.cru(proj.map((p) => html`<tr>
          <td>${rotuloCompetencia(p.mes)}</td>
          <td class="dir num">${formatarReais(p.entradas)}</td>
          <td class="dir num">${formatarReais(p.saidas)}</td>
          <td class="dir num ${p.abaixoDaReserva ? 'valor-alerta' : ''}">${html.cru(p.abaixoDaReserva ? `${icone('alerta', 'ic ic-p')}<span class="visualmente-oculto">abaixo da reserva: </span>` : '')}${formatarReais(p.saldoFinal)}</td>
        </tr>`))}</tbody>
      </table></div>
      <p class="subtitulo" style="margin-top:8px">Entram os recebimentos do contrato, o DAS, os gastos lançados, fixos e parcelados
        e o restante da estimativa mensal (${formatarReais(totalEstimativa(estado.estimativas))}/mês, <a href="#/gastos">editar em Gastos</a>).</p>
    </section>`;
}

// base de contagem escolhida no simulador (só nesta tela; não muda o contrato)
let baseSimulada = null;

function cartaoSimulador(estado, hoje, virada) {
  const { contrato } = estado;
  const base = baseSimulada && BASES_PRAZO[baseSimulada] ? baseSimulada : contrato.basePrazo;
  const g = gradeSimulador(estado, hoje, virada, { basePrazo: base });
  const dias = g.linhas[0]?.celulas.map((c) => c.dia) || [];
  const opcoes = Object.entries(BASES_PRAZO).map(([id, nome]) =>
    `<option value="${id}" ${id === base ? 'selected' : ''}>${nome}${id === contrato.basePrazo ? ' (atual)' : ''}</option>`).join('');
  return html`
    <section class="cartao" aria-labelledby="t-sim">
      <h2 id="t-sim">E se…?</h2>
      <p class="subtitulo">Saldo no fim de ${nomeMes(virada)} conforme o dia de emissão da NF na janela, o prazo de pagamento
        e a base de contagem (só para as notas ainda não emitidas).</p>
      <label class="campo" style="margin:8px 0"><span>Base de contagem do prazo</span>
        <select id="sim-base" data-ao-mudar="simBase">${html.cru(opcoes)}</select></label>
      <div class="tabela-rolagem"><table class="tabela tabela-sim">
        <thead><tr><th scope="col">Prazo</th>${html.cru(dias.map((d) => `<th scope="col" class="dir">NF no dia ${d}</th>`))}</tr></thead>
        <tbody>${html.cru(g.linhas.map((l) => html`<tr><th scope="row">${l.prazo} dias</th>${html.cru(l.celulas.map((c) => {
          const atual = l.prazo === contrato.prazoPagamentoDias && c.dia === contrato.diaEmissaoPrevisto && base === contrato.basePrazo;
          const dif = c.diferenca ?? 0;
          return html`<td class="dir num ${atual ? 'celula-atual' : ''}">${formatarReais(c.saldo ?? 0)}
            <small class="${dif > 0 ? 'dif-mais' : dif < 0 ? 'dif-menos' : 'dif-zero'}">${atual ? 'cenário atual' : formatarReais(dif, { sinal: true })}</small></td>`;
        }))}</tr>`))}</tbody>
      </table></div>
      <p class="subtitulo" style="margin-top:8px">Cenário atual: NF no dia ${contrato.diaEmissaoPrevisto}, ${contrato.prazoPagamentoDias} dias,
        contados ${BASES_PRAZO_FRASE[contrato.basePrazo] || ''}${contrato.basePrazoConfirmada ? '' : ' (a confirmar)'}.
        Dias por semana não mudam a receita: o valor de cada item é fixo.</p>
    </section>`;
}

function cartaoContas(estado) {
  const contas = estado.contas.map((c, i) => html`
    <div class="linha-conta">
      <label class="campo"><span class="visualmente-oculto">Nome da conta</span>
        <input type="text" id="conta-nome-${i}" value="${c.nome}" data-ao-mudar="contaNome" data-indice="${i}"></label>
      <label class="campo"><span class="visualmente-oculto">Saldo de ${c.nome}</span>
        <input type="text" inputmode="decimal" id="conta-saldo-${i}" value="${centavosParaCampo(c.saldoCentavos)}" data-ao-mudar="contaSaldo" data-indice="${i}"></label>
      <button type="button" class="btn btn-icone btn-fantasma" data-acao="removerConta" data-indice="${i}" aria-label="Remover ${c.nome}"
        ${html.cru(estado.contas.length === 1 ? 'disabled' : '')}>${html.cru(icone('lixo'))}</button>
    </div>`);
  return html`
    <section class="cartao" aria-labelledby="t-contas">
      <h2 id="t-contas">Contas e parâmetros</h2>
      <p class="rotulo">Saldo de hoje em cada conta</p>
      <div class="lista-contas">${html.cru(contas)}</div>
      <div class="linha-acoes"><button type="button" class="btn btn-pequeno" data-acao="adicionarConta">${html.cru(icone('mais'))} Conta</button></div>
      <div class="campos campos-3" style="margin-top:14px">
        <label class="campo"><span>Saldo informado em</span>
          <input type="date" id="saldo-em" value="${estado.caixa.saldoEm || ''}" data-ao-mudar="saldoEm">
          <small>Muda sozinho ao editar um saldo.</small></label>
        <label class="campo"><span>Reserva mínima (R$)</span>
          <input type="text" inputmode="decimal" id="reserva-minima" value="${centavosParaCampo(estado.caixa.reservaMinimaCentavos)}" data-ao-mudar="reserva"></label>
        <label class="campo"><span>Projetar até</span>
          <input type="month" id="horizonte" value="${estado.caixa.horizonte}" data-ao-mudar="horizonte"></label>
      </div>
    </section>`;
}

function cartaoDas(estado, hoje) {
  const lista = situacaoDas(estado, estado.caixa.horizonte);
  if (!lista.length) {
    return html`<section class="cartao" aria-labelledby="t-das"><h2 id="t-das">DAS do MEI</h2>
      <p class="vazio">Informe a data de abertura do MEI em Ajustes → Perfil.</p></section>`;
  }
  const opcoes = (atual) => ['', 'Pai', 'Mãe'].concat(atual && !['Pai', 'Mãe'].includes(atual) ? [atual] : [])
    .map((q) => `<option value="${q}" ${q === (atual || '') ? 'selected' : ''}>${q ? q.replace(/</g, '&lt;') : 'Eu'}</option>`)
    .join('') + '<option value="__outro">Outra pessoa…</option>';
  const linhas = lista.map((d) => {
    const comp = `${d.competencia.slice(5)}/${d.competencia.slice(0, 4)}`;
    const atrasado = !d.pagoEm && d.pagarAte < hoje;
    let situacao;
    if (d.pagoEm) {
      situacao = html`<span class="valor-bom">${html.cru(icone('check', 'ic ic-p'))}pago ${formatarData(d.pagoEm).slice(0, 5)}</span>
        <button type="button" class="btn btn-icone btn-fantasma btn-pequeno" data-acao="desfazerDasPago" data-competencia="${d.competencia}" aria-label="Desfazer pagamento do DAS ${comp}">${html.cru(icone('desfazer'))}</button>`;
    } else {
      const pedir = d.pagoPor && !d.pedidoEm
        ? html`<button type="button" class="btn btn-pequeno" data-acao="pedirDas" data-competencia="${d.competencia}">Já pedi</button>` : '';
      const pedido = d.pagoPor && d.pedidoEm ? html`<small class="subtitulo">pedido ${formatarData(d.pedidoEm).slice(0, 5)}</small>` : '';
      situacao = html`${html.cru(atrasado ? `<span class="valor-ruim">${icone('alerta', 'ic ic-p')}atrasado</span>` : '')}
        ${html.cru(pedido)}${html.cru(pedir)}
        <button type="button" class="btn btn-pequeno" data-acao="pagarDas" data-competencia="${d.competencia}">Paguei</button>`;
    }
    return html`<tr class="${atrasado ? 'linha-atrasada' : ''}">
      <th scope="row">${comp}</th>
      <td class="num">${formatarData(d.pagarAte).slice(0, 5)}${html.cru(d.pagarAte !== d.vencimento ? `<br><small class="subtitulo">vence ${formatarData(d.vencimento).slice(0, 5)}</small>` : '')}</td>
      <td class="dir num">${formatarReais(d.valorCentavos)}</td>
      <td><label class="visualmente-oculto" for="quem-${d.competencia}">Quem paga o DAS ${comp}</label>
        <select id="quem-${d.competencia}" class="select-pequeno" data-ao-mudar="quemPagaDas" data-competencia="${d.competencia}">${html.cru(opcoes(d.pagoPor))}</select></td>
      <td><div class="celula-acoes">${html.cru(situacao)}</div></td>
    </tr>`;
  });
  const deTerceiros = lista.filter((d) => d.pagoPor && !d.pagoEm);
  return html`
    <section class="cartao" aria-labelledby="t-das">
      <h2 id="t-das">DAS do MEI</h2>
      <p class="subtitulo">Pague até a data indicada (último dia útil até o dia 20). Se outra pessoa der o dinheiro,
        escolha quem em “Quem paga”: o DAS sai dos seus gastos e do seu saldo, mas o app lembra de pedir e de pagar.</p>
      ${html.cru(deTerceiros.length ? html`<p class="nota-das">${html.cru(icone('info', 'ic ic-p'))}
        ${deTerceiros.length === 1 ? '1 DAS pago' : `${deTerceiros.length} DAS pagos`} com dinheiro de outra pessoa
        (${formatarReais(deTerceiros.reduce((s, d) => s + d.valorCentavos, 0))}).</p>` : '')}
      <div class="tabela-rolagem"><table class="tabela tabela-das">
        <thead><tr><th scope="col">Mês</th><th scope="col">Pagar até</th><th scope="col" class="dir">Valor</th><th scope="col">Quem paga</th><th scope="col"><span class="visualmente-oculto">Situação</span></th></tr></thead>
        <tbody>${html.cru(linhas)}</tbody>
      </table></div>
      <p class="subtitulo" style="margin-top:8px">A guia oficial sai no app MEI ou no Portal do Empreendedor (PGMEI); confira lá o valor.</p>
    </section>`;
}

// ---------- ações ----------

function lerDinheiro(el, ctx) {
  const v = lerReais(el.value);
  if (v == null) {
    el.setAttribute('aria-invalid', 'true');
    ctx.avisar('Valor inválido. Use, por exemplo, 1.234,56.', true);
  }
  return v;
}

export const acoes = {
  simBase(el, ev, ctx) {
    baseSimulada = el.value;
    ctx.atualizar(() => {}, { renderizar: true });
  },
  pagarDas: (el, ev, ctx) => ctx.marcarDasPago(el.dataset.competencia),
  pedirDas: (el, ev, ctx) => ctx.marcarDasPedido(el.dataset.competencia),
  desfazerDasPago(el, ev, ctx) {
    const comp = el.dataset.competencia;
    ctx.atualizar((e) => { const p = { ...e.dasPagos }; delete p[comp]; e.dasPagos = p; }, { aviso: 'Pagamento desfeito.' });
  },
  quemPagaDas(el, ev, ctx) {
    const comp = el.dataset.competencia;
    let quem = el.value;
    if (quem === '__outro') {
      quem = (prompt('Quem vai dar o dinheiro deste DAS?') || '').trim();
      if (!quem) { el.value = ctx.estado.dasTerceiros[comp]?.quem || ''; return; }
    }
    ctx.atualizar((e) => {
      const t = { ...e.dasTerceiros };
      if (quem) t[comp] = { quem, pedidoEm: t[comp]?.pedidoEm || null }; else delete t[comp];
      e.dasTerceiros = t;
    }, { aviso: quem ? `DAS ${comp.slice(5)}/${comp.slice(0, 4)}: dinheiro do ${quem}. Saiu dos seus gastos; o lembrete de pedir fica no Painel.` : 'Agora este DAS é pago por você.' });
  },
  contaNome(el, ev, ctx) {
    const nome = el.value.trim() || 'Conta';
    ctx.atualizar((e) => { e.contas[Number(el.dataset.indice)].nome = nome; }, { aviso: 'Salvo.' });
  },
  contaSaldo(el, ev, ctx) {
    const v = lerDinheiro(el, ctx);
    if (v == null) return;
    ctx.atualizar((e) => {
      e.contas[Number(el.dataset.indice)].saldoCentavos = v;
      e.caixa.saldoEm = ctx.hoje;
    }, { aviso: `Saldo salvo (em ${formatarData(ctx.hoje)}).` });
  },
  adicionarConta(el, ev, ctx) {
    ctx.atualizar((e) => { e.contas.push({ id: `c${Date.now()}`, nome: 'Nova conta', saldoCentavos: 0 }); });
  },
  removerConta(el, ev, ctx) {
    const c = ctx.estado.contas[Number(el.dataset.indice)];
    if (!confirm(`Remover a conta “${c.nome}”?`)) return;
    ctx.atualizar((e) => { e.contas.splice(Number(el.dataset.indice), 1); }, { aviso: 'Conta removida.' });
  },
  saldoEm(el, ev, ctx) {
    if (el.value && !ehDataISO(el.value)) return;
    ctx.atualizar((e) => { e.caixa.saldoEm = el.value || null; }, { aviso: 'Salvo.' });
  },
  reserva(el, ev, ctx) {
    const v = lerDinheiro(el, ctx);
    if (v == null) return;
    ctx.atualizar((e) => { e.caixa.reservaMinimaCentavos = Math.max(0, v); }, { aviso: 'Salvo.' });
  },
  horizonte(el, ev, ctx) {
    if (!ehMesISO(el.value) || el.value < mesDe(ctx.hoje)) { ctx.avisar('Escolha um mês a partir do atual.', true); return; }
    ctx.atualizar((e) => { e.caixa.horizonte = el.value; }, { aviso: 'Salvo.' });
  },
  carregarExemplo: (el, ev, ctx) => ctx.carregarExemplo(),
  apagarExemplo: (el, ev, ctx) => ctx.apagarExemplo(),
};
