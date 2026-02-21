import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { pageId, revenda } = req.body as { pageId?: string; revenda?: boolean };

  if (!pageId || typeof revenda !== "boolean") {
    return res.status(400).json({ error: "pageId and revenda (boolean) are required" });
  }

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Revenda: { checkbox: revenda },
      },
    });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Notion update error:", error);
    return res.status(500).json({ error: "Failed to update revenda" });
  }
}
