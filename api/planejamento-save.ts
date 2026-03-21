import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const {
    date, storeId,
    sobras = {}, encomendas = {}, ajustes = {},
    totalProducao = 196, dlsemToggle = false,
    orderDetails = [], formattedMessage = "", textoEncomendas = "",
  } = req.body ?? {};

  if (!date || !storeId) return res.status(400).json({ error: "date e storeId obrigatórios" });

  const row = {
    production_date: date,
    store_id: storeId,

    sobras_dln: sobras.Dln ?? 0, sobras_car: sobras.Car ?? 0,
    sobras_mar: sobras.Mar ?? 0, sobras_caju: sobras.Caju ?? 0,
    sobras_sr: sobras.SR ?? 0, sobras_dl_sem: sobras.DLSem ?? 0,
    sobras_lar: sobras.Lar ?? 0, sobras_mes: sobras.Mes ?? 0,

    encomendas_dln: encomendas.Dln ?? 0, encomendas_car: encomendas.Car ?? 0,
    encomendas_mar: encomendas.Mar ?? 0, encomendas_caju: encomendas.Caju ?? 0,
    encomendas_sr: encomendas.SR ?? 0, encomendas_dl_sem: encomendas.DLSem ?? 0,
    encomendas_lar: encomendas.Lar ?? 0, encomendas_mes: encomendas.Mes ?? 0,

    ajuste_dln: ajustes.Dln ?? 0, ajuste_car: ajustes.Car ?? 0,
    ajuste_mar: ajustes.Mar ?? 0, ajuste_caju: ajustes.Caju ?? 0,
    ajuste_sr: ajustes.SR ?? 0, ajuste_dl_sem: ajustes.DLSem ?? 0,
    ajuste_lar: ajustes.Lar ?? 0, ajuste_mes: ajustes.Mes ?? 0,

    total_producao: totalProducao,
    dlsem_toggle: dlsemToggle,
    order_details: orderDetails,
    formatted_message: formattedMessage,
    texto_encomendas: textoEncomendas,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("production_records")
    .upsert(row, { onConflict: "production_date,store_id" });

  if (error) {
    console.error("Supabase save error:", error);
    return res.status(500).json({ error: "Erro ao salvar dados" });
  }

  return res.json({ ok: true });
}
