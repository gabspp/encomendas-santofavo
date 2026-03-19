import Anthropic from "@anthropic-ai/sdk";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Constantes do domínio ─────────────────────────────────────────────────────

const ATENDENTES = ["Raissa", "Gabriel", "Maria", "Thamiris", "Karla", "Elen", "Carol"];
const ENTREGA_OPTIONS = ["Entrega 26", "Retirada 26", "Entrega 248", "Retirada 248"];

// Todos os campos de produto (nomes exatos do Notion)
const PRODUCT_FIELDS = [
  "🟫 PDM DLN", "🟥 PDM CAR", "🟨 PDM MAR", "⬛️ PDM CAJU", "🟦 PDM SR",
  "🟧 PDM LAR", "⬜️ PDM MÊS", "PDM DL Sem",
  "Bolo Choco Fatia", "Bolo Choco G", "Bolo Choco P",
  "Bolo NOZES Fatia", "Bolo NOZES G", "Bolo NOZES P",
  "Bolo PDM Fatia", "Bolo PDM G", "Bolo PDM P",
  "Bolo de Especiarias G com calda", "Bolo de Mel Mini",
  " ⚪️ Ovo Casca Car", " 🔴 Ovo PDM CAR", "⚫️ Ovo Fudge",
  "🟡 Ovo PDM DLN", "🟤 Ovo Amendoim ",
  " 🔷️ Barra Caju", "🔺️ Barra Car",
  "Caixa 3", "Caixa 6", "Caixa 9", "Caixa 15",
  "Bala Caramelo", "Crocante",
  "Barrinha Amendoim", "Barrinha Fudge",
  "Barrinha Pistache e Cereja",
  "Barrinha Queijo, doce de leite e ameixa",
];

// ── Tool definition ───────────────────────────────────────────────────────────

const UPDATE_DRAFT_TOOL: Anthropic.Messages.Tool = {
  name: "update_draft",
  description: "Atualiza campos do rascunho do pedido com as informações extraídas da conversa. Chame sempre que identificar novos dados.",
  input_schema: {
    type: "object" as const,
    properties: {
      atendente: { type: "string", description: `Um de: ${ATENDENTES.join(", ")}` },
      cliente: { type: "string", description: "Nome completo do cliente" },
      telefone: { type: "string", description: "Telefone com DDD" },
      endereco: { type: "string", description: "Endereço completo (rua, número, complemento, bairro, cidade, estado, CEP)" },
      dataEntrega: { type: "string", description: "Data de entrega no formato YYYY-MM-DD" },
      entrega: { type: "string", description: `Um de: ${ENTREGA_OPTIONS.join(", ")}` },
      metodoPagamento: { type: "string", description: "Método de pagamento se já foi pago" },
      taxaEntrega: { type: "string", description: "Taxa de entrega em reais (só se aplicável)" },
      revenda: { type: "boolean", description: "true se for pedido de revenda" },
      observacao: { type: "string", description: "Observações, incluindo horário de entrega no formato 'Horário: Xh'" },
      products: {
        type: "object",
        description: `Produtos com quantidade. Chaves devem ser nomes exatos: ${PRODUCT_FIELDS.join(", ")}`,
        additionalProperties: { type: "number" },
      },
    },
  },
};

// ── System prompt ─────────────────────────────────────────────────────────────

