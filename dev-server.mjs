/**
 * Dev server local — substitui o `vercel dev` sem precisar do CLI da Vercel.
 * Serve a mesma lógica de api/orders.ts na porta 3000.
 *
 * Uso: node --env-file=.env dev-server.mjs
 */

import { createServer } from "node:http";
import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID ?? "";
const PORT = 3000;

if (!process.env.NOTION_TOKEN) {
  console.error("❌  NOTION_TOKEN não encontrado no .env");
  process.exit(1);
}
if (!DB_ID) {
  console.error("❌  NOTION_DB_ID não encontrado no .env");
  process.exit(1);
}

function getBrazilDate(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function parseTitle(prop) {
  return prop?.title?.[0]?.plain_text ?? "";
}
function parseRichText(prop) {
  return prop?.rich_text?.map((r) => r.plain_text).join("") ?? "";
}
function parseNumber(prop) {
  if (!prop) return 0;
  if (prop.type === "formula") return prop.formula?.number ?? 0; // PDM Avulso é formula
  return prop.number ?? 0;
}
function parseSelect(prop) {
  return prop?.select?.name ?? "";
}
function parseDate(prop) {
  return prop?.date?.start ?? "";
}
function parsePhone(prop) {
  return prop?.phone_number ?? "";
}
function parseStatus(prop) {
  return prop?.status?.name ?? "";
}
function parseCheckbox(prop) {
  return prop?.checkbox ?? false;
}

// Nomes exatos do Notion (alguns têm espaços extras)
const PRODUCT_FIELDS = [
  "PDM Avulso",                             // formula → number
  "🟫 PDM DLN",
  "🟥 PDM CAR",
  "🟨 PDM MAR",
  "⬛️ PDM CAJU",
  "🟦 PDM SR",
  "🟧 PDM LAR",
  "⬜️ PDM MÊS",
  "PDM DL Sem",
  "Bolo Choco Fatia",
  "Bolo Choco G",
  "Bolo Choco P",
  "Bolo NOZES Fatia",
  "Bolo NOZES G",
  "Bolo NOZES P",
  "Bolo PDM Fatia",
  "Bolo PDM G",
  "Bolo PDM P",
  "Bolo de Especiarias G com calda",
  "Bolo de Mel Mini",
  " ⚪️ Ovo Casca Car",                     // espaço no início
  " 🔴 Ovo PDM CAR",                        // espaço no início
  "⚫️ Ovo Fudge",
  "🟠 Ovo Casca Caju Lar",
  "🟡 Ovo PDM DLN",
  "🟤 Ovo Amendoim ",                       // espaço no final
  " 🔷️ Barra Caju",                        // espaço no início
  "🔺️ Barra Car",
  "Caixa 3",
  "Caixa 6",
  "Caixa 9",
  "Caixa 15",
  "Bala Caramelo",
  "Crocante",
  "Barrinha Amendoim",
  "Barrinha Fudge",
  "Barrinha Pistache e Cereja",
  "Barrinha Queijo, doce de leite e ameixa",
];

function parsePage(page) {
  const p = page.properties;
  const products = PRODUCT_FIELDS.map((name) => ({
    name: name.trim(), // remove espaços para exibição
    qty: parseNumber(p[name]),
  })).filter((item) => item.qty > 0);

  return {
    id: page.id,
    cliente: parseTitle(p["Cliente"]),
    icon: page.icon?.type === "emoji" ? page.icon.emoji : "",
    dataProducao: parseDate(p["Data PRODUÇÃO"]),
    dataEntrega: parseDate(p["Data ENTREGA"]),
    dataPedido: parseDate(p["Data do Pedido"]),
    entrega: parseSelect(p["Entrega"]),
    status: parseStatus(p["Status"]),
    revenda: parseCheckbox(p["É Revenda?"]),
    atendente: parseSelect(p["Atendente"]),  // select, não rich_text
    observacao: parseRichText(p["Observação!"]),
    telefone: parsePhone(p["Telefone"]),     // phone_number, não rich_text
    endereco: parseRichText(p["Endereço"]),
    products,
  };
}

async function handleOrders(res) {
  const today = getBrazilDate(0);
  const tomorrow = getBrazilDate(1);

  const filter = {
    or: [
      { property: "Data PRODUÇÃO", date: { equals: today } },
      { property: "Data PRODUÇÃO", date: { equals: tomorrow } },
    ],
  };

  let allPages = [];
  let cursor = undefined;
  let hasMore = true;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: DB_ID,
      filter,
      start_cursor: cursor,
      page_size: 100,
    });
    allPages = allPages.concat(response.results);
    hasMore = response.has_more;
    cursor = response.next_cursor ?? undefined;
  }

  const orders = allPages.map(parsePage);

  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(JSON.stringify({ today, tomorrow, dates: [today, tomorrow], orders }));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*" });
    res.end();
    return;
  }

  if (url.pathname === "/api/orders" && req.method === "GET") {
    try {
      await handleOrders(res);
    } catch (err) {
      console.error("Notion error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/update-entrega" && req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        req.on("error", reject);
      });
      const { pageId, entrega } = body;
      const VALID = ["Entrega 26", "Retirada 26", "Entrega 248", "Retirada 248"];
      if (!pageId || !entrega || !VALID.includes(entrega)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "pageId e entrega válida são obrigatórios" }));
        return;
      }
      await notion.pages.update({
        page_id: pageId,
        properties: { Entrega: { select: { name: entrega } } },
      });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("Update entrega error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/update-status" && req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        req.on("error", reject);
      });
      const { pageId, status } = body;
      const VALID = ["Em aberto", "Confirmado", "Pronto", "Entregue"];
      if (!pageId || !status || !VALID.includes(status)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "pageId e status válido são obrigatórios" }));
        return;
      }
      await notion.pages.update({
        page_id: pageId,
        properties: { Status: { status: { name: status } } },
      });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("Update error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/update-revenda" && req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        req.on("error", reject);
      });
      const { pageId, revenda } = body;
      if (!pageId || typeof revenda !== "boolean") {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "pageId e revenda (boolean) são obrigatórios" }));
        return;
      }
      await notion.pages.update({
        page_id: pageId,
        properties: { "É Revenda?": { checkbox: revenda } },
      });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("Update revenda error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/form-options" && req.method === "GET") {
    try {
      const db = await notion.databases.retrieve({ database_id: DB_ID });
      const props = db.properties;
      const metodosPagamento = props["Método de Pagamento"]?.select?.options?.map((o) => o.name) ?? [];
      res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "s-maxage=300", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ metodosPagamento }));
    } catch (err) {
      console.error("Form options error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/create-order" && req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        req.on("error", reject);
      });
      const draft = body.draft;
      if (!draft?.cliente?.trim() || !draft?.atendente || !draft?.dataEntrega || !draft?.dataProducao || !draft?.entrega) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Campos obrigatórios faltando" }));
        return;
      }

      const NUMBER_PRODUCT_FIELDS = [
        "🟫 PDM DLN", "🟥 PDM CAR", "🟨 PDM MAR", "⬛️ PDM CAJU", "🟦 PDM SR",
        "🟧 PDM LAR", "⬜️ PDM MÊS", "PDM DL Sem",
        "Bolo Choco Fatia", "Bolo Choco G", "Bolo Choco P",
        "Bolo NOZES Fatia", "Bolo NOZES G", "Bolo NOZES P",
        "Bolo PDM Fatia", "Bolo PDM G", "Bolo PDM P",
        "Bolo de Especiarias G com calda", "Bolo de Mel Mini",
        " ⚪️ Ovo Casca Car", " 🔴 Ovo PDM CAR", "⚫️ Ovo Fudge",
        "🟠 Ovo Casca Caju Lar", "🟡 Ovo PDM DLN", "🟤 Ovo Amendoim ",
        " 🔷️ Barra Caju", "🔺️ Barra Car",
        "Caixa 3", "Caixa 6", "Caixa 9", "Caixa 15",
        "Bala Caramelo", "Crocante",
        "Barrinha Amendoim", "Barrinha Fudge",
        "Barrinha Pistache e Cereja",
        "Barrinha Queijo, doce de leite e ameixa",
      ];

      const hasBolo = NUMBER_PRODUCT_FIELDS.filter(f => f.startsWith("Bolo")).some(f => (draft.products?.[f] ?? 0) > 0);
      const icon = hasBolo ? "🎂" : "🟢";

      const productProps = {};
      for (const field of NUMBER_PRODUCT_FIELDS) {
        productProps[field] = { number: draft.products?.[field] ?? 0 };
      }

      const today = getBrazilDate(0);
      const properties = {
        "Cliente": { title: [{ text: { content: draft.cliente.trim() } }] },
        "Atendente": { select: { name: draft.atendente } },
        "Data ENTREGA": { date: { start: draft.dataEntrega } },
        "Data PRODUÇÃO": { date: { start: draft.dataProducao } },
        "Data do Pedido": { date: { start: today } },
        "Entrega": { select: { name: draft.entrega } },
        "Status": { status: { name: "Em aberto" } },
        "É Revenda?": { checkbox: draft.revenda ?? false },
        ...productProps,
      };
      if (draft.telefone?.trim()) properties["Telefone"] = { phone_number: draft.telefone.trim() };
      if (draft.endereco?.trim()) properties["Endereço"] = { rich_text: [{ text: { content: draft.endereco.trim() } }] };
      if (draft.metodoPagamento) properties["Método de Pagamento"] = { select: { name: draft.metodoPagamento } };
      if (draft.taxaEntrega && parseFloat(draft.taxaEntrega) > 0) properties["Taxa Entrega"] = { number: parseFloat(draft.taxaEntrega) };
      if (draft.observacao?.trim()) properties["Observação!"] = { rich_text: [{ text: { content: draft.observacao.trim() } }] };

      const page = await notion.pages.create({
        parent: { database_id: DB_ID },
        icon: { type: "emoji", emoji: icon },
        properties,
      });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true, pageId: page.id }));
    } catch (err) {
      console.error("Create order error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/chat-order" && req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        req.on("error", reject);
      });

      const { messages, draft, metodoOptions } = body;
      if (!Array.isArray(messages)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "messages array required" }));
        return;
      }

      const ATENDENTES = ["Raissa", "Gabriel", "Maria", "Thamiris", "Karla", "Elen", "Carol"];
      const ENTREGA_OPTIONS = ["Entrega 26", "Retirada 26", "Entrega 248", "Retirada 248"];
      const PRODUCT_FIELDS = [
        "🟫 PDM DLN", "🟥 PDM CAR", "🟨 PDM MAR", "⬛️ PDM CAJU", "🟦 PDM SR",
        "🟧 PDM LAR", "⬜️ PDM MÊS", "PDM DL Sem",
        "Bolo Choco Fatia", "Bolo Choco G", "Bolo Choco P",
        "Bolo NOZES Fatia", "Bolo NOZES G", "Bolo NOZES P",
        "Bolo PDM Fatia", "Bolo PDM G", "Bolo PDM P",
        "Bolo de Especiarias G com calda", "Bolo de Mel Mini",
        "⚪️ Ovo Casca Car", "🔴 Ovo PDM CAR", "⚫️ Ovo Fudge",
        "🟠 Ovo Casca Caju Lar", "🟡 Ovo PDM DLN", "🟤 Ovo Amendoim",
        "🔷️ Barra Caju", "🔺️ Barra Car",
        "Caixa 3", "Caixa 6", "Caixa 9", "Caixa 15",
        "Bala Caramelo", "Crocante",
        "Barrinha Amendoim", "Barrinha Fudge",
        "Barrinha Pistache e Cereja",
        "Barrinha Queijo, doce de leite e ameixa",
      ];

      const today = getBrazilDate(0);
      const metodos = Array.isArray(metodoOptions) && metodoOptions.length > 0
        ? metodoOptions.join(", ")
        : "PIX, Dinheiro, Cartão de Crédito, Cartão de Débito";

      const systemPrompt = `Você é um assistente de encomendas da Santo Favo, uma confeitaria artesanal. Seu trabalho é coletar informações de pedidos de forma rápida e natural.

HOJE É ${today}. Use essa data como referência para interpretar expressões como "amanhã", "sábado", etc.

ESTILO: Seja conciso e direto. Respostas curtas (1-3 linhas). Tom informal mas profissional. Em português brasileiro.

CAMPOS OBRIGATÓRIOS (colete todos estes):
- atendente (quem registrou): ${ATENDENTES.join(", ")}
- cliente (nome do cliente)
- dataEntrega (data de entrega, formato YYYY-MM-DD)
- entrega (tipo): ${ENTREGA_OPTIONS.join(", ")}
- metodoPagamento (se já foi pago) — se não foi pago, deixe em branco

CAMPOS OPCIONAIS (colete se aparecerem):
- telefone, endereco, observacao, taxaEntrega, revenda, products

PRODUTOS VÁLIDOS:
${PRODUCT_FIELDS.join(", ")}

MÉTODOS DE PAGAMENTO VÁLIDOS: ${metodos}

REGRAS IMPORTANTES:
1. Quando o usuário colar texto formatado (ex: mensagem do WhatsApp com dados do cliente), extraia tudo que conseguir de uma vez e use a tool update_draft imediatamente.
2. Horário de entrega → inclua na observacao como "Horário: 14h"
3. Para produtos: mapeie nomes naturais para os nomes exatos. Ex: "bolo pão de mel pequeno" → "Bolo PDM P"; "pão de mel caramelo" → "🟥 PDM CAR"
4. Para data de entrega: calcule a data exata baseada em "hoje" (${today}). Ex: "sábado que vem" → próximo sábado.
5. Após cada mensagem, use update_draft para salvar qualquer dado novo identificado, depois responda ao usuário pedindo apenas o que ainda falta.
6. Quando tiver todos os campos obrigatórios, diga "Tudo certo! ✅" e pare de perguntar.
7. NÃO invente dados. Se não tiver certeza, pergunte.
8. Pergunte de forma agrupada — tente não fazer mais de 2 perguntas por vez.`;

      const tools = [{
        name: "update_draft",
        description: "Atualiza campos do rascunho do pedido com as informações extraídas da conversa.",
        input_schema: {
          type: "object",
          properties: {
            atendente: { type: "string" },
            cliente: { type: "string" },
            telefone: { type: "string" },
            endereco: { type: "string" },
            dataEntrega: { type: "string", description: "YYYY-MM-DD" },
            entrega: { type: "string" },
            metodoPagamento: { type: "string" },
            taxaEntrega: { type: "string" },
            revenda: { type: "boolean" },
            observacao: { type: "string" },
            products: { type: "object", additionalProperties: { type: "number" } },
          },
        },
      }];

      // First call to Anthropic
      const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1024,
          system: systemPrompt,
          tools,
          messages,
        }),
      });

      if (!anthropicRes.ok) {
        const errText = await anthropicRes.text();
        console.error("Anthropic error:", errText);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Anthropic API error" }));
        return;
      }

      const response1 = await anthropicRes.json();
      let draftUpdates = {};
      let finalMessage = "";

      const toolUseBlock = response1.content?.find((b) => b.type === "tool_use");
      const textBlock1 = response1.content?.find((b) => b.type === "text");

      if (toolUseBlock) {
        draftUpdates = toolUseBlock.input ?? {};

        if (textBlock1) {
          finalMessage = textBlock1.text;
        } else {
          // Second call with tool result
          const messages2 = [
            ...messages,
            { role: "assistant", content: response1.content },
            { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseBlock.id, content: "ok" }] },
          ];
          const anthropicRes2 = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": process.env.ANTHROPIC_API_KEY,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: "claude-haiku-4-5-20251001",
              max_tokens: 512,
              system: systemPrompt,
              tools,
              tool_choice: { type: "none" },
              messages: messages2,
            }),
          });
          const response2 = await anthropicRes2.json();
          const textBlock2 = response2.content?.find((b) => b.type === "text");
          finalMessage = textBlock2?.text ?? "";
        }
      } else if (textBlock1) {
        finalMessage = textBlock1.text;
      }

      // Check readiness (same logic as frontend)
      const mergedDraft = {
        ...draft,
        ...draftUpdates,
        products: { ...(draft?.products ?? {}), ...((draftUpdates.products) ?? {}) },
      };
      const ready = !!(mergedDraft.atendente && mergedDraft.cliente && mergedDraft.dataEntrega && mergedDraft.entrega);

      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ message: finalMessage, draftUpdates, ready }));
    } catch (err) {
      console.error("Chat order error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (url.pathname === "/api/update-date" && req.method === "POST") {
    try {
      const body = await new Promise((resolve, reject) => {
        let data = "";
        req.on("data", (chunk) => (data += chunk));
        req.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
        req.on("error", reject);
      });
      const { pageId, field, date } = body;
      const NOTION_PROP = { producao: "Data PRODUÇÃO", entrega: "Data ENTREGA" };
      if (!pageId || !field || !NOTION_PROP[field]) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "pageId e field válido são obrigatórios" }));
        return;
      }
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Formato de data inválido" }));
        return;
      }
      await notion.pages.update({
        page_id: pageId,
        properties: {
          [NOTION_PROP[field]]: { date: date ? { start: date } : null },
        },
      });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ok: true }));
    } catch (err) {
      console.error("Update date error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`\n🍫  Dev API rodando em http://localhost:${PORT}`);
  console.log(`   GET http://localhost:${PORT}/api/orders\n`);
});
