import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const VALID_STATUSES = ["Em aberto", "Confirmado", "Pronto", "Entregue"];
const VALID_ENTREGA  = ["Entrega 26", "Retirada 26", "Entrega 248", "Retirada 248"];
const NOTION_DATE_PROP: Record<string, string> = {
  producao: "Data PRODUÇÃO",
  entrega:  "Data ENTREGA",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = req.body as {
    action?: string;
    pageId?: string;
    status?: string;
    entrega?: string;
    field?: string;
    date?: string;
    revenda?: boolean;
  };

  const { action, pageId } = body;
  if (!pageId) return res.status(400).json({ error: "pageId is required" });

  try {
    if (action === "status") {
      const { status } = body;
      if (!status || !VALID_STATUSES.includes(status))
        return res.status(400).json({ error: "Invalid status value" });
      await notion.pages.update({
        page_id: pageId,
        properties: { Status: { status: { name: status } } },
      });

    } else if (action === "entrega") {
      const { entrega } = body;
      if (!entrega || !VALID_ENTREGA.includes(entrega))
        return res.status(400).json({ error: "Invalid entrega value" });
      await notion.pages.update({
        page_id: pageId,
        properties: { Entrega: { select: { name: entrega } } },
      });

    } else if (action === "date") {
      const { field, date } = body;
      if (!field || !NOTION_DATE_PROP[field])
        return res.status(400).json({ error: "Invalid field. Use 'producao' or 'entrega'" });
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))
        return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
      await notion.pages.update({
        page_id: pageId,
        properties: {
          [NOTION_DATE_PROP[field]]: { date: date ? { start: date } : null },
        },
      });

    } else if (action === "revenda") {
      const { revenda } = body;
      if (typeof revenda !== "boolean")
        return res.status(400).json({ error: "revenda must be a boolean" });
      await notion.pages.update({
        page_id: pageId,
        properties: { "É Revenda?": { checkbox: revenda } },
      });

    } else {
      return res.status(400).json({ error: "Invalid action" });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Notion update error:", error);
    return res.status(500).json({ error: "Failed to update" });
  }
}
