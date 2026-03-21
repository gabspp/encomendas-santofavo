/**
 * Script de migração: exibe o SQL para criar a tabela stock_records no Supabase.
 *
 * Executar: npx tsx execution/create-stock-records.ts
 * Depois: colar o SQL no Supabase SQL Editor
 * https://supabase.com/dashboard/project/pnpoyhwdjconuillhfcz/sql
 */

const SQL = `
CREATE TABLE IF NOT EXISTS stock_records (
  id              BIGSERIAL PRIMARY KEY,
  report_date     DATE        NOT NULL,
  store_id        VARCHAR(10) NOT NULL,
  headers         JSONB       NOT NULL DEFAULT '[]',
  items           JSONB       NOT NULL DEFAULT '[]',
  bars            JSONB       NOT NULL DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (report_date, store_id)
);
`;

console.log("📋  Execute o seguinte SQL no Supabase SQL Editor:");
console.log("\nhttps://supabase.com/dashboard/project/pnpoyhwdjconuillhfcz/sql\n");
console.log(SQL);
