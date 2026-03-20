import { useState, useEffect, useRef } from "react";
import { X, ChevronRight, ChevronLeft, Loader2, Info } from "lucide-react";
import type { BoxConfig, NewOrderDraft } from "@/types";
import { formatBrDateWithDay, buildCaixasStr, PDM_FLAVOR_FIELDS, PDM_SHORT } from "@/utils/notion";

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

type TabKey = "PDM" | "Bolos" | "Caixas" | "Outros" | "Páscoa";

const TABS: { key: TabKey; fields: readonly string[] }[] = [
  { key: "PDM",    fields: PDM_FIELDS },
  { key: "Bolos",  fields: BOLO_FIELDS },
  { key: "Caixas", fields: [] },
  { key: "Outros", fields: OUTROS_FIELDS },
  { key: "Páscoa", fields: PASCOA_FIELDS },
];

const BLANK_DRAFT: NewOrderDraft = {
  atendente: "",
  cliente: "",
  telefone: "",
  cep: "",
  endereco: "",
  numero: "",
  complemento: "",
  dataEntrega: "",
  dataProducao: "",
  horario: "",
  entrega: "",
  metodoPagamento: "",
  taxaEntrega: "",
  revenda: false,
  products: {},
  boxes: [],
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

      {/* Revenda toggle */}
      <div>
        <p className={labelCls}>Tipo de pedido</p>
        <button
          onClick={() => setDraft((d) => ({ ...d, revenda: !d.revenda }))}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors cursor-pointer w-full ${
            draft.revenda
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "border-gray-200 text-gray-500 hover:border-gray-300"
          }`}
        >
          <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${draft.revenda ? "bg-blue-600 border-blue-600" : "border-gray-300"}`}>
            {draft.revenda && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          Pedido de revenda
        </button>
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

      {/* Rua */}
      <div>
        <label className={labelCls}>Rua</label>
        <input
          type="text"
          value={draft.endereco}
          onChange={(e) => setDraft((d) => ({ ...d, endereco: e.target.value }))}
          className={inputCls}
          placeholder="Nome da rua"
        />
      </div>

      {/* Número + Complemento */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Número</label>
          <input
            type="text"
            value={draft.numero}
            onChange={(e) => setDraft((d) => ({ ...d, numero: e.target.value }))}
            className={inputCls}
            placeholder="123"
          />
        </div>
        <div>
          <label className={labelCls}>Complemento</label>
          <input
            type="text"
            value={draft.complemento}
            onChange={(e) => setDraft((d) => ({ ...d, complemento: e.target.value }))}
            className={inputCls}
            placeholder="Apto 4 (opcional)"
          />
        </div>
      </div>
    </div>
  );
}

// ── Step 2: Pedido ────────────────────────────────────────────────────────────

const HORARIO_CHIPS = ["8h", "9h", "10h", "11h", "12h", "13h", "14h", "15h", "16h", "17h", "18h", "19h"];

function chipToHorario(chip: string): string {
  return `${String(parseInt(chip, 10)).padStart(2, "0")}:00`;
}

function horarioToChip(horario: string): string | null {
  if (!horario) return null;
  const chip = `${parseInt(horario.split(":")[0], 10)}h`;
  return HORARIO_CHIPS.includes(chip) && horario.endsWith(":00") ? chip : null;
}

interface StepPedidoProps {
  draft: NewOrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<NewOrderDraft>>;
  metodoOptions: string[];
  onEntregaDateChange: (val: string) => void;
}

