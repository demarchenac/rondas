export function formatCurrency(amount: number, country: string = 'CO'): string {
  if (country === 'US') {
    return `$${amount.toLocaleString('en-US')} USD`;
  }
  return `$${amount.toLocaleString('es-CO')} COP`;
}

/** @deprecated Use formatCurrency instead */
export function formatCOP(amount: number): string {
  return formatCurrency(amount, 'CO');
}

export function parseCurrency(text: string): number {
  return Math.round(Number(text.replace(/[^0-9]/g, '')) || 0);
}

/** @deprecated Use parseCurrency instead */
export function parseCOP(text: string): number {
  return parseCurrency(text);
}
