// Ponto de entrada: carrega os dados, cuida das rotas, dos eventos e do salvamento.

import { carregar, salvar, lerTema, salvarTema } from '../storage/repositorio.js';
import { gerarBackup, lerBackup, nomeArquivoBackup } from '../storage/backup.js';
import { estadoInicial } from '../storage/migracoes.js';
import { estadoDeExemplo } from '../storage/exemplo.js';
import { hojeISO } from '../utils/datas.js';
import { baixarArquivo } from './util.js';
import * as painel from './views/painel.js';
import * as pj from './views/pj.js';
import * as caixa from './views/caixa.js';
import * as gastos from './views/gastos.js';
import * as ajustes from './views/ajustes.js';

const VIEWS = { painel, pj, caixa, gastos, ajustes };
const main = document.getElementById('conteudo');
const toast = document.getElementById('aviso');

const inicial = carregar();
let estado = inicial.estado;

function lerRota() {
  const [nome = '', ...params] = location.hash.replace(/^#\/?/, '').split('/');
  return { nome: VIEWS[nome] ? nome : 'painel', params };
}

const ctx = {
  get estado() { return estado; },
  get hoje() { return hojeISO(); },
  rota: lerRota(),

  /** Altera os dados: `fn` recebe uma cópia e pode mutá-la ou devolver outra. */
  atualizar(fn, { aviso, renderizar = true } = {}) {
    const copia = structuredClone(estado);
    const novo = fn(copia) || copia;
    estado = novo;
    if (!salvar(estado)) avisar('Não foi possível salvar neste navegador.', true);
    else if (aviso) avisar(aviso);
    if (renderizar) render();
  },

  substituirEstado(novo, aviso) {
    estado = novo;
    salvar(estado);
    render();
    if (aviso) avisar(aviso);
  },

  avisar,
  ir(hash) { location.hash = hash; },
  exportar,
};

let temporizadorAviso;
function avisar(texto, erro = false) {
  toast.textContent = texto;
  toast.classList.toggle('erro', erro);
  toast.classList.add('visivel');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => toast.classList.remove('visivel'), erro ? 5000 : 2600);
}

function exportar() {
  const agora = new Date().toISOString();
  baixarArquivo(nomeArquivoBackup(ctx.hoje), JSON.stringify(gerarBackup(estado, agora), null, 2));
  ctx.atualizar((e) => { e.meta.ultimoBackup = ctx.hoje; }, { aviso: 'Backup baixado.' });
}

export async function importarArquivo(arquivo) {
  try {
    const novo = lerBackup(await arquivo.text());
    ctx.substituirEstado(novo, 'Backup importado.');
  } catch (erro) {
    avisar(erro.message, true);
  }
}
ctx.importarArquivo = importarArquivo;

ctx.carregarExemplo = () => {
  const temDados = Boolean(estado.contrato.inicio) || Object.keys(estado.marcas).length > 0;
  if (temDados && !estado.meta.exemplo
    && !confirm('Os dados de exemplo substituem os seus dados atuais. Continuar?')) return;
  ctx.substituirEstado(estadoDeExemplo(ctx.hoje), 'Dados de exemplo carregados.');
};
ctx.apagarExemplo = () => ctx.substituirEstado(estadoInicial(), 'Dados de exemplo apagados.');
ctx.apagarTudo = () => ctx.substituirEstado(estadoInicial(), 'Todos os dados foram apagados.');

// ---------- tema ----------

