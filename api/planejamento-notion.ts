import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID ?? "";

// Mapeamento Notion → FlavorId (inline para evitar import relativo)
const NOTION_FLAVOR_MAP: Record<string, string> = {
  "🟫 PDM DLN":  "Dln",
  "🟥 PDM CAR":  "Car",
  "🟨 PDM MAR":  "Mar",
  "⬛️ PDM CAJU": "Caju",
  "🟦 PDM SR":   "SR",
  "PDM DL Sem":  "DLSem",
  "🟧 PDM LAR":  "Lar",
  "⬜️ PDM MÊS":  "Mes",
};

const BLANK_FLAVORS: Record<string, number> = {
  Dln: 0, Car: 0, Mar: 0, Caju: 0, SR: 0, DLSem: 0, Lar: 0, Mes: 0,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseNumber(prop: any): number {
  if (!prop) return 0;
  if (prop.type === "formula") return prop.formula?.number ?? 0;
  return prop.number ?? 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTitle(prop: any): string {
  return prop?.title?.[0]?.plain_text?.trim() ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseRichText(prop: any): string {
  return prop?.rich_text?.[0]?.plain_text?.trim() ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSelect(prop: any): string {
  return prop?.select?.name ?? "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { date, storeId } = req.query;
  if (!date || !storeId) return res.status(400).json({ error: "date e storeId obrigatórios" });

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let allPages: any[] = [];
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: DB_ID,
        filter: {
          property: "Data PRODUÇÃO",
          date: { equals: date as string },
        },
        start_cursor: cursor,
        page_size: 100,
      });
      allPages = allPages.concat(response.results);
      hasMore = response.has_more;
      cursor = response.next_cursor ?? undefined;
    }

    const encomendas = { ...BLANK_FLAVORS };
    const orderDetails: Array<{ clientName: string; flavors: Record<string, number>; observation?: string }> = [];
    const textoLinhas: string[] = [];

    for (const page of allPages) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const props = (page as any).properties;

      // Filtrar por loja: campo "Entrega" deve conter o storeId (ex: "248")
      const entregaVal = parseSelect(props["Entrega"]);
      if (!entregaVal.includes(storeId as string)) continue;

      const clientName = parseTitle(props["Cliente"]) || "Cliente";
      const observation = parseRichText(props["Observação!"]) || undefined;

      const flavors: Record<string, number> = {};
      for (const [notionCol, flavorId] of Object.entries(NOTION_FLAVOR_MAP)) {
        const qty = parseNumber(props[notionCol]);
        if (qty > 0) {
          encomendas[flavorId] = (encomendas[flavorId] ?? 0) + qty;
          flavors[flavorId] = qty;
        }
      }

      if (Object.keys(flavors).length > 0) {
        orderDetails.push({ clientName, flavors, observation });

        let linha = `*${clientName}*`;
        for (const [flavorId, qty] of Object.entries(flavors)) {
          linha += `\n- ${flavorId}: ${qty}`;
        }
        if (observation) linha += `\n(${observation})`;
        textoLinhas.push(linha);
      }
    }

    return res.json({
      encomendas,
      orderDetails,
      textoEncomendas: textoLinhas.join("\n\n"),
    });
  } catch (err) {
    console.error("Notion fetch error:", err);
    return res.status(500).json({ error: "Erro ao buscar encomendas do Notion" });
  }
}
