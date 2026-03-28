export function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

export function parseCOP(text: string): number {
  return Math.round(Number(text.replace(/[^0-9]/g, '')) || 0);
}
