import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  // ── GET: buscar registro ──────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { date, storeId } = req.query;
    if (!date || !storeId) return res.status(400).json({ error: "date e storeId obrigatórios" });

    const { data, error } = await supabase
      .from("stock_records")
      .select("*")
      .eq("report_date", date as string)
      .eq("store_id", storeId as string)
      .single();

    if (error) {
      if (error.code === "PGRST116") return res.json({ empty: true });
      console.error("Supabase get error:", error);
      return res.status(500).json({ error: "Erro ao buscar dados" });
    }

    return res.json({
      empty: false,
      headers: data.headers ?? [],
      items: data.items ?? [],
      bars: data.bars ?? [],
    });
  }

  // ── POST: salvar registro ─────────────────────────────────────────────────────
  if (req.method === "POST") {
    const { date, storeId, headers, items, bars } = req.body as {
      date: string;
      storeId: string;
      headers: unknown[];
      items: unknown[];
      bars: unknown[];
    };

    if (!date || !storeId) return res.status(400).json({ error: "date e storeId obrigatórios" });

    const { error } = await supabase
      .from("stock_records")
      .upsert(
        {
          report_date: date,
          store_id: storeId,
          headers: headers ?? [],
          items: items ?? [],
          bars: bars ?? [],
          updated_at: new Date().toISOString(),
        },
        { onConflict: "report_date,store_id" },
      );

    if (error) {
      console.error("Supabase save error:", error);
      return res.status(500).json({ error: "Erro ao salvar dados" });
    }

    return res.json({ ok: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
