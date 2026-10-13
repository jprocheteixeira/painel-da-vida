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
  estado.recorrencias = [
    { id: 'r1', descricao: 'Aluguel (exemplo)', valorCentavos: 65000, dia: 10, inicio: hoje, fim: null, categoria: null },
    { id: 'r2', descricao: 'Celular (exemplo)', valorCentavos: 4990, dia: 15, inicio: hoje, fim: null, categoria: null },
  ];
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
