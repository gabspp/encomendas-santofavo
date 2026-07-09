import type { StockItem } from "./estoque";
import { STOCK_TO_FLAVOR_MAP } from "./estoque";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type FlavorId = "Dln" | "Car" | "Mar" | "Caju" | "SR" | "DLSem" | "Lar" | "Mes";

export interface FlavorData {
  sobra: number;
  encomenda: number;
  metaLoja: number;
  sugerido: number;
  ajuste: number;
}

export interface OrderDetail {
  clientName: string;
  flavors: Record<string, number>;
  observation?: string;
}

// Delta por sabor causado pela transferência 26→248 num dia
// (negativo na linha da loja 26, positivo na linha da 248)
export type TransferenciaAjuste = Partial<Record<FlavorId, number>>;

// ─── Constantes de sabores ────────────────────────────────────────────────────

export const SABORES: { id: FlavorId; nome: string; emoji: string; prop: number }[] = [
  { id: "DLSem", nome: "Doce de Leite sem Nozes", emoji: "🟫", prop: 0    },
  { id: "Dln",   nome: "Doce de Leite com Nozes", emoji: "🟫", prop: 0.23 },
  { id: "Car",   nome: "Caramelo Salgado",         emoji: "🟥", prop: 0.30 },
  { id: "Mar",   nome: "Maracujá",                 emoji: "🟩", prop: 0.09 },
  { id: "Caju",  nome: "Cajutella",                emoji: "⬛️", prop: 0.11 },
  { id: "SR",    nome: "Sem Recheio",              emoji: "🟪", prop: 0.08 },
  { id: "Lar",   nome: "Laranja",                  emoji: "🟧", prop: 0.10 },
  { id: "Mes",   nome: "Sabor do Mês",             emoji: "⬜️", prop: 0.09 },
];

// Car recebe o resto do arredondamento — nunca é arredondado ele mesmo
export const SABOR_RESTANTE: FlavorId = "Car";

export const SABORES_IDS: FlavorId[] = SABORES.map((s) => s.id);

export const BLANK_FLAVORS: Record<FlavorId, number> = {
  Dln: 0, Car: 0, Mar: 0, Caju: 0, SR: 0, DLSem: 0, Lar: 0, Mes: 0,
};

// ─── Mapeamento Notion → FlavorId ─────────────────────────────────────────────

export const NOTION_FLAVOR_MAP: Record<string, FlavorId> = {
  "🟫 PDM DLN":  "Dln",
  "🟥 PDM CAR":  "Car",
  "🟨 PDM MAR":  "Mar",
  "⬛️ PDM CAJU": "Caju",
  "🟦 PDM SR":   "SR",
  "PDM DL Sem":  "DLSem",
  "🟧 PDM LAR":  "Lar",
  "⬜️ PDM MÊS":  "Mes",
};

// ─── Cálculo de produção ──────────────────────────────────────────────────────

/**
 * Calcula produção sugerida por sabor.
 * Preserva exatamente o algoritmo de paes-mel-producao-v8/client/src/pages/Home.tsx (linhas 154–210).
 *
 * - Todos os sabores (exceto Car) são arredondados para múltiplos de 5
 * - Car (SABOR_RESTANTE) recebe totalProducao - soma(outros) para fechar o total exato
 * - DLSem só é calculado se dlsemToggle=true; proporção = 0 (só encomenda)
 * - ajustesAtuais: se fornecido, mantem ajustes manuais já definidos; caso contrário usa sugerido
 */