function StepPedido({ draft, setDraft, metodoOptions, onEntregaDateChange }: StepPedidoProps) {
  const [showCustomTime, setShowCustomTime] = useState(false);
  const timeRef = useRef<HTMLInputElement>(null);
  const activeChip = horarioToChip(draft.horario);

  function handleChipClick(chip: string) {
    setDraft((d) => ({ ...d, horario: chipToHorario(chip) }));
    setShowCustomTime(false);
  }

  function handleOutroClick() {
    setShowCustomTime(true);
    setTimeout(() => timeRef.current?.showPicker?.(), 50);
  }

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

      {/* Horário de entrega */}
      <div>
        <p className={labelCls}>
          Horário de entrega{" "}
          <span className="text-gray-400 font-normal normal-case tracking-normal">· opcional</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {HORARIO_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
                activeChip === chip
                  ? "bg-brand-brown text-white font-semibold"
                  : "border border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {chip}
            </button>
          ))}
          <button
            onClick={handleOutroClick}
            className={`px-3 py-1.5 rounded-full text-sm transition-colors cursor-pointer ${
              draft.horario && !activeChip
                ? "bg-brand-brown text-white font-semibold"
                : "border border-gray-200 text-gray-600 hover:border-gray-400"
            }`}
          >
            {draft.horario && !activeChip ? draft.horario : "Outro"}
          </button>
        </div>

        {showCustomTime && (
          <input
            ref={timeRef}
            type="time"
            value={draft.horario}
            onChange={(e) => setDraft((d) => ({ ...d, horario: e.target.value }))}
            onBlur={() => setShowCustomTime(false)}
            className={`${inputCls} mt-2`}
            autoFocus
          />
        )}

        {draft.horario && (
          <button
            onClick={() => { setDraft((d) => ({ ...d, horario: "" })); setShowCustomTime(false); }}
            className="text-xs text-gray-400 hover:text-gray-600 mt-1.5 cursor-pointer"
          >
            × Limpar
          </button>
        )}
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

// ── Box Editor ────────────────────────────────────────────────────────────────

const BOX_SIZES = [3, 6, 9, 15] as const;

interface BoxEditorProps {
  initial: BoxConfig;
  onSave: (box: BoxConfig) => void;
  onCancel: () => void;
}

