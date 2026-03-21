import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

// Mapeamento de id de estoque (lowercase) → FlavorId do Planejamento (PascalCase)
const STOCK_TO_FLAVOR: Record<string, string> = {
  dln:  "Dln",
  car:  "Car",
  mar:  "Mar",
  caju: "Caju",
  sr:   "SR",
  lar:  "Lar",
  mes:  "Mes",
};

interface StockItem {
  id: string;
  values: (number | string)[];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { date } = req.query;
  if (!date) return res.status(400).json({ error: "date obrigatório" });

  // Busca estoque das duas lojas e soma — produção precisa do total disponível
  const { data: rows, error } = await supabase
    .from("stock_records")
    .select("items")
    .eq("report_date", date as string);

  if (error) {
    console.error("Supabase sobras error:", error);
    return res.status(500).json({ error: "Erro ao buscar sobras" });
  }

  if (!rows || rows.length === 0) {
    return res.json({ sobras: {}, empty: true });
  }

  const sobras: Record<string, number> = {};

  for (const row of rows) {
    const items = (row.items ?? []) as StockItem[];
    for (const item of items) {
      const flavorId = STOCK_TO_FLAVOR[item.id];
      if (!flavorId) continue;
      // D3 = values[2] (coluna mais recente)
      const d3 = Number(item.values[2]) || 0;
      if (d3 > 0) sobras[flavorId] = (sobras[flavorId] ?? 0) + d3;
    }
  }

  // Se nenhum sabor tem sobra > 0, tratar como sem dados
  const hasAnyData = Object.keys(sobras).length > 0;

  res.setHeader("Cache-Control", "no-store");
  return res.json({ sobras, empty: !hasAnyData });
}
