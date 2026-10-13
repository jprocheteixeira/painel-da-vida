// Ajustes: perfil, contrato, feriados e dados (backup, exemplo, apagar).

import { formatarData, ehDataISO, nomeSemana } from '../../utils/datas.js';
import { formatarReais, lerReais, centavosParaCampo } from '../../utils/dinheiro.js';
import { estimativaContrato } from '../../dominio/contrato.js';
import { TIPOS_FERIADO } from '../../dominio/feriados.js';
import { html, icone } from '../util.js';
import { faixaExemplo } from './pj.js';

const DIAS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [0, 'Dom']];

export function titulo() {
  return 'Ajustes';
}

export function render(ctx) {
  const { estado } = ctx;
  return html`
    <div class="cabecalho-pagina"><div><h1>Ajustes</h1>
      <p class="subtitulo">Tudo é salvo automaticamente neste aparelho.</p></div></div>
    ${html.cru(estado.meta.exemplo ? faixaExemplo() : '')}
    <div class="grade grade-2">
      <div class="grade">
        ${html.cru(cartaoContrato(estado))}
        ${html.cru(cartaoPerfil(estado))}
      </div>
      <div class="grade">
        ${html.cru(cartaoDados(estado))}
        ${html.cru(cartaoFeriados(estado))}
      </div>
    </div>`;
}

function campoTexto(rotulo, id, valor, atributos = '', ajuda = '') {
  return html`<label class="campo"><span>${rotulo}</span>
    <input id="${id}" value="${valor ?? ''}" ${html.cru(atributos)}>${html.cru(ajuda ? `<small>${ajuda}</small>` : '')}</label>`;
}

function cartaoPerfil(estado) {
  const p = estado.perfil;
  return html`
    <section class="cartao" aria-labelledby="t-perfil">
      <h2 id="t-perfil">Perfil</h2>
      <div class="campos">
        ${html.cru(campoTexto('Nome', 'perfil-nome', p.nome, 'type="text" autocomplete="name" data-ao-mudar="campo" data-alvo="perfil.nome"'))}
        <div class="campos campos-2">
          ${html.cru(campoTexto('CNPJ (MEI)', 'perfil-cnpj', p.cnpj, 'type="text" inputmode="numeric" data-ao-mudar="campo" data-alvo="perfil.cnpj"'))}
          ${html.cru(campoTexto('Abertura do MEI', 'perfil-abertura', p.aberturaMei, 'type="date" data-ao-mudar="campo" data-alvo="perfil.aberturaMei" data-tipo="data"'))}
        </div>
      </div>
    </section>`;
}

function cartaoContrato(estado) {
  const c = estado.contrato;
  const est = estimativaContrato(c, estado.feriados);
  const chips = DIAS.map(([n, nome]) => html`<label class="chip-check">
    <input type="checkbox" value="${n}" ${html.cru(c.diasSemana.includes(n) ? 'checked' : '')} data-ao-mudar="diaSemana" aria-label="${nome}">
    <span aria-hidden="true">${nome}</span></label>`);
  return html`
    <section class="cartao" aria-labelledby="t-contrato">
      <h2 id="t-contrato">Contrato PJ</h2>
      <div class="campos">
        <div class="campos campos-2">
          ${html.cru(campoTexto('Valor por dia (R$)', 'c-valor', centavosParaCampo(c.valorDiaCentavos), 'type="text" inputmode="decimal" data-ao-mudar="campo" data-alvo="contrato.valorDiaCentavos" data-tipo="dinheiro"'))}
          ${html.cru(campoTexto('Teto de dias por semana', 'c-teto', c.tetoSemanal, 'type="number" min="1" max="7" data-ao-mudar="campo" data-alvo="contrato.tetoSemanal" data-tipo="inteiro"'))}
        </div>
        <fieldset class="campo" style="border:0;padding:0;margin:0">
          <legend class="rotulo" style="margin-bottom:6px">Dias da semana sugeridos</legend>
          <div class="dias-semana">${html.cru(chips)}</div>
        </fieldset>
        <div class="campos campos-2">
          ${html.cru(campoTexto('Início', 'c-inicio', c.inicio, 'type="date" data-ao-mudar="campo" data-alvo="contrato.inicio" data-tipo="data"'))}
          ${html.cru(campoTexto('Fim', 'c-fim', c.fim, 'type="date" data-ao-mudar="campo" data-alvo="contrato.fim" data-tipo="data"'))}
        </div>
        <div class="campos campos-3">
          ${html.cru(campoTexto('Prazo de pagamento (dias)', 'c-prazo', c.prazoPagamentoDias, 'type="number" min="0" max="180" data-ao-mudar="campo" data-alvo="contrato.prazoPagamentoDias" data-tipo="inteiro"', 'Corridos, a partir da emissão da NF.'))}
          ${html.cru(campoTexto('Dia de corte', 'c-corte', c.diaCorte, 'type="number" min="0" max="31" data-ao-mudar="campo" data-alvo="contrato.diaCorte" data-tipo="inteiro"', '0 = mês inteiro.'))}
          ${html.cru(campoTexto('Aviso de rescisão (dias)', 'c-aviso', c.avisoRescisaoDias, 'type="number" min="0" max="365" data-ao-mudar="campo" data-alvo="contrato.avisoRescisaoDias" data-tipo="inteiro"'))}
        </div>
        <label class="campo"><span>Descrição do serviço (início do texto da NFS-e)</span>
          <textarea id="c-descricao" data-ao-mudar="campo" data-alvo="contrato.descricaoServico">${c.descricaoServico}</textarea></label>
      </div>
      ${html.cru(est ? html`<p class="destaque-espera">Estimativa pelos dias sugeridos, já sem feriados:
        <strong class="num">${est.dias} dias = ${formatarReais(est.centavos)}</strong>.</p>` : '')}
    </section>`;
}

