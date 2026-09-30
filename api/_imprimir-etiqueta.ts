import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

// Coloca a etiqueta na fila_impressao (tabela do projeto etiquetas-santofavo,
// mesmo Supabase). O agente do PC da loja 26 escuta a fila e imprime na Zebra.
// Usa service role porque os usuários deste site não estão em usuarios_loja,
// e a RLS da fila só libera quem tem loja vinculada.

const supabase = createClient(
  process.env.VITE_SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
);

// Única impressora de etiquetas fica na loja 26
const LOJA_IMPRESSORA = "26";

// Não é rota própria (prefixo "_"): é chamada por api/update.ts com
// action "etiqueta", porque o plano Hobby da Vercel limita a 12 funções.
export async function imprimirEtiqueta(req: VercelRequest, res: VercelResponse) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
  const { data: auth, error: authError } = token
    ? await supabase.auth.getUser(token)
    : { data: { user: null }, error: null };
  if (authError || !auth.user) return res.status(401).json({ error: "Não autenticado" });

  const { zpl } = req.body ?? {};
  if (typeof zpl !== "string" || !zpl.startsWith("^XA") || zpl.length > 8000) {
    return res.status(400).json({ error: "ZPL inválido" });
  }

  const { data: loja, error: lojaError } = await supabase
    .from("stores").select("id").eq("code", LOJA_IMPRESSORA).single();
  if (lojaError || !loja) return res.status(500).json({ error: "Loja da impressora não encontrada" });

  const { data, error } = await supabase
    .from("fila_impressao")
    .insert({ loja_id: loja.id, etiqueta_id: null, zpl })
    .select("id")
    .single();
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ id: data.id });
}
