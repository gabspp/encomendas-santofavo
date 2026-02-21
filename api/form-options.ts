import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID ?? "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const db = await notion.databases.retrieve({ database_id: DB_ID });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const props = db.properties as Record<string, any>;

    const metodosPagamento: string[] =
      props["Método de Pagamento"]?.select?.options?.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (o: any) => o.name as string
      ) ?? [];

    res.setHeader("Cache-Control", "s-maxage=300");
    return res.json({ metodosPagamento });
  } catch (error) {
    console.error("Notion schema error:", error);
    return res.status(500).json({ error: "Failed to fetch form options" });
  }
}
