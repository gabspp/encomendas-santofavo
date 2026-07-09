/**
 * Script de migração: exibe o SQL para o modo de planejamento de 2 lojas.
 *
 * - Nova tabela store_config: venda média diária atual por loja (sem histórico).
 * - Nova coluna em production_records: transferencia_ajuste (delta por sabor
 *   causado pela transferência 26→248 naquele dia).
 *
 * Executar: npx tsx execution/create-planejamento-lojas-schema.ts
 * Depois: colar o SQL no Supabase SQL Editor
 * https://supabase.com/dashboard/project/pnpoyhwdjconuillhfcz/sql
 */

const SQL = `
CREATE TABLE IF NOT EXISTS store_config (
  store_id          VARCHAR(10) PRIMARY KEY,
  venda_diaria_pdm  INT NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO store_config (store_id, venda_diaria_pdm) VALUES
  ('26', 0),
  ('248', 0)
ON CONFLICT (store_id) DO NOTHING;

ALTER TABLE production_records
  ADD COLUMN IF NOT EXISTS transferencia_ajuste JSONB NOT NULL DEFAULT '{}'::jsonb;
`;

console.log("📋  Execute o seguinte SQL no Supabase SQL Editor:");
console.log("\nhttps://supabase.com/dashboard/project/pnpoyhwdjconuillhfcz/sql\n");
console.log(SQL);
