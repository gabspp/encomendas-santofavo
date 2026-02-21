import { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { formatBrDateWithDay } from "@/utils/notion";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "bot" | "user";
  content: string;
}

interface DraftState {
  atendente?: string;
  cliente?: string;
  telefone?: string;
  endereco?: string;
  dataEntrega?: string;
  dataProducao?: string;
  entrega?: string;
  metodoPagamento?: string;
  taxaEntrega?: string;
  revenda?: boolean;
  observacao?: string;
  products?: Record<string, number>;
}

interface ChatOrderModalProps {
  onClose: () => void;
  onCreated: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const INITIAL_BOT_MESSAGE = "Olá! Cole o pedido ou me diga o que precisa.";

function calcProducao(entregaISO: string): string {
  const [y, m, d] = entregaISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const daysBack = date.getDay() === 1 ? 2 : 1;
  const prod = new Date(y, m - 1, d - daysBack);
  return [
    prod.getFullYear(),
    String(prod.getMonth() + 1).padStart(2, "0"),
    String(prod.getDate()).padStart(2, "0"),
  ].join("-");
}

function isReady(draft: DraftState): boolean {
  return !!(draft.atendente && draft.cliente && draft.dataEntrega && draft.entrega);
}

// ── Preview Card ──────────────────────────────────────────────────────────────

function DraftPreview({ draft }: { draft: DraftState }) {
  const producedItems = Object.entries(draft.products ?? {})
    .filter(([, qty]) => qty > 0)
    .map(([name, qty]) => ({ name: name.trim(), qty }));

  return (
    <div className="bg-brand-cream border border-amber-200 rounded-xl p-4 text-sm space-y-3">
      <p className="font-bold text-brand-brown text-base">{draft.cliente}</p>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
        {draft.dataEntrega && (
          <>
            <span className="font-medium text-gray-400">Entrega</span>
            <span>{formatBrDateWithDay(draft.dataEntrega)}</span>
          </>
        )}
        {draft.dataProducao && (
          <>
            <span className="font-medium text-gray-400">Produção</span>
            <span>{formatBrDateWithDay(draft.dataProducao)}</span>
          </>
        )}
        {draft.entrega && (
          <>
            <span className="font-medium text-gray-400">Tipo</span>
            <span>{draft.entrega}</span>
          </>
        )}
        {draft.atendente && (
          <>
            <span className="font-medium text-gray-400">Atendente</span>
            <span>{draft.atendente}</span>
          </>
        )}
        {draft.metodoPagamento && (
          <>
            <span className="font-medium text-gray-400">Pagamento</span>
            <span>{draft.metodoPagamento}</span>
          </>
        )}
        {draft.telefone && (
          <>
            <span className="font-medium text-gray-400">Telefone</span>
            <span>{draft.telefone}</span>
          </>
        )}
      </div>

      {producedItems.length > 0 && (
        <div className="border-t border-amber-200 pt-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Produtos</p>
          <div className="space-y-0.5">
            {producedItems.map((item) => (
              <p key={item.name} className="text-xs text-gray-700">
                {item.name}: <span className="font-semibold">{item.qty}</span>
              </p>
            ))}
          </div>
        </div>
      )}

      {draft.endereco && (
        <div className="border-t border-amber-200 pt-2 text-xs text-gray-600">
          <span className="font-medium text-gray-400">Endereço: </span>
          {draft.endereco}
        </div>
      )}

      {draft.observacao && (
        <div className="border-t border-amber-200 pt-2 text-xs text-orange-800 bg-orange-50 rounded-lg px-3 py-2">
          <span className="font-semibold">Obs!</span> {draft.observacao}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ChatOrderModal({ onClose, onCreated }: ChatOrderModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "bot", content: INITIAL_BOT_MESSAGE },
  ]);
  const [draft, setDraft] = useState<DraftState>({});
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [metodoOptions, setMetodoOptions] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Fetch payment method options on mount
  useEffect(() => {
    void fetch("/api/form-options")
      .then((r) => r.json())
      .then((data) => setMetodoOptions(data.metodosPagamento ?? []))
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Convert UI messages to Anthropic format (skip initial bot greeting from API call if it's the first)
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.content,
      }));

      const res = await fetch("/api/chat-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, draft, metodoOptions }),
      });

      if (!res.ok) throw new Error("Erro na API");

      const data = await res.json() as {
        message: string;
        draftUpdates: Partial<DraftState>;
        ready: boolean;
      };

      // Apply draft updates
      setDraft((prev) => {
        const merged: DraftState = {
          ...prev,
          ...data.draftUpdates,
          products: {
            ...(prev.products ?? {}),
            ...(data.draftUpdates.products ?? {}),
          },
        };
        // Auto-calculate production date when we get delivery date
        if (data.draftUpdates.dataEntrega && !data.draftUpdates.dataProducao) {
          merged.dataProducao = calcProducao(data.draftUpdates.dataEntrega);
        }
        setReady(isReady(merged));
        return merged;
      });

      if (data.message) {
        setMessages((prev) => [...prev, { role: "bot", content: data.message }]);
      }
    } catch {
      setMessages((prev) => [...prev, {
        role: "bot",
        content: "Desculpe, tive um problema técnico. Pode repetir?",
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  async function handleSubmit() {
    if (!ready || submitting) return;
    setSubmitting(true);
    setSubmitError("");

    const dataEntrega = draft.dataEntrega ?? "";
    const dataProducao = draft.dataProducao ?? (dataEntrega ? calcProducao(dataEntrega) : "");

    const orderDraft = {
      atendente: draft.atendente ?? "",
      cliente: draft.cliente ?? "",
      telefone: draft.telefone ?? "",
      endereco: draft.endereco ?? "",
      dataEntrega,
      dataProducao,
      entrega: draft.entrega ?? "",
      metodoPagamento: draft.metodoPagamento ?? "",
      taxaEntrega: draft.taxaEntrega ?? "",
      revenda: draft.revenda ?? false,
      products: draft.products ?? {},
      observacao: draft.observacao ?? "",
    };

    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft: orderDraft }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? "Erro ao criar pedido");
      }
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao criar pedido");
      setSubmitting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ height: "min(90vh, 680px)" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="font-bold text-brand-brown text-lg">Novo Pedido</h2>
            <p className="text-xs text-gray-400">via chat</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed
                  ${msg.role === "user"
                    ? "bg-brand-brown text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                  }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}

          {/* Preview when ready */}
          {ready && !loading && (
            <div className="mt-2">
              <DraftPreview draft={draft} />
              {submitError && (
                <p className="text-xs text-red-600 mt-2">{submitError}</p>
              )}
              <button
                onClick={() => void handleSubmit()}
                disabled={submitting}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {submitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Criando…</>
                ) : (
                  "✓ Criar Pedido"
                )}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite ou cole o pedido aqui…"
              rows={1}
              disabled={loading || submitting}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-brown transition-colors resize-none leading-relaxed disabled:opacity-50 max-h-32 overflow-y-auto"
              style={{ fieldSizing: "content" } as React.CSSProperties}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || loading || submitting}
              className="bg-brand-brown text-white p-2.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1.5 text-center">Enter para enviar · Shift+Enter para nova linha</p>
        </div>
      </div>
    </div>
  );
}