function cartaoFeriados(estado) {
  const porAno = {};
  estado.feriados.forEach((f, i) => { (porAno[f.data.slice(0, 4)] ||= []).push([f, i]); });
  const blocos = Object.keys(porAno).sort().map((ano) => html`
    <h3 style="margin:10px 0 4px">${ano}</h3>
    <ul class="lista-feriados">${html.cru(porAno[ano].map(([f, i]) => html`
      <li class="${f.ativo ? '' : 'inativo'}">
        <span class="f-data">${formatarData(f.data).slice(0, 5)} <small class="f-tipo">${nomeSemana(f.data, true)}</small></span>
        <span class="f-nome">${f.nome}<br><small class="f-tipo">${TIPOS_FERIADO[f.tipo] || f.tipo}</small></span>
        <label class="interruptor"><input type="checkbox" ${html.cru(f.ativo ? 'checked' : '')} data-ao-mudar="ativarFeriado" data-indice="${i}"
          aria-label="Considerar ${f.nome} (${formatarData(f.data)})">Vale</label>
        <button type="button" class="btn btn-icone btn-fantasma btn-pequeno" data-acao="removerFeriado" data-indice="${i}"
          aria-label="Remover ${f.nome} (${formatarData(f.data)})">${html.cru(icone('lixo'))}</button>
      </li>`))}</ul>`);
  return html`
    <section class="cartao" aria-labelledby="t-feriados">
      <details class="secao">
        <summary><h2 id="t-feriados">Feriados <span class="subtitulo">(${estado.feriados.filter((f) => f.ativo).length} valendo)</span></h2></summary>
        <p class="subtitulo">Feriado que “vale” não é sugerido como dia de trabalho e não conta como dia útil nos prazos.
          Carnaval e Corpus Christi vêm desligados (ponto facultativo).</p>
        <form class="avancar-linha" style="margin-top:10px" data-ao-enviar="adicionarFeriado">
          <label class="campo" style="flex:0 1 160px"><span>Data</span><input type="date" name="data" required></label>
          <label class="campo"><span>Nome</span><input type="text" name="nome" required placeholder="Ex.: folga combinada"></label>
          <button class="btn" type="submit">${html.cru(icone('mais'))} Adicionar</button>
        </form>
        ${html.cru(blocos)}
      </details>
    </section>`;
}

