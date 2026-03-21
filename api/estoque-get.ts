import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { date, storeId } = req.query;
  if (!date || !storeId) return res.status(400).json({ error: "date e storeId obrigatórios" });

  const { data, error } = await supabase
    .from("stock_records")
    .select("*")
    .eq("report_date", date as string)
    .eq("store_id", storeId as string)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return res.json({ empty: true });
    }
    console.error("Supabase get error:", error);
    return res.status(500).json({ error: "Erro ao buscar dados" });
  }

  res.setHeader("Cache-Control", "no-store");
  return res.json({
    empty: false,
    headers: data.headers ?? [],
    items: data.items ?? [],
    bars: data.bars ?? [],
  });
}
