// Fluxo de caixa: contas, competência × caixa, projeção de saldo, simulador e gastos fixos.

import { formatarData, nomeMes, rotuloCompetencia, ehMesISO, ehDataISO, mesDe } from '../../utils/datas.js';
import { formatarReais, lerReais, centavosParaCampo } from '../../utils/dinheiro.js';
import {
  projecao, saldoAtual, competenciaVsCaixa, gradeSimulador, saldoNoFimDe,
} from '../../dominio/caixa.js';
import { totalEstimativa } from '../../dominio/gastos.js';
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
  const tom = (v) => (v < reserva ? 'kpi-ruim' : 'kpi-bom');

  return html`
    <div class="cabecalho-pagina"><div><h1>Fluxo de caixa</h1>
      <p class="subtitulo">Quando você trabalha (competência) × quando o dinheiro entra (caixa), e o saldo até ${nomeMes(estado.caixa.horizonte)}.</p></div></div>
    ${html.cru(estado.meta.exemplo ? faixaExemplo() : '')}
    ${html.cru(!estado.caixa.saldoEm ? html`<div class="faixa faixa-info">${html.cru(icone('info'))}
      <div><strong>Informe quanto você tem hoje</strong>Preencha o saldo das contas abaixo para a projeção partir do valor real. Por enquanto ela parte de R$ 0,00.</div></div>` : '')}
    ${html.cru(abaixo.length ? html`<div class="faixa faixa-alerta" role="alert">${html.cru(icone('alerta'))}
      <div><strong>Saldo abaixo da reserva mínima (${formatarReais(reserva)})</strong>
      Em ${abaixo.map((p) => nomeMes(p.mes, true)).join(', ')}. O motivo mais comum: o pagamento chega cerca de 2 meses depois do trabalho.</div></div>` : '')}

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
    </div>`;
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
      { nome: 'Trabalhado (competência)', chave: 'competencia', cor: '--serie-1', previsto: (l) => l.competenciaPrevista },
      { nome: 'Recebido (caixa)', chave: 'caixa', cor: '--serie-2', previsto: (l) => l.caixaPrevisto },
    ],
  });
  return html`
    <section class="cartao" aria-labelledby="t-cc">
      <h2 id="t-cc">Competência × caixa</h2>
      ${html.cru(legenda([['--serie-1', 'Trabalhado no mês'], ['--serie-2', 'Entra na conta no mês']]))}
      ${html.cru(grafico)}
      <p class="subtitulo">Barras mais apagadas são previstas. O dinheiro de um mês de trabalho entra cerca de 2 meses depois.</p>
      <details class="secao" style="margin-top:10px"><summary>Ver tabela</summary>
        <div class="tabela-rolagem"><table class="tabela">
          <thead><tr><th scope="col">Mês</th><th scope="col" class="dir">Trabalhado</th><th scope="col" class="dir">Entra</th></tr></thead>
          <tbody>${html.cru(linhas.map((l) => html`<tr><td>${rotuloCompetencia(l.mes)}</td>
            <td class="dir num">${formatarReais(l.competencia)}${l.competenciaPrevista ? '*' : ''}</td>
            <td class="dir num">${formatarReais(l.caixa)}${l.caixaPrevisto ? '*' : ''}</td></tr>`))}</tbody>
        </table></div>
        <p class="subtitulo">* previsto</p>
      </details>
    </section>`;
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

function cartaoSimulador(estado, hoje, virada) {
  const g = gradeSimulador(estado, hoje, virada);
  const dias = g.linhas[0]?.celulas.map((c) => c.dias) || [];
  const atualPrazo = estado.contrato.prazoPagamentoDias;
  const atualDias = estado.contrato.diasSemana.length;
  return html`
    <section class="cartao" aria-labelledby="t-sim">
      <h2 id="t-sim">E se…?</h2>
      <p class="subtitulo">Saldo no fim de ${nomeMes(virada)} conforme o prazo de pagamento e os dias por semana
        (só muda os dias futuros ainda não marcados).</p>
      <div class="tabela-rolagem"><table class="tabela tabela-sim">
        <thead><tr><th scope="col">Prazo</th>${html.cru(dias.map((d) => `<th scope="col" class="dir">${d} dias/sem.</th>`))}</tr></thead>
        <tbody>${html.cru(g.linhas.map((l) => html`<tr><th scope="row">${l.prazo} dias</th>${html.cru(l.celulas.map((c) => {
          const atual = l.prazo === atualPrazo && c.dias === atualDias;
          const dif = c.diferenca ?? 0;
          return html`<td class="dir num ${atual ? 'celula-atual' : ''}">${formatarReais(c.saldo ?? 0)}
            <small class="${dif > 0 ? 'dif-mais' : dif < 0 ? 'dif-menos' : 'dif-zero'}">${atual ? 'cenário atual' : formatarReais(dif, { sinal: true })}</small></td>`;
        }))}</tr>`))}</tbody>
      </table></div>
      <p class="subtitulo" style="margin-top:8px">Cenário atual: ${atualPrazo} dias de prazo, ${atualDias} dias por semana. A diferença é em relação a ele.</p>
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
