import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID ?? "";

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
  if (prop.type === "formula") return prop.formula?.number ?? 0;
  return prop.number ?? 0;
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSelect(prop: any): string {
  return prop?.select?.name ?? "";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseDate(prop: any): string {
  const start: string = prop?.date?.start ?? "";
  return start ? start.slice(0, 10) : "";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parsePhone(prop: any): string {
  return prop?.phone_number ?? "";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseStatus(prop: any): string {
  return prop?.status?.name ?? "";
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseCheckbox(prop: any): boolean {
  return prop?.checkbox ?? false;
}

const PRODUCT_FIELDS = [
  "PDM Avulso",
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
  " ⚪️ Ovo Casca Car",
  " 🔴 Ovo PDM CAR",
  "⚫️ Ovo Fudge",
  "🟠 Ovo Casca Caju Lar",
  "🟡 Ovo PDM DLN",
  "🟤 Ovo Amendoim ",
  " 🔷️ Barra Caju",
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
    name: name.trim(),
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
    atendente: parseSelect(p["Atendente"]),
    observacao: parseRichText(p["Observação!"]),
    telefone: parsePhone(p["Telefone"]),
    endereco: parseRichText(p["Endereço"]),
    products,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { startDate, endDate, field } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "startDate and endDate are required" });
  }

  const notionField = field === "entrega" ? "Data ENTREGA" : "Data PRODUÇÃO";

  try {
    const filter = {
      and: [
        {
          property: notionField,
          date: { on_or_after: startDate as string },
        },
        {
          property: notionField,
          date: { on_or_before: endDate as string },
        },
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
        sorts: [
          {
            property: notionField,
            direction: "ascending",
          },
        ],
        start_cursor: cursor,
        page_size: 100,
      });
      allPages = allPages.concat(response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }

    const orders = allPages.map(parsePage);

    res.setHeader("Cache-Control", "no-store");
    return res.json({ orders });
  } catch (error) {
    console.error("Notion API error:", error);
    return res.status(500).json({ error: "Failed to fetch orders from Notion" });
  }
}
