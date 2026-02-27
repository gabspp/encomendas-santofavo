import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { X, Send, Loader2, CalendarDays } from "lucide-react";
import { formatBrDateWithDay } from "@/utils/notion";

// ── Types ─────────────────────────────────────────────────────────────────────

type FlowStep = "atendente" | "tipo" | "loja" | "cliente" | "data" | "freeform";

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

// ── Domain constants ───────────────────────────────────────────────────────────

const ATENDENTES = ["Raissa", "Gabriel", "Maria", "Thamiris", "Karla", "Elen", "Carol"];

// ── Helpers ───────────────────────────────────────────────────────────────────

const INITIAL_BOT_MESSAGE = "Olá! Quem está atendendo?";

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

/** Detects a full pasted order (multi-line or very long) to skip guided steps */
function isFullOrderPaste(text: string): boolean {
  return text.includes("\n") || text.length > 80;
}

interface QuickDate {
  label: string;
  iso: string;
  shortDate: string;
}

function getQuickDates(): QuickDate[] {
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
  const [y, m, d] = todayStr.split("-").map(Number);

  const make = (offset: number, label: string): QuickDate => {
    const dt = new Date(y, m - 1, d + offset);
    const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
    const shortDate = `${String(dt.getDate()).padStart(2, "0")}/${String(dt.getMonth() + 1).padStart(2, "0")}`;
    return { label, iso, shortDate };
  };

  const results: QuickDate[] = [make(1, "Amanhã")];

  for (let i = 2; i <= 9; i++) {
    const dt = new Date(y, m - 1, d + i);
    const dow = dt.getDay();
    if (dow === 5 && results.length < 4) results.push(make(i, "Sexta"));
    if (dow === 6 && results.length < 4) results.push(make(i, "Sábado"));
    if (dow === 0 && results.length < 4) {
      results.push(make(i, "Domingo"));
      break;
    }
  }

  return results;
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

// ── Inline Date Picker (shown in chat) ────────────────────────────────────────

interface DatePickerCardProps {
  onSelect: (iso: string, label: string) => void;
  disabled: boolean;
}

function DatePickerCard({ onSelect, disabled }: DatePickerCardProps) {
  const quickDates = useMemo(() => getQuickDates(), []);

  function handleNativePick(e: React.ChangeEvent<HTMLInputElement>) {
    const iso = e.target.value;
    if (!iso) return;
    const [y, m, d] = iso.split("-");
    e.target.value = "";
    onSelect(iso, `${d}/${m}/${y}`);
  }

  const pillCls =
    "flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-full border border-gray-200 bg-white text-gray-700 hover:border-brand-brown hover:text-brand-brown transition-colors cursor-pointer disabled:opacity-40";

  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm max-w-[85%] space-y-2.5">
        <p className="text-sm text-gray-700 font-medium">Quando é a entrega?</p>
        <div className="flex flex-wrap gap-1.5">
          {quickDates.map((qd) => (
            <button
              key={qd.iso}
              onClick={() => onSelect(qd.iso, qd.label)}
              disabled={disabled}
              className={pillCls}
            >
              <span className="font-semibold">{qd.label}</span>
              <span className="text-gray-400">{qd.shortDate}</span>
            </button>
          ))}
          <label className={`${pillCls}`}>
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Outra data</span>
            <input
              type="date"
              className="sr-only"
              onChange={handleNativePick}
              disabled={disabled}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

// ── Step Chips (shown at bottom of modal) ─────────────────────────────────────

interface StepChipsProps {
  step: FlowStep;
  selectedTipo: "Entrega" | "Retirada" | null;
  disabled: boolean;
  onSend: (value: string) => void;
  onSelectTipo: (tipo: "Entrega" | "Retirada") => void;
}

function StepChips({ step, selectedTipo, disabled, onSend, onSelectTipo }: StepChipsProps) {
  const pill =
    "px-3 py-1.5 text-xs font-medium rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed bg-brand-cream border border-brand-brown/30 text-brand-brown hover:bg-brand-yellow/40";

  if (step === "atendente") {
    return (
      <div className="px-4 pt-2 pb-2 shrink-0 border-t border-gray-100">
        <div className="flex flex-wrap gap-1.5">
          {ATENDENTES.map((name) => (
            <button key={name} onClick={() => onSend(name)} disabled={disabled} className={pill}>
              {name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === "tipo") {
    return (
      <div className="px-4 pt-2 pb-2 shrink-0 border-t border-gray-100">
        <div className="flex gap-1.5">
          <button onClick={() => onSelectTipo("Entrega")} disabled={disabled} className={pill}>
            🚚 Entrega
          </button>
          <button onClick={() => onSelectTipo("Retirada")} disabled={disabled} className={pill}>
            🏪 Retirada
          </button>
        </div>
      </div>
    );
  }

  if (step === "loja" && selectedTipo) {
    return (
      <div className="px-4 pt-2 pb-2 shrink-0 border-t border-gray-100">
        <p className="text-[10px] text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">
          {selectedTipo} →
        </p>
        <div className="flex gap-1.5">
          <button
            onClick={() => onSend(`${selectedTipo} 26`)}
            disabled={disabled}
            className={pill}
          >
            Loja 26
          </button>
          <button
            onClick={() => onSend(`${selectedTipo} 248`)}
            disabled={disabled}
            className={pill}
          >
            Loja 248
          </button>
        </div>
      </div>
    );
  }

  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ChatOrderModal({ onClose, onCreated }: ChatOrderModalProps) {
  const [step, setStep] = useState<FlowStep>("atendente");
  const [selectedTipo, setSelectedTipo] = useState<"Entrega" | "Retirada" | null>(null);
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

  function autoResizeTextarea(ta: HTMLTextAreaElement) {
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`;
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    autoResizeTextarea(e.target);
  }

  // ── Local step helpers (no API call) ────────────────────────────────────────

  const advanceLocally = useCallback((
    userText: string,
    nextStep: FlowStep,
    botReply: string,
    draftUpdate?: Partial<DraftState>,
  ) => {
    if (draftUpdate) {
      setDraft((prev) => {
        const merged = { ...prev, ...draftUpdate };
        setReady(isReady(merged));
        return merged;
      });
    }
    setMessages((prev) => [
      ...prev,
      { role: "user", content: userText },
      { role: "bot", content: botReply },
    ]);
    setStep(nextStep);
  }, []);

  // Called when user clicks Entrega/Retirada chip
  function handleSelectTipo(tipo: "Entrega" | "Retirada") {
    setSelectedTipo(tipo);
    setMessages((prev) => [
      ...prev,
      { role: "user", content: tipo === "Entrega" ? "🚚 Entrega" : "🏪 Retirada" },
      { role: "bot", content: "Para qual loja?" },
    ]);
    setStep("loja");
  }

  // Called when user picks a date from the inline date picker
  function handleDateSelect(iso: string, label: string) {
    void label; // used as display below
    const [yy, mm, dd] = iso.split("-");
    const display = `${dd}/${mm}/${yy}`;
    const dataProducao = calcProducao(iso);

    setDraft((prev) => {
      const merged = { ...prev, dataEntrega: iso, dataProducao };
      setReady(isReady(merged));
      return merged;
    });
    setMessages((prev) => [
      ...prev,
      { role: "user", content: display },
      { role: "bot", content: "Ótimo! Quais produtos? (Pode colar o pedido completo do WhatsApp)" },
    ]);
    setStep("freeform");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  // ── API call ────────────────────────────────────────────────────────────────

  const callApi = useCallback(async (updatedMessages: ChatMessage[], currentDraft: DraftState) => {
    setLoading(true);
    try {
      const apiMessages = updatedMessages.map((m) => ({
        role: m.role === "bot" ? "assistant" : "user",
        content: m.content,
      }));

      const res = await fetch("/api/chat-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, draft: currentDraft, metodoOptions }),
      });

      if (!res.ok) throw new Error("Erro na API");

      const data = await res.json() as {
        message: string;
        draftUpdates: Partial<DraftState>;
        ready: boolean;
      };

      setDraft((prev) => {
        const merged: DraftState = {
          ...prev,
          ...data.draftUpdates,
          products: {
            ...(prev.products ?? {}),
            ...(data.draftUpdates.products ?? {}),
          },
        };
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
  }, [metodoOptions]);

  // ── Main send handler ────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    if (!text) {
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "auto";
    }

    // If user pastes a full order text from any guided step, jump straight to freeform
    if (step !== "freeform" && step !== "data" && isFullOrderPaste(content)) {
      const userMsg: ChatMessage = { role: "user", content };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setStep("freeform");
      await callApi(updated, draft);
      return;
    }

    // ── Guided steps (no API) ────────────────────────────────────────────────
    if (step === "atendente") {
      const matched =
        ATENDENTES.find((a) => a.toLowerCase() === content.toLowerCase()) ?? content;
      advanceLocally(content, "tipo", "É entrega ou retirada?", { atendente: matched });
      return;
    }

    if (step === "tipo") {
      const lower = content.toLowerCase();
      if (/entrega/.test(lower)) {
        setSelectedTipo("Entrega");
        advanceLocally(content, "loja", "Para qual loja?");
      } else if (/retir/.test(lower)) {
        setSelectedTipo("Retirada");
        advanceLocally(content, "loja", "Para qual loja?");
      } else {
        // Can't parse — nudge user to use chips
        setMessages((prev) => [
          ...prev,
          { role: "user", content },
          { role: "bot", content: "Usa os botões: é entrega ou retirada? 👆" },
        ]);
      }
      return;
    }

    if (step === "loja") {
      const loja = content.includes("248") ? "248" : "26";
      const entrega = `${selectedTipo ?? "Entrega"} ${loja}`;
      advanceLocally(content, "cliente", "Qual o nome do cliente?", { entrega });
      return;
    }

    if (step === "cliente") {
      advanceLocally(content, "data", "Qual a data de entrega?", { cliente: content });
      return;
    }

    // ── Data step: user typed a date instead of using the picker ────────────
    if (step === "data") {
      const userMsg: ChatMessage = { role: "user", content };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setStep("freeform");
      await callApi(updated, draft);
      return;
    }

    // ── Freeform: call LLM ───────────────────────────────────────────────────
    const userMsg: ChatMessage = { role: "user", content };
    const updated = [...messages, userMsg];
    setMessages(updated);
    await callApi(updated, draft);
  }, [input, loading, messages, draft, step, selectedTipo, callApi, advanceLocally]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
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

  const chipsDisabled = loading || submitting;
  // Disable text input during steps where chips are the primary interaction
  const inputDisabled = loading || submitting || step === "tipo" || step === "loja";

  const inputPlaceholder =
    step === "atendente" ? "Ou digita o nome do atendente…" :
    step === "tipo" || step === "loja" ? "Usa os botões acima…" :
    step === "cliente" ? "Nome do cliente…" :
    step === "data" ? "Ou digita a data (ex: 28/02)…" :
    "Digite ou cole o pedido aqui…";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ height: "min(90vh, 680px)" }}
      >
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

          {/* Inline date picker on "data" step */}
          {step === "data" && !loading && (
            <DatePickerCard onSelect={handleDateSelect} disabled={submitting} />
          )}

          {/* Preview + submit when all required fields are collected */}
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

        {/* Step chips */}
        <StepChips
          step={step}
          selectedTipo={selectedTipo}
          disabled={chipsDisabled}
          onSend={(value) => void sendMessage(value)}
          onSelectTipo={handleSelectTipo}
        />

        {/* Text input */}
        <div className="border-t border-gray-100 px-4 py-3 shrink-0">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={inputPlaceholder}
              rows={1}
              disabled={inputDisabled}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-brand-brown transition-colors resize-none leading-relaxed disabled:opacity-40 overflow-y-auto"
              style={{ maxHeight: "128px" }}
            />
            <button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || inputDisabled}
              className="bg-brand-brown text-white p-2.5 rounded-xl hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          {step !== "tipo" && step !== "loja" && (
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