export function calcularProducao(
  sobras: Record<FlavorId, number>,
  encomendas: Record<FlavorId, number>,
  totalProducao: number,
  dlsemToggle: boolean,
  ajustesAtuais?: Partial<Record<FlavorId, number>>,
): Record<FlavorId, FlavorData> {
  const totalSobras = SABORES_IDS.reduce((s, id) => s + (sobras[id] ?? 0), 0);
  const totalEncomendas = SABORES_IDS.reduce((s, id) => s + (encomendas[id] ?? 0), 0);
  const totalParaLoja = Math.max(0, totalProducao + totalSobras - totalEncomendas);

  const result = {} as Record<FlavorId, FlavorData>;

  // Passo 1: calcular sugerido bruto por sabor
  for (const sabor of SABORES) {
    const id = sabor.id;
    const sobra = sobras[id] ?? 0;
    const enc = encomendas[id] ?? 0;

    let metaLoja = 0;
    let sugerido = 0;

    if (id === "DLSem") {
      // Só encomenda — meta = 0, sugerido = quantidade da encomenda (se toggle ligado)
      metaLoja = 0;
      sugerido = dlsemToggle ? enc : 0;
    } else if (id !== SABOR_RESTANTE) {
      metaLoja = Math.round(totalParaLoja * sabor.prop);
      sugerido = Math.max(0, metaLoja - sobra + enc);
    } else {
      // Car: calculado depois
      metaLoja = Math.round(totalParaLoja * sabor.prop);
      sugerido = Math.max(0, metaLoja - sobra + enc);
    }

    result[id] = {
      sobra,
      encomenda: enc,
      metaLoja,
      sugerido,
      ajuste: ajustesAtuais?.[id] ?? 0,
    };
  }

  // Passo 2: arredondar para múltiplos de 5 (todos exceto Car e DLSem)
  let somaOutros = 0;
  for (const sabor of SABORES) {
    const id = sabor.id;
    if (id !== SABOR_RESTANTE && id !== "DLSem") {
      result[id].sugerido = Math.round(result[id].sugerido / 5) * 5;
      somaOutros += result[id].sugerido;
    } else if (id === "DLSem") {
      // DLSem não entra na soma dos "outros" para o restante (produção separada)
      // mas precisa ser contado no total final
      somaOutros += result[id].sugerido;
    }
  }

  // Passo 3: Car recebe o resto
  result[SABOR_RESTANTE].sugerido = Math.max(0, totalProducao - somaOutros);

  // Passo 4: ajuste = ajuste manual se definido, senão usa sugerido
  for (const id of SABORES_IDS) {
    if (ajustesAtuais && id in ajustesAtuais) {
      result[id].ajuste = ajustesAtuais[id] ?? result[id].sugerido;
    } else {
      result[id].ajuste = result[id].sugerido;
    }
  }

  return result;
}

// ─── Geração da mensagem WhatsApp ─────────────────────────────────────────────

/**
 * Gera a mensagem formatada para o grupo de produção.
 * Formato:
 *   Bom dia!
 *
 *   PRODUÇÃO PÃO DE MEL - DD/MM/AAAA - LOJA 248
 *
 *   DLSem - 10 (só encomenda)
 *   Dln - 45
 *   ...
 *
 *   Total: 196
 *
 *   --- ENCOMENDAS ---
 *   [textoEncomendas]
 */
export function gerarMensagem(
  ajustes: Record<FlavorId, number>,
  date: string, // "YYYY-MM-DD"
  storeId: string,
  encomendasDLSem: number,
  textoEncomendas: string,
): string {
  const [y, m, d] = date.split("-");
  const dateDisplay = `${d}/${m}/${y}`;
  const totalAjustado = SABORES_IDS.reduce((s, id) => s + (ajustes[id] ?? 0), 0);

  let msg = `Bom dia!\n\nPRODUÇÃO PÃO DE MEL - ${dateDisplay} - LOJA ${storeId}\n\n`;

  for (const sabor of SABORES) {
    const qty = ajustes[sabor.id] ?? 0;
    if (qty > 0) {
      let linha = `${sabor.id} - ${qty}`;
      if (sabor.id === "DLSem" && encomendasDLSem > 0) {
        linha += " (só encomenda)";
      }
      msg += linha + "\n";
    }
  }

  msg += `\nTotal: ${totalAjustado}`;

  if (textoEncomendas?.trim()) {
    msg += "\n\n--- ENCOMENDAS ---\n" + textoEncomendas.trim();
  }

  return msg;
}

// ─── Parser de texto ──────────────────────────────────────────────────────────

/**
 * Parseia texto livre de encomendas e retorna quantidades por sabor.
 * Porta os padrões regex de paes-mel-producao-v8/server/producao.ts (linhas 347–380).
 * Adiciona quantidades encontradas ao acumulador (não substitui).
 */
