import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

// Mapeamento de id de estoque (lowercase) → FlavorId do Planejamento (inline,
// mesmo padrão de api/planejamento-sobras.ts, para evitar import relativo de src/)
const STOCK_TO_FLAVOR: Record<string, string> = {
  dln: "Dln", car: "Car", mar: "Mar", caju: "Caju",
  sr: "SR", lar: "Lar", mes: "Mes",
};

const FLAVOR_IDS = ["Dln", "Car", "Mar", "Caju", "SR", "DLSem", "Lar", "Mes"];

interface StockItem {
  id: string;
  values: (number | string)[];
  dec?: number | string;
}

interface HistoricoRow {
  date: string;
  storeId: string;
  values: Record<string, number>;
  total: number;
}

// ─── store-config ──────────────────────────────────────────────────────────

async function getStoreConfig(res: VercelResponse) {
  const { data, error } = await supabase.from("store_config").select("*");
  if (error) {
    console.error("Supabase store-config get error:", error);
    return res.status(500).json({ error: "Erro ao buscar configuração das lojas" });
  }

  const configs: Record<string, { vendaDiaria: number }> = {};
  for (const row of data ?? []) {
    configs[row.store_id] = { vendaDiaria: row.venda_diaria_pdm ?? 0 };
  }
  return res.json({ configs });
}

async function saveStoreConfig(req: VercelRequest, res: VercelResponse) {
  const { storeId, vendaDiaria } = req.body as { storeId?: string; vendaDiaria?: number };
  if (!storeId || typeof vendaDiaria !== "number") {
    return res.status(400).json({ error: "storeId e vendaDiaria (number) obrigatórios" });
  }

  const { error } = await supabase
    .from("store_config")
    .upsert(
      { store_id: storeId, venda_diaria_pdm: vendaDiaria, updated_at: new Date().toISOString() },
      { onConflict: "store_id" },
    );

  if (error) {
    console.error("Supabase store-config save error:", error);
    return res.status(500).json({ error: "Erro ao salvar configuração da loja" });
  }
  return res.json({ ok: true });
}

// ─── historico-sobras ──────────────────────────────────────────────────────

async function getHistoricoSobras(req: VercelRequest, res: VercelResponse) {
  const { start, end, storeId } = req.query as { start?: string; end?: string; storeId?: string };
  if (!start || !end) return res.status(400).json({ error: "start e end obrigatórios" });

  let query = supabase
    .from("stock_records")
    .select("report_date, store_id, items")
    .gte("report_date", start)
    .lte("report_date", end)
    .order("report_date", { ascending: false });

  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query;
  if (error) {
    console.error("Supabase historico-sobras error:", error);
    return res.status(500).json({ error: "Erro ao buscar histórico de sobras" });
  }

  const rows: HistoricoRow[] = (data ?? []).map((row) => {
    const items = (row.items ?? []) as StockItem[];
    const values: Record<string, number> = {};
    let total = 0;
    for (const item of items) {
      const flavorId = STOCK_TO_FLAVOR[item.id];
      if (!flavorId) continue;
      // Sobra = soma das 3 colunas de data + Dec (= item.total), recalculado
      // aqui para não depender de um total possivelmente defasado.
      const somaColunas = (item.values ?? []).reduce<number>((s, v) => s + (Number(v) || 0), 0);
      const sobra = somaColunas + (Number(item.dec) || 0);
      values[flavorId] = sobra;
      total += sobra;
    }
    return { date: row.report_date, storeId: row.store_id, values, total };
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ rows });
}

// ─── historico-producao ────────────────────────────────────────────────────

async function getHistoricoProducao(req: VercelRequest, res: VercelResponse) {
  const { start, end, storeId } = req.query as { start?: string; end?: string; storeId?: string };
  if (!start || !end) return res.status(400).json({ error: "start e end obrigatórios" });

  let query = supabase
    .from("production_records")
    .select("*")
    .gte("production_date", start)
    .lte("production_date", end)
    .order("production_date", { ascending: false });

  if (storeId) query = query.eq("store_id", storeId);

  const { data, error } = await query;
  if (error) {
    console.error("Supabase historico-producao error:", error);
    return res.status(500).json({ error: "Erro ao buscar histórico de produção" });
  }

  const rows: HistoricoRow[] = (data ?? []).map((row) => {
    const values: Record<string, number> = {
      Dln: row.ajuste_dln ?? 0, Car: row.ajuste_car ?? 0, Mar: row.ajuste_mar ?? 0,
      Caju: row.ajuste_caju ?? 0, SR: row.ajuste_sr ?? 0, DLSem: row.ajuste_dl_sem ?? 0,
      Lar: row.ajuste_lar ?? 0, Mes: row.ajuste_mes ?? 0,
    };
    return {
      date: row.production_date,
      storeId: row.store_id,
      values,
      total: row.total_producao ?? FLAVOR_IDS.reduce((s, id) => s + (values[id] ?? 0), 0),
    };
  });

  res.setHeader("Cache-Control", "no-store");
  return res.json({ rows });
}

// ─── handler ────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const resource = (req.method === "GET" ? req.query.resource : req.body?.resource) as
    | string
    | undefined;

  if (req.method === "GET") {
    if (resource === "store-config") return getStoreConfig(res);
    if (resource === "historico-sobras") return getHistoricoSobras(req, res);
    if (resource === "historico-producao") return getHistoricoProducao(req, res);
    return res.status(400).json({ error: "resource inválido" });
  }

  if (req.method === "POST") {
    if (resource === "store-config") return saveStoreConfig(req, res);
    return res.status(400).json({ error: "resource inválido" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
