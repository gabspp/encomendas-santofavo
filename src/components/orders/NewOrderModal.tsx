import { useState, useEffect } from "react";
import { X, ChevronRight, ChevronLeft, Loader2, Info } from "lucide-react";
import type { NewOrderDraft } from "@/types";
import { formatBrDateWithDay } from "@/utils/notion";

// ── Constants ─────────────────────────────────────────────────────────────────

const ATENDENTES = ["Raissa", "Gabriel", "Maria", "Thamiris", "Karla", "Elen", "Carol"];
const ENTREGA_OPTIONS = ["Entrega 26", "Retirada 26", "Entrega 248", "Retirada 248"] as const;

// Exact Notion column names (including spaces where they exist in Notion)
const PDM_FIELDS = [
  "🟫 PDM DLN",
  "🟥 PDM CAR",
  "🟨 PDM MAR",
  "⬛️ PDM CAJU",
  "🟦 PDM SR",
  "🟧 PDM LAR",
  "⬜️ PDM MÊS",
  "PDM DL Sem",
] as const;

const BOLO_FIELDS = [
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
] as const;

const OUTROS_FIELDS = [
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
] as const;

const PASCOA_FIELDS = [
  " ⚪️ Ovo Casca Car",
  " 🔴 Ovo PDM CAR",
  "⚫️ Ovo Fudge",
  "🟠 Ovo Casca Caju Lar",
  "🟡 Ovo PDM DLN",
  "🟤 Ovo Amendoim ",
  " 🔷️ Barra Caju",
  "🔺️ Barra Car",
] as const;

const TABS = [
  { key: "PDM" as const,    fields: PDM_FIELDS },
  { key: "Bolos" as const,  fields: BOLO_FIELDS },
  { key: "Outros" as const, fields: OUTROS_FIELDS },
  { key: "Páscoa" as const, fields: PASCOA_FIELDS },
];

