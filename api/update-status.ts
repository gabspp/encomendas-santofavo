import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

const VALID_STATUSES = ["Em aberto", "Confirmado", "Pronto", "Entregue"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pageId, status } = req.body as { pageId?: string; status?: string };

  if (!pageId || !status) {
    return res.status(400).json({ error: "pageId and status are required" });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Status: { status: { name: status } },
      },
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Notion update error:", error);
    return res.status(500).json({ error: "Failed to update status" });
  }
}
