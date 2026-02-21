import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const NOTION_PROP: Record<string, string> = {
  producao: "Data PRODUÇÃO",
  entrega:  "Data ENTREGA",
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pageId, field, date } = req.body as {
    pageId?: string;
    field?: string;
    date?: string; // "YYYY-MM-DD" or "" to clear
  };

  if (!pageId || !field) {
    return res.status(400).json({ error: "pageId and field are required" });
  }
  if (!NOTION_PROP[field]) {
    return res.status(400).json({ error: "Invalid field. Use 'producao' or 'entrega'" });
  }
  // Validate date format if provided
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        [NOTION_PROP[field]]: {
          date: date ? { start: date } : null,
        },
      },
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Notion update error:", error);
    return res.status(500).json({ error: "Failed to update date" });
  }
}