function BoxEditor({ initial, onSave, onCancel }: BoxEditorProps) {
  const [box, setBox] = useState<BoxConfig>(initial);
  const total = Object.values(box.flavors).reduce((s, n) => s + n, 0);
  const remaining = box.size - total;

  function setFlavor(field: string, qty: number) {
    setBox((b) => ({ ...b, flavors: { ...b.flavors, [field]: Math.max(0, qty) } }));
  }

  const canSave = box.size > 0 && total === box.size;

  return (
    <div className="space-y-4">
      {/* Size selector */}
      <div>
        <p className={labelCls}>Tamanho da caixa</p>
        <div className="flex gap-2">
          {BOX_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setBox((b) => ({ ...b, size: s }))}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                box.size === s
                  ? "bg-brand-brown text-white border-brand-brown"
                  : "border-gray-200 text-gray-700 hover:border-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Flavor list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className={`${labelCls} mb-0`}>Sabores</p>
          <span className={`text-xs font-semibold ${
            total === box.size ? "text-green-600" : total > box.size ? "text-red-500" : "text-gray-400"
          }`}>
            {total} / {box.size}
            {remaining > 0 && <span className="font-normal text-gray-400 ml-1">(faltam {remaining})</span>}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-200 ${
              total > box.size ? "bg-red-400" : total === box.size ? "bg-green-500" : "bg-brand-brown"
            }`}
            style={{ width: `${Math.min(100, box.size > 0 ? (total / box.size) * 100 : 0)}%` }}
          />
        </div>

        <div className="space-y-1">
          {PDM_FLAVOR_FIELDS.map((field) => {
            const qty = box.flavors[field] ?? 0;
            return (
              <div key={field} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-700 flex-1 mr-4">{field.trim()}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setFlavor(field, qty - 1)}
                    disabled={qty === 0}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <span className={`w-8 text-center text-sm font-medium ${qty > 0 ? "text-brand-brown" : "text-gray-300"}`}>
                    {qty}
                  </span>
                  <button
                    onClick={() => setFlavor(field, qty + 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg cursor-pointer hover:border-gray-300 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(box)}
          disabled={!canSave}
          className="flex-1 py-2 text-sm font-semibold bg-brand-brown text-white rounded-lg disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          Salvar caixa
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Produtos ──────────────────────────────────────────────────────────

interface StepProdutosProps {
  draft: NewOrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<NewOrderDraft>>;
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  setQty: (field: string, qty: number) => void;
}

function StepProdutos({ draft, setDraft, activeTab, setActiveTab, setQty }: StepProdutosProps) {
  // "new" = BoxEditor for a new box; a UUID = BoxEditor to edit that box; null = list view
  const [editingBoxId, setEditingBoxId] = useState<string | null>(null);

  const currentFields = TABS.find((t) => t.key === activeTab)?.fields ?? [];
  const pdmTotal = PDM_FIELDS.reduce((sum, f) => sum + (draft.products[f] ?? 0), 0);

  function saveBox(box: BoxConfig) {
    if (box.id === "") {
      // New box
      const newBox = { ...box, id: crypto.randomUUID() };
      setDraft((d) => ({ ...d, boxes: [...d.boxes, newBox] }));
    } else {
      // Edit existing
      setDraft((d) => ({ ...d, boxes: d.boxes.map((b) => (b.id === box.id ? box : b)) }));
    }
    setEditingBoxId(null);
  }

  function updateBoxQty(id: string, qty: number) {
    if (qty < 1) return;
    setDraft((d) => ({ ...d, boxes: d.boxes.map((b) => (b.id === id ? { ...b, quantity: qty } : b)) }));
  }

  function removeBox(id: string) {
    setDraft((d) => ({ ...d, boxes: d.boxes.filter((b) => b.id !== id) }));
  }

  const editingBox = editingBoxId === "new"
    ? { id: "", size: 6 as const, flavors: {}, quantity: 1 }
    : draft.boxes.find((b) => b.id === editingBoxId) ?? null;

  return (
    <div className="space-y-3">
      {/* Category tabs */}
      <div className="flex gap-1">
        {TABS.map((tab) => {
          const tabTotal =
            tab.key === "Caixas"
              ? draft.boxes.reduce((s, b) => s + b.quantity, 0)
              : tab.fields.reduce((s, f) => s + (draft.products[f] ?? 0), 0);
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setEditingBoxId(null); }}
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

      {/* Caixas tab */}
      {activeTab === "Caixas" && (
        editingBox ? (
          <BoxEditor
            initial={editingBox}
            onSave={saveBox}
            onCancel={() => setEditingBoxId(null)}
          />
        ) : (
          <div className="space-y-2">
            {draft.boxes.map((box) => {
              const flavorsStr = Object.entries(box.flavors)
                .filter(([, q]) => q > 0)
                .map(([f, q]) => `${PDM_SHORT[f] ?? f.trim()}×${q}`)
                .join(" ");
              return (
                <div key={box.id} className="border border-gray-200 rounded-lg px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800">Caixa {box.size}</p>
                      <p className="text-xs text-gray-500 mt-0.5 break-words">{flavorsStr}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => updateBoxQty(box.id, box.quantity - 1)}
                        disabled={box.quantity <= 1}
                        className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed transition-colors"
                      >
                        −
                      </button>
                      <span className="text-sm font-semibold text-brand-brown w-6 text-center">
                        {box.quantity}
                      </span>
                      <button
                        onClick={() => updateBoxQty(box.id, box.quantity + 1)}
                        className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer transition-colors"
                      >
                        +
                      </button>
                      <button
                        onClick={() => setEditingBoxId(box.id)}
                        className="ml-1 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-brand-brown cursor-pointer transition-colors text-base"
                        title="Editar"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => removeBox(box.id)}
                        className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 cursor-pointer transition-colors text-lg leading-none"
                        title="Remover"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            <button
              onClick={() => setEditingBoxId("new")}
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-brand-brown hover:text-brand-brown transition-colors cursor-pointer"
            >
              + Adicionar Caixa
            </button>
          </div>
        )
      )}

      {/* Regular product rows (non-Caixas tabs) */}
      {activeTab !== "Caixas" && (
        <>
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
                    <input
                      type="number"
                      min="0"
                      value={qty === 0 ? "" : qty}
                      onChange={(e) => setQty(field, parseInt(e.target.value, 10) || 0)}
                      className={`w-10 text-center text-sm font-medium border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown transition-colors ${qty > 0 ? "text-brand-brown" : "text-gray-400"}`}
                      placeholder="0"
                    />
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
        </>
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

  // Compute total PDM units inside boxes (by flavor)
  const pdmInBoxes: Record<string, number> = {};
  for (const box of draft.boxes) {
    for (const [f, qty] of Object.entries(box.flavors)) {
      if (qty > 0) pdmInBoxes[f] = (pdmInBoxes[f] ?? 0) + qty * box.quantity;
    }
  }
  const totalPdmInBoxes = Object.values(pdmInBoxes).reduce((s, n) => s + n, 0);

  return (
    <div className="space-y-4">
      {/* Summary card */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <Row label="Atendente" value={draft.atendente} />
        {draft.revenda && <Row label="Tipo" value="Revenda" />}
        <Row label="Cliente" value={draft.cliente} />
        {draft.telefone && <Row label="Telefone" value={draft.telefone} />}
        {(draft.endereco || draft.numero) && (
          <Row
            label="Endereço"
            value={[draft.endereco, draft.numero, draft.complemento].filter(Boolean).join(", ")}
            wrap
          />
        )}
        <Row label="Data de entrega" value={formatBrDateWithDay(draft.dataEntrega)} />
        <Row label="Data de produção" value={formatBrDateWithDay(draft.dataProducao)} />
        {draft.horario && <Row label="Horário" value={draft.horario} />}
        <Row label="Saída" value={draft.entrega} />
        {draft.metodoPagamento && <Row label="Pagamento" value={draft.metodoPagamento} />}
        {draft.taxaEntrega && parseFloat(draft.taxaEntrega) > 0 && (
          <Row label="Taxa entrega" value={`R$ ${draft.taxaEntrega}`} />
        )}
      </div>

      {/* Boxes summary */}
      {draft.boxes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Caixas</p>
          <div className="space-y-1">
            {draft.boxes.map((box) => {
              const flavorsStr = Object.entries(box.flavors)
                .filter(([, q]) => q > 0)
                .map(([f, q]) => `${PDM_SHORT[f] ?? f.trim()}×${q}`)
                .join(" ");
              return (
                <div key={box.id} className="flex justify-between text-sm gap-4">
                  <span className="text-gray-700 shrink-0">{box.quantity}× Caixa {box.size}</span>
                  <span className="text-gray-500 text-xs text-right">{flavorsStr}</span>
                </div>
              );
            })}
            {totalPdmInBoxes > 0 && (
              <div className="flex justify-between text-sm font-semibold border-t border-gray-100 pt-1 mt-1">
                <span className="text-gray-600">Total PDM nas caixas</span>
                <span className="text-brand-brown">{totalPdmInBoxes}</span>
              </div>
            )}
          </div>
        </div>
      )}

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
                <span className="text-gray-600">Total PDM avulso</span>
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
          endereco: data.logradouro ?? "",
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
  const totalBoxItems = draft.boxes.reduce((s, b) => s + b.quantity, 0);

  function canProceed(): boolean {
    if (step === 1) return !!draft.atendente && !!draft.cliente.trim();
    if (step === 2) return !!draft.dataEntrega && !!draft.dataProducao && !!draft.entrega && !!draft.metodoPagamento;
    if (step === 3) return totalItems > 0 || totalBoxItems > 0;
    return true;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const horarioPrefix = draft.horario ? `Horário: ${draft.horario}\n` : "";
      const caixasStr = buildCaixasStr(draft.boxes);
      const caixasPrefix = caixasStr ? `${caixasStr}\n` : "";
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          draft: {
            ...draft,
            // Combine address parts into a single string for the API
            endereco: [draft.endereco, draft.numero, draft.complemento]
              .filter((s) => s.trim())
              .join(", "),
            // Prepend horario + caixas composition to observacao
            observacao: horarioPrefix + caixasPrefix + draft.observacao,
          },
        }),
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
              setDraft={setDraft}
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