export function parseTextToFlavors(text: string): Record<FlavorId, number> {
  const totais: Record<FlavorId, number> = { ...BLANK_FLAVORS };

  const patterns: { regex: RegExp; sabor: FlavorId }[] = [
    // Nomes completos (vêm primeiro para evitar matches parciais)
    { regex: /(\d+)\s+doce de leite com nozes/g,  sabor: "Dln"   },
    { regex: /(\d+)\s+doce leite com nozes/g,      sabor: "Dln"   },
    { regex: /(\d+)\s+dl com nozes/g,              sabor: "Dln"   },
    { regex: /(\d+)\s+dl c\/ nozes/g,              sabor: "Dln"   },
    { regex: /(\d+)\s+doce de leite sem nozes/g,   sabor: "DLSem" },
    { regex: /(\d+)\s+doce leite sem nozes/g,      sabor: "DLSem" },
    { regex: /(\d+)\s+dl sem nozes/g,              sabor: "DLSem" },
    { regex: /(\d+)\s+dl s\/ nozes/g,              sabor: "DLSem" },
    { regex: /(\d+)\s+caramelo salgado/g,          sabor: "Car"   },
    { regex: /(\d+)\s+caramelo/g,                  sabor: "Car"   },
    { regex: /(\d+)\s+sem recheio/g,               sabor: "SR"    },
    { regex: /(\d+)\s+sabor do m[eê]s/g,           sabor: "Mes"   },
    { regex: /(\d+)\s+cajutella/g,                 sabor: "Caju"  },
    { regex: /(\d+)\s+maracu[já]/g,                sabor: "Mar"   },
    { regex: /(\d+)\s+laranja/g,                   sabor: "Lar"   },
    // Abreviações
    { regex: /(\d+)\s+dlsem/g,                     sabor: "DLSem" },
    { regex: /(\d+)\s+dl sem/g,                    sabor: "DLSem" },
    { regex: /(\d+)\s+dln/g,                       sabor: "Dln"   },
    { regex: /(\d+)\s+car/g,                       sabor: "Car"   },
    { regex: /(\d+)\s+mar/g,                       sabor: "Mar"   },
    { regex: /(\d+)\s+caju/g,                      sabor: "Caju"  },
    { regex: /(\d+)\s+sr/g,                        sabor: "SR"    },
    { regex: /(\d+)\s+lar/g,                       sabor: "Lar"   },
    { regex: /(\d+)\s+mes/g,                       sabor: "Mes"   },
  ];

  const lower = text.toLowerCase();
  for (const { regex, sabor } of patterns) {
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(lower)) !== null) {
      totais[sabor] += parseInt(match[1], 10);
    }
  }

  return totais;
}

// ─── Planejamento de 2 lojas ──────────────────────────────────────────────────

// Quantidade de pães de mel em uma assadeira — o total a produzir sempre
// é arredondado para o múltiplo de bandeja mais próximo.
export const TRAY_SIZE = 49;

/**
 * Sugere o total a produzir para uma loja a partir da venda média diária.
 * Ideal de estoque = venda média diária × 2 dias. O necessário é esse ideal
 * menos a sobra atual, mais as encomendas do dia (que nunca reduzem o total),
 * arredondado para CIMA ao múltiplo de bandeja (49) mais próximo.
 *
 * Ex.: venda=100, sobra=45, encomendas=120 → ideal=200, necessário=275 → 294.
 */
export function sugerirTotalProducao(
  vendaMediaDiaria: number,
  sobraTotal: number,
  encomendasTotal: number,
): number {
  const idealEstoque = vendaMediaDiaria * 2;
  const necessario = Math.max(0, idealEstoque - sobraTotal + encomendasTotal);
  return Math.ceil(necessario / TRAY_SIZE) * TRAY_SIZE;
}

/**
 * Aplica a transferência de pães da loja 26 para a loja 248 sobre as sobras
 * brutas de cada loja, sabor a sabor. A quantidade transferida de cada sabor
 * é limitada ao que existe disponível na loja 26 (nunca fica negativa).
 */
export function aplicarTransferencia(
  sobras26: Record<FlavorId, number>,
  sobras248: Record<FlavorId, number>,
  transferencia: TransferenciaAjuste,
): { sobras26: Record<FlavorId, number>; sobras248: Record<FlavorId, number> } {
  const resultado26 = { ...BLANK_FLAVORS };
  const resultado248 = { ...BLANK_FLAVORS };

  for (const id of SABORES_IDS) {
    const disponivel = sobras26[id] ?? 0;
    const pedido = transferencia[id] ?? 0;
    const transferido = Math.min(Math.max(0, pedido), disponivel);

    resultado26[id] = disponivel - transferido;
    resultado248[id] = (sobras248[id] ?? 0) + transferido;
  }

  return { sobras26: resultado26, sobras248: resultado248 };
}

/**
 * Extrai as sobras por sabor a partir dos `items` retornados por /api/estoque
 * para uma loja/data. Sobra = soma das 3 colunas de data + Dec (= item.total),
 * recalculado aqui para não depender de um total possivelmente defasado.
 */
export function sobrasFromEstoqueItems(items: StockItem[]): Record<FlavorId, number> {
  const sobras = { ...BLANK_FLAVORS };

  for (const item of items) {
    const flavorId = STOCK_TO_FLAVOR_MAP[item.id] as FlavorId | undefined;
    if (!flavorId) continue;
    const somaColunas = (item.values ?? []).reduce<number>((s, v) => s + (Number(v) || 0), 0);
    sobras[flavorId] = somaColunas + (Number(item.dec) || 0);
  }

  return sobras;
}
