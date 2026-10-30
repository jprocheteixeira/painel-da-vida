// CNPJ: guardado já formatado ("00.000.000/0000-00"); aceita só os números (teclado numérico do celular).

/** Formata 14 dígitos como CNPJ; outro tamanho volta como foi digitado (sem espaços nas pontas). */
export function formatarCnpj(texto) {
  const digitos = String(texto ?? '').replace(/\D/g, '');
  if (digitos.length !== 14) return String(texto ?? '').trim();
  return digitos.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}