const TEMAS = ['auto', 'claro', 'escuro'];
const NOME_TEMA = { auto: 'automático', claro: 'claro', escuro: 'escuro' };
function aplicarTema(tema) {
  if (tema === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = tema;
  document.getElementById('botao-tema')?.setAttribute('aria-label', `Tema: ${NOME_TEMA[tema]}. Trocar tema`);
}
aplicarTema(lerTema());

// ---------- renderização ----------

function render() {
  ctx.rota = lerRota();
  const view = VIEWS[ctx.rota.nome];
  const foco = document.activeElement?.id;
  const rolagem = window.scrollY;
  main.innerHTML = view.render(ctx);
  document.title = `${view.titulo(ctx)} · Painel da Vida`;
  for (const a of document.querySelectorAll('.abas a')) {
    if (a.dataset.rota === ctx.rota.nome) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  view.aoMontar?.(main, ctx);
  if (foco) document.getElementById(foco)?.focus({ preventScroll: true });
  window.scrollTo(0, rolagem);
}

function acaoDe(el, atributo) {
  const view = VIEWS[ctx.rota.nome];
  const nome = el.dataset[atributo];
  return view.acoes?.[nome];
}

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (!el) return;
  const nome = el.dataset.acao;
  if (nome === 'exportar') { exportar(); return; }
  if (nome === 'tema') {
    const atual = lerTema();
    const prox = TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length];
    salvarTema(prox);
    aplicarTema(prox);
    avisar(`Tema ${NOME_TEMA[prox]}`);
    return;
  }
  const fn = acaoDe(el, 'acao');
  if (fn) { ev.preventDefault(); fn(el, ev, ctx); }
});

document.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-ao-mudar]');
  const fn = el && acaoDe(el, 'aoMudar');
  if (fn) fn(el, ev, ctx);
});

document.addEventListener('input', (ev) => {
  const el = ev.target.closest('[data-ao-digitar]');
  const fn = el && acaoDe(el, 'aoDigitar');
  if (fn) fn(el, ev, ctx);
});

document.addEventListener('submit', (ev) => {
  const el = ev.target.closest('form[data-ao-enviar]');
  if (!el) return;
  ev.preventDefault();
  const fn = acaoDe(el, 'aoEnviar');
  if (fn) fn(el, ev, ctx);
});

window.addEventListener('hashchange', () => {
  const antes = ctx.rota.nome;
  render();
  if (lerRota().nome !== antes) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
});

// atualiza "hoje" se o app ficar aberto de um dia para o outro
let diaRenderizado = ctx.hoje;
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && ctx.hoje !== diaRenderizado) {
    diaRenderizado = ctx.hoje;
    render();
  }
});

// ---------- dicas dos gráficos (mouse e toque) ----------

const dica = document.createElement('div');
dica.className = 'dica';
dica.setAttribute('role', 'tooltip');
document.body.append(dica);
function mostrarDica(alvo, x, y) {
  dica.textContent = alvo.dataset.dica;
  dica.classList.add('visivel');
  const r = dica.getBoundingClientRect();
  const left = Math.min(Math.max(8, x - r.width / 2), window.innerWidth - r.width - 8);
  dica.style.left = `${left}px`;
  dica.style.top = `${Math.max(8, y - r.height - 12)}px`;
}
document.addEventListener('pointermove', (ev) => {
  const alvo = ev.target.closest?.('[data-dica]');
  if (alvo) mostrarDica(alvo, ev.clientX, ev.clientY);
  else dica.classList.remove('visivel');
});
document.addEventListener('scroll', () => dica.classList.remove('visivel'), { passive: true });

// atalho: tecla N abre o lançamento de gasto (fora de campos de texto)
document.addEventListener('keydown', (ev) => {
  if (ev.key.toLowerCase() !== 'n' || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  ev.preventDefault();
  if (ctx.rota.nome !== 'gastos') location.hash = '#/gastos';
  setTimeout(() => {
    const campo = document.getElementById('gasto-valor');
    campo?.scrollIntoView({ block: 'center' });
    campo?.focus();
  }, 0);
});

// os gráficos mudam de largura lógica no celular: redesenha ao cruzar o limite
let telaEstreita = window.innerWidth < 600;
window.addEventListener('resize', () => {
  if ((window.innerWidth < 600) !== telaEstreita) { telaEstreita = !telaEstreita; render(); }
});

window.__painelIniciado = true;
render();
if (inicial.aviso) avisar(inicial.aviso, true);