const BLANK_DRAFT: NewOrderDraft = {
  atendente: "",
  cliente: "",
  telefone: "",
  cep: "",
  endereco: "",
  dataEntrega: "",
  dataProducao: "",
  entrega: "",
  metodoPagamento: "",
  taxaEntrega: "",
  products: {},
  observacao: "",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcProducao(entregaISO: string): string {
  const [y, m, d] = entregaISO.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Monday (1) → produce Saturday (−2). All other days → day before (−1).
  const daysBack = date.getDay() === 1 ? 2 : 1;
  const prod = new Date(y, m - 1, d - daysBack);
  return [
    prod.getFullYear(),
    String(prod.getMonth() + 1).padStart(2, "0"),
    String(prod.getDate()).padStart(2, "0"),
  ].join("-");
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-brown transition-colors";
const labelCls = "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

// ── Step 1: Cliente ───────────────────────────────────────────────────────────

interface StepClienteProps {
  draft: NewOrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<NewOrderDraft>>;
  onCepBlur: () => void;
  cepLoading: boolean;
}

function StepCliente({ draft, setDraft, onCepBlur, cepLoading }: StepClienteProps) {
  return (
    <div className="space-y-4">
      {/* Atendente */}
      <div>
        <p className={labelCls}>Atendente *</p>
        <div className="flex flex-wrap gap-2">
          {ATENDENTES.map((a) => (
            <button
              key={a}
              onClick={() => setDraft((d) => ({ ...d, atendente: a }))}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
                draft.atendente === a
                  ? "bg-brand-brown text-white font-semibold"
                  : "border border-gray-200 text-gray-700 hover:border-gray-300 hover:text-gray-900"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Nome */}
      <div>
        <label className={labelCls}>Nome do cliente *</label>
        <input
          type="text"
          value={draft.cliente}
          onChange={(e) => setDraft((d) => ({ ...d, cliente: e.target.value }))}
          className={inputCls}
          placeholder="Nome do cliente"
          autoFocus
        />
      </div>

      {/* Telefone */}
      <div>
        <label className={labelCls}>Telefone</label>
        <input
          type="tel"
          value={draft.telefone}
          onChange={(e) => setDraft((d) => ({ ...d, telefone: e.target.value }))}
          className={inputCls}
          placeholder="(11) 99999-9999"
        />
      </div>

      {/* CEP */}
      <div>
        <label className={labelCls}>CEP</label>
        <div className="relative">
          <input
            type="text"
            value={draft.cep}
            onChange={(e) => setDraft((d) => ({ ...d, cep: e.target.value }))}
            onBlur={onCepBlur}
            className={`${inputCls} pr-8`}
            placeholder="00000-000"
            maxLength={9}
          />
          {cepLoading && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">Preenche o endereço automaticamente ao sair do campo.</p>
      </div>

      {/* Endereço */}
      <div>
        <label className={labelCls}>Endereço</label>
        <input
          type="text"
          value={draft.endereco}
          onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
          className={inputCls}
          placeholder="Rua, número, complemento — Bairro"
        />
      </div>
    </div>
  );
}

// ── Step 2: Pedido ────────────────────────────────────────────────────────────

interface StepPedidoProps {
  draft: NewOrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<NewOrderDraft>>;
  metodoOptions: string[];
  onEntregaDateChange: (val: string) => void;
}

function StepPedido({ draft, setDraft, metodoOptions, onEntregaDateChange }: StepPedidoProps) {
  return (
    <div className="space-y-4">
      {/* Data de Entrega */}
      <div>
        <label className={labelCls}>Data de entrega *</label>
        <input
          type="date"
          value={draft.dataEntrega}
          onChange={(e) => onEntregaDateChange(e.target.value)}
          className={inputCls}
        />
      </div>

      {/* Data de Produção */}
      <div>
        <label className={labelCls}>Data de produção *</label>
        <input
          type="date"
          value={draft.dataProducao}
          onChange={(e) => setDraft((d) => ({ ...d, dataProducao: e.target.value }))}
          className={inputCls}
        />
        <p className="text-xs text-gray-400 mt-1">
          Calculado automaticamente (dia anterior, ou sábado se entrega for segunda). Edite se necessário.
        </p>
      </div>

      {/* Tipo de saída */}
      <div>
        <p className={labelCls}>Tipo de saída *</p>
        <div className="grid grid-cols-2 gap-2">
          {ENTREGA_OPTIONS.map((opt) => {
            const loja = opt.includes("248") ? "248" : "26";
            const lojaClass = loja === "248" ? "text-brand-brown font-bold" : "text-brand-yellow font-bold";
            const selected = draft.entrega === opt;
            return (
              <button
                key={opt}
                onClick={() => setDraft((d) => ({ ...d, entrega: opt }))}
                className={`px-3 py-2.5 rounded-lg text-sm border text-left transition-colors cursor-pointer ${
                  selected
                    ? "bg-brand-brown text-white border-brand-brown"
                    : "border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {opt.startsWith("Entrega") ? "Entrega" : "Retirada"}{" "}
                <span className={selected ? "font-bold" : lojaClass}>{loja}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Método de Pagamento */}
      <div>
        <label className={labelCls}>Método de pagamento *</label>
        <select
          value={draft.metodoPagamento}
          onChange={(e) => setDraft((d) => ({ ...d, metodoPagamento: e.target.value }))}
          className={inputCls}
        >
          <option value="">Selecione...</option>
          {metodoOptions.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Taxa de Entrega */}
      <div>
        <label className={labelCls}>Taxa de entrega (R$)</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={draft.taxaEntrega}
          onChange={(e) => setDraft((d) => ({ ...d, taxaEntrega: e.target.value }))}
          className={inputCls}
          placeholder="0,00"
        />
      </div>
    </div>
  );
}

// ── Step 3: Produtos ──────────────────────────────────────────────────────────

type TabKey = "PDM" | "Bolos" | "Outros" | "Páscoa";

interface StepProdutosProps {
  draft: NewOrderDraft;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  setQty: (field: string, qty: number) => void;
}

function StepProdutos({ draft, activeTab, setActiveTab, setQty }: StepProdutosProps) {
  const currentFields = TABS.find((t) => t.key === activeTab)?.fields ?? [];

  const pdmTotal = PDM_FIELDS.reduce((sum, f) => sum + (draft.products[f] ?? 0), 0);

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex gap-1.5">
        {TABS.map((tab) => {
          const tabTotal = tab.fields.reduce((s, f) => s + (draft.products[f] ?? 0), 0);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                active
                  ? "bg-brand-brown text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.key}
              {tabTotal > 0 && (
                <span className={`ml-1 ${active ? "text-brand-yellow" : "text-brand-brown"}`}>
                  ({tabTotal})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Product rows */}
      <div className="space-y-1">
        {(currentFields as readonly string[]).map((field) => {
          const qty = draft.products[field] ?? 0;
          return (
            <div key={field} className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-700 flex-1 mr-4">{field.trim()}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => setQty(field, qty - 1)}
                  disabled={qty === 0}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed transition-colors"
                >
                  −
                </button>
                <span className={`w-6 text-center text-sm font-medium ${qty > 0 ? "text-brand-brown" : "text-gray-400"}`}>
                  {qty}
                </span>
                <button
                  onClick={() => setQty(field, qty + 1)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer transition-colors"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* PDM total */}
      {activeTab === "PDM" && pdmTotal > 0 && (
        <div className="border-t border-gray-100 pt-2 text-sm font-semibold text-gray-700">
          Total PDM: <span className="text-brand-brown">{pdmTotal}</span>
        </div>
      )}
    </div>
  );
}

// ── Step 4: Revisão ───────────────────────────────────────────────────────────

const ALL_FIELDS: readonly string[] = [...PDM_FIELDS, ...BOLO_FIELDS, ...OUTROS_FIELDS, ...PASCOA_FIELDS];

interface StepRevisaoProps {
  draft: NewOrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<NewOrderDraft>>;
  submitError: string | null;
}

function StepRevisao({ draft, setDraft, submitError }: StepRevisaoProps) {
  const selectedProducts = ALL_FIELDS.filter((f) => (draft.products[f] ?? 0) > 0);
  const pdmTotal = PDM_FIELDS.reduce((sum, f) => sum + (draft.products[f] ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <Row label="Atendente" value={draft.atendente} />
        <Row label="Cliente" value={draft.cliente} />
        {draft.telefone && <Row label="Telefone" value={draft.telefone} />}
        {draft.endereco && <Row label="Endereço" value={draft.endereco} wrap />}
        <Row label="Data de entrega" value={formatBrDateWithDay(draft.dataEntrega)} />
        <Row label="Data de produção" value={formatBrDateWithDay(draft.dataProducao)} />
        <Row label="Saída" value={draft.entrega} />
        {draft.metodoPagamento && <Row label="Pagamento" value={draft.metodoPagamento} />}
        {draft.taxaEntrega && parseFloat(draft.taxaEntrega) > 0 && (
          <Row label="Taxa entrega" value={`R$ ${draft.taxaEntrega}`} />
        )}
      </div>

      {/* Products summary */}
      {selectedProducts.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Produtos</p>
          <div className="space-y-1">
            {selectedProducts.map((f) => (
              <div key={f} className="flex justify-between text-sm">
                <span className="text-gray-700">{f.trim()}</span>
                <span className="font-semibold text-brand-brown">{draft.products[f]}</span>
              </div>
            ))}
            {pdmTotal > 0 && (
              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1 mt-1">
                <span className="text-gray-600">Total PDM</span>
                <span className="text-brand-brown">{pdmTotal}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Observação */}
      <div>
        <label className={labelCls}>Observação</label>
        <textarea
          value={draft.observacao}
          onChange={(e) => setDraft((d) => ({ ...d, observacao: e.target.value }))}
          className={`${inputCls} resize-none h-20`}
          placeholder="Alguma observação sobre o pedido?"
        />
      </div>

      {/* Status notice */}
      <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-3 py-2.5 text-xs">
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>
          O pedido será criado com status <strong>Em aberto</strong>. Mude para{" "}
          <strong>Confirmado</strong> após o pagamento ser realizado.
        </span>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs">
          <strong>Erro:</strong> {submitError}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, wrap = false }: { label: string; value: string; wrap?: boolean }) {
  return (
    <div className={`flex ${wrap ? "flex-col gap-0.5" : "justify-between items-start"}`}>
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className={`font-medium text-gray-900 ${wrap ? "" : "text-right ml-4"}`}>{value}</span>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

interface NewOrderModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const STEP_LABELS = ["Cliente", "Pedido", "Produtos", "Revisão"];

export function NewOrderModal({ onClose, onCreated }: NewOrderModalProps) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<NewOrderDraft>(BLANK_DRAFT);
  const [metodoOptions, setMetodoOptions] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>("PDM");
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Fetch payment method options on mount
  useEffect(() => {
    fetch("/api/form-options")
      .then((r) => r.json())
      .then((data: { metodosPagamento?: string[] }) =>
        setMetodoOptions(data.metodosPagamento ?? [])
      )
      .catch(() => {});
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleEntregaDateChange(val: string) {
    const dataProducao = val ? calcProducao(val) : "";
    setDraft((d) => ({ ...d, dataEntrega: val, dataProducao }));
  }

  async function handleCepBlur() {
    const cep = draft.cep.replace(/\D/g, "");
    if (cep.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json() as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
      if (!data.erro && data.logradouro) {
        setDraft((d) => ({
          ...d,
          endereco: `${data.logradouro}, ${data.bairro} — ${data.localidade}/${data.uf}`,
        }));
      }
    } catch {
      // silently ignore
    } finally {
      setCepLoading(false);
    }
  }

  function setQty(field: string, qty: number) {
    setDraft((d) => ({
      ...d,
      products: { ...d.products, [field]: Math.max(0, qty) },
    }));
  }

  const totalItems = Object.values(draft.products).reduce((s, q) => s + q, 0);

  function canProceed(): boolean {
    if (step === 1) return !!draft.atendente && !!draft.cliente.trim();
    if (step === 2) return !!draft.dataEntrega && !!draft.dataProducao && !!draft.entrega && !!draft.metodoPagamento;
    if (step === 3) return totalItems > 0;
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onCreated();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Erro ao criar pedido");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-brand-brown">Novo Pedido</h2>
            <p className="text-xs text-gray-400">
              {STEP_LABELS[step - 1]} · Passo {step} de {STEP_LABELS.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-4 pb-1 shrink-0">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i < step ? "bg-brand-brown" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Step body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {step === 1 && (
            <StepCliente
              draft={draft}
              setDraft={setDraft}
              onCepBlur={handleCepBlur}
              cepLoading={cepLoading}
            />
          )}
          {step === 2 && (
            <StepPedido
              draft={draft}
              setDraft={setDraft}
              metodoOptions={metodoOptions}
              onEntregaDateChange={handleEntregaDateChange}
            />
          )}
          {step === 3 && (
            <StepProdutos
              draft={draft}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              setQty={setQty}
            />
          )}
          {step === 4 && (
            <StepRevisao
              draft={draft}
              setDraft={setDraft}
              submitError={submitError}
            />
          )}
        </div>

        {/* Footer navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 shrink-0">
          <button
            onClick={() => (step > 1 ? setStep((s) => s - 1) : onClose())}
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-4 w-4" />
            {step === 1 ? "Cancelar" : "Voltar"}
          </button>

          {step < STEP_LABELS.length ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex items-center gap-1 text-sm font-semibold bg-brand-brown text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity cursor-pointer disabled:cursor-not-allowed"
            >
              Próximo
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="flex items-center gap-2 text-sm font-semibold bg-brand-brown text-white px-4 py-2 rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar Pedido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
