import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const VALID_ENTREGA = ["Entrega 26", "Retirada 26", "Entrega 248", "Retirada 248"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pageId, entrega } = req.body as { pageId?: string; entrega?: string };

  if (!pageId || !entrega) {
    return res.status(400).json({ error: "pageId and entrega are required" });
  }
  if (!VALID_ENTREGA.includes(entrega)) {
    return res.status(400).json({ error: "Invalid entrega value" });
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Entrega: { select: { name: entrega } },
      },
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Notion update error:", error);
    return res.status(500).json({ error: "Failed to update entrega" });
  }
}
