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
    .from("production_records")
    .select("*")
    .eq("production_date", date as string)
    .eq("store_id", storeId as string)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      // Nenhum registro encontrado
      return res.json({ empty: true });
    }
    console.error("Supabase get error:", error);
    return res.status(500).json({ error: "Erro ao buscar dados" });
  }

  return res.json({
    empty: false,
    sobras: {
      Dln: data.sobras_dln, Car: data.sobras_car, Mar: data.sobras_mar,
      Caju: data.sobras_caju, SR: data.sobras_sr, DLSem: data.sobras_dl_sem,
      Lar: data.sobras_lar, Mes: data.sobras_mes,
    },
    encomendas: {
      Dln: data.encomendas_dln, Car: data.encomendas_car, Mar: data.encomendas_mar,
      Caju: data.encomendas_caju, SR: data.encomendas_sr, DLSem: data.encomendas_dl_sem,
      Lar: data.encomendas_lar, Mes: data.encomendas_mes,
    },
    ajustes: {
      Dln: data.ajuste_dln, Car: data.ajuste_car, Mar: data.ajuste_mar,
      Caju: data.ajuste_caju, SR: data.ajuste_sr, DLSem: data.ajuste_dl_sem,
      Lar: data.ajuste_lar, Mes: data.ajuste_mes,
    },
    totalProducao: data.total_producao,
    dlsemToggle: data.dlsem_toggle,
    orderDetails: data.order_details ?? [],
    textoEncomendas: data.texto_encomendas ?? "",
    transferenciaAjuste: data.transferencia_ajuste ?? {},
  });
}
