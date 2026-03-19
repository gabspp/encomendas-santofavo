import { Client } from "@notionhq/client";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID ?? "";

function getBrazilToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Exact Notion column names for number product fields (excluding PDM Avulso which is a formula)
const NUMBER_PRODUCT_FIELDS = [
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

interface OrderDraftBody {
  atendente: string;
  cliente: string;
  telefone: string;
  endereco: string;
  dataEntrega: string;
  dataProducao: string;
  entrega: string;
  metodoPagamento: string;
  taxaEntrega: string;
  revenda: boolean;
  products: Record<string, number>;
  observacao: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const draft = req.body?.draft as OrderDraftBody | undefined;

  if (!draft?.cliente?.trim() || !draft?.atendente || !draft?.dataEntrega || !draft?.dataProducao || !draft?.entrega) {
    return res.status(400).json({ error: "Campos obrigatórios: cliente, atendente, dataEntrega, dataProducao, entrega" });
  }

  // Determine page icon: 🎂 if any Bolo product > 0, else 🟢
  const hasBolo = NUMBER_PRODUCT_FIELDS
    .filter((f) => f.startsWith("Bolo"))
    .some((f) => (draft.products?.[f] ?? 0) > 0);
  const icon = hasBolo ? "🎂" : "🟢";

  // Build product number properties — only send non-zero quantities to avoid
  // Notion rejecting the request if a column was renamed/removed
  const productProps: Record<string, { number: number }> = {};
  for (const field of NUMBER_PRODUCT_FIELDS) {
    const qty = draft.products?.[field] ?? 0;
    if (qty > 0) {
      productProps[field] = { number: qty };
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      "Cliente": { title: [{ text: { content: draft.cliente.trim() } }] },
      "Atendente": { select: { name: draft.atendente } },
      "Data ENTREGA": { date: { start: draft.dataEntrega } },
      "Data PRODUÇÃO": { date: { start: draft.dataProducao } },
      "Data do Pedido": { date: { start: getBrazilToday() } },
      "Entrega": { select: { name: draft.entrega } },
      "Status": { status: { name: "Em aberto" } },
      "É Revenda?": { checkbox: draft.revenda ?? false },
      ...productProps,
    };

    if (draft.telefone?.trim()) {
      properties["Telefone"] = { phone_number: draft.telefone.trim() };
    }
    if (draft.endereco?.trim()) {
      properties["Endereço"] = { rich_text: [{ text: { content: draft.endereco.trim() } }] };
    }
    if (draft.metodoPagamento) {
      properties["Método de Pagamento"] = { select: { name: draft.metodoPagamento } };
    }
    if (draft.taxaEntrega && parseFloat(draft.taxaEntrega) > 0) {
      properties["Taxa Entrega"] = { number: parseFloat(draft.taxaEntrega) };
    }
    if (draft.observacao?.trim()) {
      properties["Observação!"] = { rich_text: [{ text: { content: draft.observacao.trim() } }] };
    }

    const page = await notion.pages.create({
      parent: { database_id: DB_ID },
      icon: { type: "emoji", emoji: icon },
      properties,
    });

    return res.json({ ok: true, pageId: page.id });
  } catch (error) {
    console.error("Notion create error:", error);
    return res.status(500).json({ error: "Failed to create order" });
  }
}
