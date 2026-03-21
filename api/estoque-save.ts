import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

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