function cartaoDados(estado) {
  return html`
    <section class="cartao" aria-labelledby="t-dados">
      <h2 id="t-dados">Dados e backup</h2>
      <p class="subtitulo">Nada sai deste navegador. Para usar no celular ou em outro PC, baixe o backup aqui e importe lá.
        ${estado.meta.ultimoBackup ? `Último backup: ${formatarData(estado.meta.ultimoBackup)}.` : 'Nenhum backup feito ainda.'}</p>
      <div class="linha-acoes">
        <button type="button" class="btn btn-primario" data-acao="exportar">Baixar backup (.json)</button>
        <label class="btn">Importar backup<input type="file" accept="application/json,.json" class="visualmente-oculto" data-ao-mudar="importar"></label>
      </div>
      <div class="linha-acoes">
        ${html.cru(estado.meta.exemplo
          ? '<button type="button" class="btn" data-acao="apagarExemplo">Apagar dados de exemplo</button>'
          : '<button type="button" class="btn" data-acao="carregarExemplo">Carregar dados de exemplo</button>')}
        <button type="button" class="btn btn-perigo" data-acao="apagarTudo">Apagar todos os dados</button>
      </div>
    </section>`;
}

// ---------- ações ----------

function definir(objeto, caminho, valor) {
  const partes = caminho.split('.');
  const ultima = partes.pop();
  partes.reduce((o, p) => o[p], objeto)[ultima] = valor;
}

function converter(el) {
  const v = el.value.trim();
  switch (el.dataset.tipo) {
    case 'dinheiro': {
      const c = lerReais(v);
      if (c == null || c < 0) throw new Error('Valor inválido. Use, por exemplo, 200,00.');
      return c;
    }
    case 'inteiro': {
      const n = Number(v);
      if (!Number.isInteger(n) || n < Number(el.min || 0) || (el.max && n > Number(el.max))) {
        throw new Error(`Use um número inteiro entre ${el.min || 0} e ${el.max}.`);
      }
      return n;
    }
    case 'data':
      if (v && !ehDataISO(v)) throw new Error('Data inválida.');
      return v || null;
    default:
      return v;
  }
}

export const acoes = {
  campo(el, ev, ctx) {
    let valor;
    try {
      valor = converter(el);
    } catch (erro) {
      el.setAttribute('aria-invalid', 'true');
      ctx.avisar(erro.message, true);
      return;
    }
    const { inicio, fim } = { ...ctx.estado.contrato, [el.dataset.alvo.split('.')[1]]: valor };
    if (el.dataset.alvo.startsWith('contrato.') && inicio && fim && fim < inicio) {
      ctx.avisar('O fim do contrato não pode ser antes do início.', true);
      return;
    }
    ctx.atualizar((e) => definir(e, el.dataset.alvo, valor), { aviso: 'Salvo.' });
  },

  diaSemana(el, ev, ctx) {
    const n = Number(el.value);
    ctx.atualizar((e) => {
      const s = new Set(e.contrato.diasSemana);
      if (el.checked) s.add(n); else s.delete(n);
      e.contrato.diasSemana = [...s].sort();
    }, { aviso: 'Salvo.' });
  },

  ativarFeriado(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    ctx.atualizar((e) => { e.feriados[i].ativo = el.checked; });
  },

  removerFeriado(el, ev, ctx) {
    const i = Number(el.dataset.indice);
    const f = ctx.estado.feriados[i];
    if (!confirm(`Remover “${f.nome}” (${formatarData(f.data)})?`)) return;
    ctx.atualizar((e) => { e.feriados.splice(i, 1); }, { aviso: 'Feriado removido.' });
  },

  adicionarFeriado(form, ev, ctx) {
    const data = form.elements.data.value;
    const nome = form.elements.nome.value.trim();
    if (!ehDataISO(data) || !nome) { ctx.avisar('Preencha a data e o nome.', true); return; }
    ctx.atualizar((e) => {
      e.feriados.push({ data, nome, tipo: 'pessoal', ativo: true });
      e.feriados.sort((a, b) => a.data.localeCompare(b.data));
    }, { aviso: 'Feriado adicionado.' });
  },

  importar(el, ev, ctx) {
    const arquivo = el.files?.[0];
    if (!arquivo) return;
    if (!confirm('Importar este backup substitui todos os dados deste aparelho. Continuar?')) { el.value = ''; return; }
    ctx.importarArquivo(arquivo);
  },

  apagarTudo(el, ev, ctx) {
    if (!confirm('Apagar TODOS os dados deste aparelho? Faça um backup antes, se quiser guardar.')) return;
    ctx.apagarTudo();
  },

  carregarExemplo: (el, ev, ctx) => ctx.carregarExemplo(),
  apagarExemplo: (el, ev, ctx) => ctx.apagarExemplo(),
};
