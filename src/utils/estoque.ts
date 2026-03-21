// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface StockItem {
  id: string;
  name: string;
  values: (number | string)[];  // [v1, v2, v3] para as 3 datas
  dec: number | string;         // ajuste positivo ou negativo
  total: number;                // sum(values) + dec
}

export interface BarItem {
  id: string;
  name: string;
  quantity: number | string;
}

export type StoreId = '248' | '26';

// ── Constantes ─────────────────────────────────────────────────────────────────

export const INITIAL_ITEMS: StockItem[] = [
  { id: 'dln',  name: 'DLN',  values: [0, 0, 0], dec: 0, total: 0 },
  { id: 'car',  name: 'Car',  values: [0, 0, 0], dec: 0, total: 0 },
  { id: 'mar',  name: 'Mar',  values: [0, 0, 0], dec: 0, total: 0 },
  { id: 'caju', name: 'Caju', values: [0, 0, 0], dec: 0, total: 0 },
  { id: 'sr',   name: 'SR',   values: [0, 0, 0], dec: 0, total: 0 },
  { id: 'lar',  name: 'Lar',  values: [0, 0, 0], dec: 0, total: 0 },
  { id: 'mes',  name: 'Mês',  values: [0, 0, 0], dec: 0, total: 0 },
];

export const INITIAL_BARS: BarItem[] = [
  { id: 'bar-amendoim', name: 'Bar. Amendoim', quantity: 0 },
  { id: 'bar-fudge',    name: 'Bar. Fudge',    quantity: 0 },
  { id: 'bar-especial', name: 'Bar. Especial',  quantity: 0 },
];

// Mapeamento de id de estoque → FlavorId do Planejamento
export const STOCK_TO_FLAVOR_MAP: Record<string, string> = {
  dln:  'Dln',
  car:  'Car',
  mar:  'Mar',
  caju: 'Caju',
  sr:   'SR',
  lar:  'Lar',
  mes:  'Mes',
};

// ── Funções utilitárias ────────────────────────────────────────────────────────

export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const formatDateDisplay = (isoDate: string): string => {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
};

export const getPreviousBusinessDay = (dateStr: string): string => {
  const parts = dateStr.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() - 1);
  if (date.getDay() === 0) { // Domingo
    date.setDate(date.getDate() - 1);
  }
  return formatDateForInput(date);
};

export const getInitialHeaders = (): string[] => {
  const today = new Date();
  const d3 = new Date(today);
  const d3Str = formatDateForInput(d3);
  const d2Str = getPreviousBusinessDay(d3Str);
  const d1Str = getPreviousBusinessDay(d2Str);
  return [d1Str, d2Str, d3Str];
};

export const calculateTotals = (items: StockItem[]): StockItem[] => {
  return items.map((item) => {
    const sum = item.values.reduce<number>((acc, v) => acc + (Number(v) || 0), 0);
    const dec = Number(item.dec) || 0;
    return { ...item, total: sum + dec };
  });
};

export const calculateGrandTotal = (items: StockItem[]): number => {
  return items.reduce((acc, item) => acc + item.total, 0);
};

export const generateReportText = (
  storeId: StoreId,
  headers: string[],
  items: StockItem[],
  bars: BarItem[],
): string => {
  const storeName = storeId === '248' ? 'Loja 248' : 'Loja 26';
  const grandTotal = calculateGrandTotal(items);
  let report = `*Relatório de Estoque - ${storeName}*\n`;
  report += `----------------------\n\n`;

  const formattedHeaders = headers.map(h => formatDateDisplay(h));
  const headerLine = `Produto | ${formattedHeaders.join(' | ')} | Dec | Total\n`;
  report += headerLine;
  report += `${'-'.repeat(headerLine.length)}\n`;

  items.forEach(item => {
    const values = item.values.map(v => String(v || '0').padEnd(5)).join(' | ');
    const dec = String(item.dec || '0').padEnd(3);
    const total = String(item.total).padEnd(5);
    const name = item.name.padEnd(7);
    report += `${name} | ${values} | ${dec} | ${total}\n`;
  });

  report += `${'-'.repeat(headerLine.length)}\n`;
  report += `*Total Geral: ${grandTotal}*\n\n`;

  if (bars && bars.length > 0) {
    report += `*Estoque de Barrinhas*\n`;
    report += `--------------------\n`;
    bars.forEach(bar => {
      report += `${bar.name.padEnd(20)}: ${bar.quantity || 0}\n`;
    });
  }

  return report;
};
