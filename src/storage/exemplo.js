// DADOS DE EXEMPLO, só para demonstração: pessoa, empresa e números fictícios.
// O estado fica marcado com meta.exemplo = true e some pelo botão "Apagar dados de exemplo".

import { intervaloDias, somarDias, mesDe, somarMeses, primeiroDiaDoMes } from '../utils/datas.js';
import { ehDiaSugerido, DIA } from '../dominio/contrato.js';
import { estadoInicial } from './migracoes.js';

export function estadoDeExemplo(hoje) {
  const estado = estadoInicial();
  const inicio = primeiroDiaDoMes(somarMeses(mesDe(hoje), -1));
  estado.meta.exemplo = true;
  estado.perfil = { nome: 'Pessoa Exemplo', cnpj: '00.000.000/0001-00', aberturaMei: inicio };
  Object.assign(estado.contrato, {
    inicio,
    fim: somarDias(primeiroDiaDoMes(somarMeses(mesDe(hoje), 5)), -1),
    tomador: 'Empresa Exemplo S.A. (fictícia)',
    emailEnvio: 'financeiro@exemplo.invalid',
    pedidoCompra: '',
  });
  // marca como trabalhados os dias sugeridos até ontem, com uma folga no meio
  const ontem = somarDias(hoje, -1);
  const sugeridos = intervaloDias(inicio, ontem).filter((d) => ehDiaSugerido(d, estado.contrato, estado.feriados));
  sugeridos.forEach((d, i) => { estado.marcas[d] = i === 4 ? DIA.FOLGA : DIA.TRABALHADO; });
  estado.contas[0].saldoCentavos = 42000;
  estado.contas[1].saldoCentavos = 185050;
  estado.caixa.saldoEm = hoje;
  const mesAtual = mesDe(hoje);
  const mesPassado = somarMeses(mesAtual, -1);
  estado.recorrencias = [
    { id: 'r1', descricao: 'Aluguel (exemplo)', valorCentavos: 65000, dia: 10, inicio: `${mesPassado}-01`, fim: null, categoriaId: 'contas' },
    { id: 'r2', descricao: 'Celular (exemplo)', valorCentavos: 4990, dia: 15, inicio: `${mesPassado}-01`, fim: null, categoriaId: 'contas' },
  ];
  const valores = { 'e-aluguel': 65000, 'e-celular': 4990, 'e-mercado': 60000, 'e-gasolina': 35000, 'e-lazer': 25000 };
  estado.estimativas = estado.estimativas
    .filter((e) => e.id !== 'e-carro')
    .map((e) => ({ ...e, valorCentavos: valores[e.id] ?? null }));
  const gasto = (dia, mes, valor, categoriaId, nota) => ({ id: `ex-${mes}-${dia}-${valor}`, data: `${mes}-${dia}`, valorCentavos: valor, categoriaId, nota });
  estado.lancamentos = [
    gasto('03', mesPassado, 21890, 'mercado', 'Mercado do mês'), gasto('12', mesPassado, 15000, 'transporte', 'Gasolina'),
    gasto('18', mesPassado, 8700, 'lazer', 'Pizza'), gasto('25', mesPassado, 12340, 'mercado', ''),
    gasto('02', mesAtual, 24310, 'mercado', 'Mercado do mês'), gasto('05', mesAtual, 16000, 'transporte', 'Gasolina'),
    gasto('08', mesAtual, 4590, 'saude', 'Farmácia'), gasto('10', mesAtual, 13500, 'lazer', 'Cinema e lanche'),
  ].filter((g) => g.data <= hoje);
  estado.parcelamentos = [
    { id: 'p1', descricao: 'Fone (exemplo)', valorParcelaCentavos: 8990, parcelas: 5, primeiraData: `${mesPassado}-20`, categoriaId: 'hobby' },
  ];
  estado.categorias.find((c) => c.id === 'mercado').orcamentoCentavos = 60000;
  estado.categorias.find((c) => c.id === 'lazer').orcamentoCentavos = 15000;
  const mesAnterior = mesDe(inicio);
  estado.medicoes[mesAnterior] = {
    mes: mesAnterior,
    estado: 'boletim_enviado',
    historico: { boletim_enviado: somarDias(primeiroDiaDoMes(mesDe(hoje)), -1) },
    resumo: 'Organização da base de cadastros e conferência de controles (exemplo).',
    numeroNF: '',
  };
  return estado;
}
