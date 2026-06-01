export function formatCurrency(amount: number, country: string = 'CO', decimalPlaces?: number): string {
  const decimals = decimalPlaces ?? (country === 'US' ? 2 : 0);
  const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
  if (country === 'US') {
    return `$${amount.toLocaleString('en-US', options)} USD`;
  }
  return `$${amount.toLocaleString('es-CO', options)} COP`;
}

export function parseCurrency(text: string, country: string = 'CO'): number {
  if (country === 'US') {
    return Number(text.replace(/[^0-9.]/g, '')) || 0;
  }
  const stripped = text.replace(/[^0-9.,]/g, '');
  return Number(stripped.replace(/\./g, '').replace(',', '.')) || 0;
}
