import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID ?? "";

// Compute a date string "YYYY-MM-DD" offset by N days, in Brazil timezone
function getBrazilDate(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date); // en-CA produces "YYYY-MM-DD"
}

// Property parsers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTitle(prop: any): string {
  return prop?.title?.[0]?.plain_text ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRichText(prop: any): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return prop?.rich_text?.map((r: any) => r.plain_text).join("") ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNumber(prop: any): number {
  if (!prop) return 0;
  if (prop.type === "formula") return prop.formula?.number ?? 0; // PDM Avulso é formula
  return prop.number ?? 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDate(prop: any): string {
  return prop?.date?.start ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePhone(prop: any): string {
  return prop?.phone_number ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStatus(prop: any): string {
  return prop?.status?.name ?? "";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePage(page: any) {
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
    atendente: parseSelect(p["Atendente"]),  // select, não rich_text
    observacao: parseRichText(p["Observação!"]),
    telefone: parsePhone(p["Telefone"]),     // phone_number, não rich_text
    endereco: parseRichText(p["Endereço"]),
    products,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const today = getBrazilDate(0);
    const tomorrow = getBrazilDate(1);

    const filter = {
      or: [
        { property: "Data PRODUÇÃO", date: { equals: today } },
        { property: "Data PRODUÇÃO", date: { equals: tomorrow } },
      ],
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allPages: any[] = [];
    let cursor: string | undefined = undefined;
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

    res.setHeader("Cache-Control", "no-store");
    return res.json({ today, tomorrow, orders });
  } catch (error) {
    console.error("Notion API error:", error);
    return res.status(500).json({ error: "Failed to fetch orders from Notion" });
  }
}
