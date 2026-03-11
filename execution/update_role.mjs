import { createClient } from "@supabase/supabase-js";

// Este script usa a SUPABASE_SERVICE_ROLE_KEY enviada no terminal/env
// para ter privilégios de Admin e atualizar metadados de usuários que o painel normal não deixa mudar.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://pnpoyhwdjconuillhfcz.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("ERRO: A variável de ambiente SUPABASE_SERVICE_ROLE_KEY é obrigatória para esta operação.");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateUserRole(userId, role) {
  console.log(`Tentando atualizar o usuário [${userId}] para a role: [${role}]...`);

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: { role },
  });

  if (error) {
    console.error("Falha ao atualizar o usuário:", error.message);
    process.exit(1);
  }

  console.log("Sucesso! Os metadados do usuário foram atualizados:");
  console.log(JSON.stringify(data.user.user_metadata, null, 2));
}

// Pegar os dois últimos argumentos passados no terminal (ex: node update_role.js <user_id> admin)
const args = process.argv.slice(2);
if (args.length < 2) {
  console.error("Uso correto: node update_role.mjs <USER_ID> <ROLE>");
  console.error("Exemplo: node update_role.mjs 30ce8fca-76ac-483c-924f-2bd9aca4c197 admin");
  process.exit(1);
}

const userId = args[0];
const targetRole = args[1];

updateUserRole(userId, targetRole);
