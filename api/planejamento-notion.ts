import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { FlavorId, OrderDetail } from "../src/utils/producao";
import { NOTION_FLAVOR_MAP, BLANK_FLAVORS } from "../src/utils/producao";

const NOTION_TOKEN = process.env.NOTION_TOKEN ?? "";
const NOTION_DB_ID = process.env.NOTION_DB_ID ?? "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const { date, storeId } = req.query;
  if (!date || !storeId) return res.status(400).json({ error: "date e storeId obrigatórios" });

  try {
    // Buscar todos os pedidos da data — filtrar por loja no cliente
    // (Notion select filter requer valor exato; "Entrega 248" ≠ "Retirada 248", etc.)
    const notionRes = await fetch(`https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: {
          property: "Data PRODUÇÃO",
          date: { equals: date as string },
        },
        page_size: 100,
      }),
    });

    if (!notionRes.ok) {
      const err = await notionRes.text();
      console.error("Notion error:", err);
      return res.status(502).json({ error: "Erro ao consultar Notion" });
    }

    const json = await notionRes.json() as {
      results: Array<{
        properties: Record<string, {
          title?: Array<{ plain_text: string }>;
          number?: number | null;
          select?: { name: string } | null;
          rich_text?: Array<{ plain_text: string }>;
        }>;
      }>;
    };

    const encomendas = { ...BLANK_FLAVORS };
    const orderDetails: OrderDetail[] = [];
    const textoLinhas: string[] = [];

    for (const page of json.results) {
      const props = page.properties;

      // Filtrar por loja: campo "Entrega" deve conter o storeId (ex: "248")
      const entregaVal = props["Entrega"]?.select?.name ?? "";
      if (!entregaVal.includes(storeId as string)) continue;

      const clientName = props["Cliente"]?.title?.[0]?.plain_text?.trim() ?? "Cliente";
      const observation = props["Observação!"]?.rich_text?.[0]?.plain_text?.trim();

      const flavors: Record<string, number> = {};
      for (const [notionCol, flavorId] of Object.entries(NOTION_FLAVOR_MAP)) {
        const qty = props[notionCol]?.number ?? 0;
        if (qty > 0) {
          encomendas[flavorId as FlavorId] += qty;
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
