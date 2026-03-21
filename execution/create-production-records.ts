/**
 * Script de migração: cria a tabela production_records no Supabase.
 *
 * Pré-requisito: adicionar SUPABASE_SERVICE_ROLE_KEY ao .env
 *
 * Executar: npx tsx execution/create-production-records.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌  Variáveis VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias no .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const SQL = `
CREATE TABLE IF NOT EXISTS production_records (
  id              BIGSERIAL PRIMARY KEY,
  production_date DATE         NOT NULL,
  store_id        VARCHAR(10)  NOT NULL,

  sobras_dln      INT NOT NULL DEFAULT 0,
  sobras_car      INT NOT NULL DEFAULT 0,
  sobras_mar      INT NOT NULL DEFAULT 0,
  sobras_caju     INT NOT NULL DEFAULT 0,
  sobras_sr       INT NOT NULL DEFAULT 0,
  sobras_dl_sem   INT NOT NULL DEFAULT 0,
  sobras_lar      INT NOT NULL DEFAULT 0,
  sobras_mes      INT NOT NULL DEFAULT 0,

  encomendas_dln  INT NOT NULL DEFAULT 0,
  encomendas_car  INT NOT NULL DEFAULT 0,
  encomendas_mar  INT NOT NULL DEFAULT 0,
  encomendas_caju INT NOT NULL DEFAULT 0,
  encomendas_sr   INT NOT NULL DEFAULT 0,
  encomendas_dl_sem INT NOT NULL DEFAULT 0,
  encomendas_lar  INT NOT NULL DEFAULT 0,
  encomendas_mes  INT NOT NULL DEFAULT 0,

  ajuste_dln      INT NOT NULL DEFAULT 0,
  ajuste_car      INT NOT NULL DEFAULT 0,
  ajuste_mar      INT NOT NULL DEFAULT 0,
  ajuste_caju     INT NOT NULL DEFAULT 0,
  ajuste_sr       INT NOT NULL DEFAULT 0,
  ajuste_dl_sem   INT NOT NULL DEFAULT 0,
  ajuste_lar      INT NOT NULL DEFAULT 0,
  ajuste_mes      INT NOT NULL DEFAULT 0,

  total_producao    INT     NOT NULL DEFAULT 196,
  dlsem_toggle      BOOLEAN NOT NULL DEFAULT FALSE,
  order_details     JSONB,
  formatted_message TEXT,
  texto_encomendas  TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (production_date, store_id)
);
`;

async function main() {
  console.log("🔄  Criando tabela production_records no Supabase...");

  const { error } = await supabase.rpc("exec_sql", { sql: SQL }).single();

  if (error) {
    // Supabase não expõe exec_sql por padrão — usar SQL direto via REST
    // Tentar via API de administração
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey!,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql: SQL }),
    });

    if (!response.ok) {
      console.log("⚠️  RPC exec_sql não disponível. Execute o SQL manualmente no Supabase SQL Editor:");
      console.log("\n" + SQL);
      console.log("\nAcesse: https://supabase.com/dashboard/project/pnpoyhwdjconuillhfcz/sql");
      process.exit(0);
    }
  }

  console.log("✅  Tabela production_records criada com sucesso!");
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
