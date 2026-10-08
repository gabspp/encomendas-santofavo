/**
 * Script de migração: exibe o SQL para adicionar a coluna ignorar_mes em
 * production_records (interruptor "Ignorar PDM do mês" da loja 248).
 *
 * Executar: npx tsx execution/add-ignorar-mes.ts
 * Depois: colar o SQL no Supabase SQL Editor
 * https://supabase.com/dashboard/project/pnpoyhwdjconuillhfcz/sql
 */

// Sem default: registros antigos ficam NULL e a página os trata como
// "desligado" (comportamento de antes). Dias novos são salvos com true.
const SQL = `
ALTER TABLE production_records
  ADD COLUMN IF NOT EXISTS ignorar_mes BOOLEAN;
`;

console.log("📋  Execute o seguinte SQL no Supabase SQL Editor:");
console.log("\nhttps://supabase.com/dashboard/project/pnpoyhwdjconuillhfcz/sql\n");
console.log(SQL);