function buildSystemPrompt(metodoOptions: string[], today: string): string {
  return `Você é um assistente de encomendas da Santo Favo, uma confeitaria artesanal. Seu trabalho é coletar informações de pedidos de forma rápida e natural.

HOJE É ${today}. Use essa data como referência para interpretar expressões como "amanhã", "sábado", etc.

ESTILO: Seja conciso e direto. Respostas curtas (1-3 linhas). Tom informal mas profissional. Em português brasileiro.

CAMPOS OBRIGATÓRIOS (colete todos estes):
- atendente (quem registrou): ${ATENDENTES.join(", ")}
- cliente (nome do cliente)
- dataEntrega (data de entrega, formato YYYY-MM-DD)
- entrega (tipo): ${ENTREGA_OPTIONS.join(", ")}
- metodoPagamento (se já foi pago) — se não foi pago, deixe em branco

CAMPOS OPCIONAIS (colete APENAS se o usuário mencionar — nunca pergunte proativamente):
- telefone, endereco, observacao, taxaEntrega, revenda, products, horário de entrega

PRODUTOS VÁLIDOS:
${PRODUCT_FIELDS.join(", ")}

MÉTODOS DE PAGAMENTO VÁLIDOS: ${metodoOptions.length > 0 ? metodoOptions.join(", ") : "PIX, Dinheiro, Cartão de Crédito, Cartão de Débito"}

REGRAS IMPORTANTES:
1. Quando o usuário colar texto formatado (ex: mensagem do WhatsApp com dados do cliente), extraia tudo que conseguir de uma vez e use a tool update_draft imediatamente.
2. Horário de entrega → inclua na observacao como "Horário: 14h"
3. Para produtos: mapeie nomes naturais para os nomes exatos. Ex: "bolo pão de mel pequeno" → "Bolo PDM P"; "pão de mel caramelo" → "🟥 PDM CAR"
4. "Bolo P" geralmente = 15cm. "Bolo G" = grande. "Fatia" = fatia individual.
5. Para data de entrega: calcule a data exata baseada em "hoje" (${today}). Ex: "sábado que vem" → próximo sábado.
6. Após cada mensagem, use update_draft para salvar qualquer dado novo identificado, depois responda ao usuário pedindo apenas o que ainda falta.
7. Quando tiver todos os campos obrigatórios, diga "Tudo certo! ✅" e pare de perguntar.
8. NÃO invente dados. Se não tiver certeza, pergunte.
9. Pergunte de forma agrupada — tente não fazer mais de 2 perguntas por vez.

MAPEAMENTO DE PRODUTOS DE PÁSCOA (nomes que os clientes usam → chave EXATA no sistema, incluindo espaços):
- "Ovo Pão de Mel - Doce de Leite com Nozes" / "ovo PDM DLN" / "ovo doce de leite" → "🟡 Ovo PDM DLN"
- "Ovo Pão de Mel - Caramelo Salgado" / "ovo PDM caramelo" / "ovo pão de mel caramelo" → " 🔴 Ovo PDM CAR"
- "Ovo Casca Recheada - Caramelo Salgado" / "ovo casca caramelo" / "ovo casca recheada" → " ⚪️ Ovo Casca Car"
- "Ovo Amendoim, Chocolate e Caramelo" / "ovo amendoim" → "🟤 Ovo Amendoim " (com espaço no final)
- "Ovo Fudge e Framboesa" / "ovo fudge" / "ovo framboesa" → "⚫️ Ovo Fudge"
- "Barra de Chocolate - Caramelo Salgado" / "barra caramelo" → "🔺️ Barra Car"
- "Barra de Chocolate - Cajutella" / "barra caju" / "barra cajutella" → " 🔷️ Barra Caju"
ATENÇÃO: use as chaves EXATAMENTE como listadas acima (espaços incluídos). Não remova nem adicione espaços.

FLUXO IDEAL:
1. Usuário cola dados → você extrai tudo (usa tool) → pergunta só o que falta
2. Se tiver atendente + cliente + entrega + data + pagamento → diga que está completo`;
}

// ── Campos obrigatórios ───────────────────────────────────────────────────────

type DraftUpdates = {
  atendente?: string;
  cliente?: string;
  telefone?: string;
  endereco?: string;
  dataEntrega?: string;
  entrega?: string;
  metodoPagamento?: string;
  taxaEntrega?: string;
  revenda?: boolean;
  observacao?: string;
  products?: Record<string, number>;
};

function isReady(draft: DraftUpdates): boolean {
  return !!(
    draft.atendente &&
    draft.cliente &&
    draft.dataEntrega &&
    draft.entrega
    // metodoPagamento é opcional (pedido pode não ter sido pago ainda)
  );
}

function getBrazilToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages, draft, metodoOptions } = req.body as {
    messages: Anthropic.Messages.MessageParam[];
    draft: DraftUpdates;
    metodoOptions: string[];
  };

  if (!Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  const today = getBrazilToday();

  try {
    // Primeira chamada — Claude pode chamar update_draft
    const response1 = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: buildSystemPrompt(metodoOptions ?? [], today),
      tools: [UPDATE_DRAFT_TOOL],
      messages,
    });

    let draftUpdates: DraftUpdates = {};
    let finalMessage = "";

    // Verificar se Claude chamou a tool
    const toolUseBlock = response1.content.find((b) => b.type === "tool_use");
    const textBlock1 = response1.content.find((b) => b.type === "text");

    if (toolUseBlock && toolUseBlock.type === "tool_use") {
      // Extrair os updates
      draftUpdates = toolUseBlock.input as DraftUpdates;

      if (textBlock1 && textBlock1.type === "text") {
        // Claude já deu a resposta junto com a tool call
        finalMessage = textBlock1.text;
      } else {
        // Fazer segunda chamada com o resultado da tool para obter a mensagem
        const messages2: Anthropic.Messages.MessageParam[] = [
          ...messages,
          { role: "assistant", content: response1.content },
          {
            role: "user",
            content: [{
              type: "tool_result",
              tool_use_id: toolUseBlock.id,
              content: "ok",
            }],
          },
        ];

        const response2 = await anthropic.messages.create({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 512,
          system: buildSystemPrompt(metodoOptions ?? [], today),
          tools: [UPDATE_DRAFT_TOOL],
          tool_choice: { type: "none" as const },
          messages: messages2,
        });

        const textBlock2 = response2.content.find((b) => b.type === "text");
        finalMessage = textBlock2 && textBlock2.type === "text" ? textBlock2.text : "";
      }
    } else if (textBlock1 && textBlock1.type === "text") {
      finalMessage = textBlock1.text;
    }

    // Merge do draft atual com os novos updates
    const mergedDraft: DraftUpdates = {
      ...draft,
      ...draftUpdates,
      products: {
        ...(draft.products ?? {}),
        ...(draftUpdates.products ?? {}),
      },
    };

    const ready = isReady(mergedDraft);

    return res.json({ message: finalMessage, draftUpdates, ready });
  } catch (error) {
    console.error("Anthropic API error:", error);
    return res.status(500).json({ error: "Falha ao processar mensagem" });
  }
}
