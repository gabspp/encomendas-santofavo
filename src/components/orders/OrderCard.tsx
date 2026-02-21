import { useState, useRef, useEffect } from "react";
import type { ParsedOrder, ProductItem, OrderStatus } from "@/types";
import { formatBrDateWithDay } from "@/utils/notion";

// ── Status ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: OrderStatus[] = ["Em aberto", "Confirmado", "Pronto", "Entregue"];

const STATUS_STYLES: Record<string, string> = {
  "Em aberto": "bg-gray-100 text-gray-500",
  "Confirmado": "bg-blue-100 text-blue-700",
  "Pronto":     "bg-green-100 text-green-700",
  "Entregue":   "bg-gray-200 text-gray-400",
};

interface StatusDropdownProps {
  orderId: string;
  current: OrderStatus;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
}

function StatusDropdown({ orderId, current, onStatusChange }: StatusDropdownProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleSelect(status: OrderStatus) {
    if (status === current) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await onStatusChange(orderId, status);
    } catch {
      // erro já tratado no hook (rollback)
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`text-xs font-medium px-2 py-0.5 rounded-full transition-opacity cursor-pointer
          ${STATUS_STYLES[current] ?? "bg-gray-100 text-gray-500"}
          ${saving ? "opacity-50 cursor-wait" : "hover:opacity-80"}`}
      >
        {current || "—"}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-32">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSelect(s)}
              className={`w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 transition-colors
                ${s === current ? "font-semibold" : "font-normal"}`}
            >
              <span className={`inline-block px-1.5 py-0.5 rounded-full ${STATUS_STYLES[s]}`}>
                {s}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Entrega ───────────────────────────────────────────────────────────────────

const ENTREGA_OPTIONS = [
  "Entrega 26",
  "Retirada 26",
  "Entrega 248",
  "Retirada 248",
] as const;

type EntregaOption = typeof ENTREGA_OPTIONS[number];

interface EntregaDropdownProps {
  orderId: string;
  current: string;
  onEntregaChange: (orderId: string, entrega: string) => Promise<void>;
}

function EntregaDropdown({ orderId, current, onEntregaChange }: EntregaDropdownProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleSelect(entrega: EntregaOption) {
    if (entrega === current) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await onEntregaChange(orderId, entrega);
    } catch {
      // rollback feito no hook
    } finally {
      setSaving(false);
    }
  }

  // Extrai tipo e loja para exibição
  const isEnt = current.startsWith("Entrega");
  const lojaNum = current.includes("248") ? "248" : current.includes("26") ? "26" : "";
  const lojaClass = lojaNum === "248" ? "text-brand-brown" : "text-brand-yellow";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={saving}
        className={`text-sm font-semibold text-gray-800 text-right hover:opacity-70 transition-opacity cursor-pointer
          ${saving ? "opacity-50 cursor-wait" : ""}`}
      >
        {isEnt ? "Entrega" : "Retirada"}
        {lojaNum && <span className={`font-normal ml-1 ${lojaClass}`}>{lojaNum}</span>}
      </button>

      {open && (
        <div className="absolute right-0 mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-36">
          {ENTREGA_OPTIONS.map((opt) => {
            const optLoja = opt.includes("248") ? "248" : "26";
            const optLojaClass = optLoja === "248" ? "text-brand-brown font-bold" : "text-brand-yellow font-bold";
            return (
              <button
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`w-full text-left text-xs px-3 py-1.5 hover:bg-gray-50 transition-colors
                  ${opt === current ? "font-semibold bg-gray-50" : "font-normal"}`}
              >
                {opt.startsWith("Entrega") ? "Entrega" : "Retirada"}{" "}
                <span className={optLojaClass}>{optLoja}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Categoria (derivada do ícone do Notion) ──────────────────────────────────

interface CategoryDef { label: string; className: string }

const CATEGORY_MAP: Record<string, CategoryDef> = {
  "✔️": { label: "Pronto",       className: "bg-green-100 text-green-700" },
  "‼️": { label: "Atenção",      className: "bg-red-100 text-red-700" },
  "🔁": { label: "Revenda",      className: "bg-blue-100 text-blue-700" },
  "🎂": { label: "Bolo",         className: "bg-pink-100 text-pink-700" },
  "🐰": { label: "Páscoa",       className: "bg-yellow-100 text-yellow-800" },
  "🎅": { label: "Natal",        className: "bg-red-100 text-red-700" },
  "✡️": { label: "Rosh Hashaná", className: "bg-amber-100 text-amber-700" },
};

// ── Produtos: agrupamento e abreviação ───────────────────────────────────────

interface ShortItem { short: string; qty: number }

function stripLeadingNonAlpha(str: string): string {
  return str.replace(/^[^A-Za-zÀ-ÖØ-öø-ÿ]+/, "").trim();
}

function pdmFlavor(name: string): string {
  // "🟥 PDM CAR" → "Car" | "PDM Avulso" → "Avulso" | "PDM DL Sem" → "DL Sem"
  const match = name.match(/PDM\s+(.+)/);
  if (!match) return name;
  const flavor = match[1];
  // Title-case apenas palavras de 1 token (siglas ficam como estão se tiverem 2+ letras maiúsculas seguidas)
  return flavor
    .split(" ")
    .map((w) =>
      /^[A-ZÁÉÍÓÚ]{2,}$/.test(w)
        ? w.charAt(0) + w.slice(1).toLowerCase()
        : w
    )
    .join(" ");
}

function categorizeProducts(products: ProductItem[]): {
  pdm: ShortItem[];
  bolos: ShortItem[];
  outros: ShortItem[];
  pdmTotal: number;
} {
  const pdm: ShortItem[] = [];
  const bolos: ShortItem[] = [];
  const outros: ShortItem[] = [];
  let pdmTotal = 0;

  for (const item of products) {
    const name = item.name; // já vem trimado da API

    // "PDM Avulso" é a fórmula que soma todos os sabores — usamos como total, não exibimos
    if (name === "PDM Avulso") {
      pdmTotal = item.qty;
      continue;
    }

    if (name.startsWith("Bolo")) {
      // "Bolo PDM G" → "PDM G" | "Bolo de Mel Mini" → "Mel Mini"
      const short = name.replace(/^Bolo\s+(de\s+)?/i, "");
      bolos.push({ short, qty: item.qty });
    } else if (name.includes("PDM") && !name.includes("Ovo")) {
      pdm.push({ short: pdmFlavor(name), qty: item.qty });
    } else {
      outros.push({ short: stripLeadingNonAlpha(name), qty: item.qty });
    }
  }

  return { pdm, bolos, outros, pdmTotal };
}

// ── Component ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: ParsedOrder;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onEntregaChange: (orderId: string, entrega: string) => Promise<void>;
}

export function OrderCard({ order, onStatusChange, onEntregaChange }: OrderCardProps) {
  const category = CATEGORY_MAP[order.icon] ?? null;

  const { pdm, bolos, outros, pdmTotal } = categorizeProducts(order.products);
  const groups = [
    { label: "PDM",   items: pdm },
    { label: "Bolos", items: bolos },
    { label: "Outros", items: outros },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 p-4 pb-3">

        {/* Ícone (emoji do Notion) */}
        <div className="w-11 h-11 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center text-xl shrink-0 select-none">
          {order.icon || "🟢"}
        </div>

        {/* Nome + categoria */}
        <div className="flex-1 min-w-0 pt-0.5">
          <h3 className="font-bold text-gray-900 text-sm leading-tight truncate">
            {order.cliente || "—"}
          </h3>
          {category && (
            <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${category.className}`}>
              {category.label}
            </span>
          )}
        </div>

        {/* Entrega/Retirada | Loja + Status */}
        <div className="shrink-0 text-right pt-0.5 flex flex-col items-end gap-1">
          <EntregaDropdown
            orderId={order.id}
            current={order.entrega}
            onEntregaChange={onEntregaChange}
          />
          <StatusDropdown
            orderId={order.id}
            current={order.status}
            onStatusChange={onStatusChange}
          />
        </div>
      </div>

      {/* ── Datas ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 text-xs">
        <div className="px-4 py-2">
          <p className="text-gray-400 mb-0.5">Produção</p>
          <p className="font-medium text-gray-700">{formatBrDateWithDay(order.dataProducao)}</p>
        </div>
        <div className="px-4 py-2">
          <p className="text-gray-400 mb-0.5">Entrega</p>
          <p className="font-medium text-gray-700">{formatBrDateWithDay(order.dataEntrega) || "—"}</p>
        </div>
      </div>

      {/* ── Produtos ───────────────────────────────────────────────────── */}
      {order.products.length > 0 && (
        <div className="border-t border-gray-100 px-4 py-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            Produtos
          </p>
          <div
            className="grid gap-x-4 gap-y-0 text-xs"
            style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))` }}
          >
            {groups.map((group) => (
              <div key={group.label}>
                <p className="font-semibold text-gray-600 mb-1">{group.label}</p>
                {group.items.map((item) => (
                  <p key={item.short} className="text-gray-700 leading-relaxed">
                    {item.short}: <span className="font-medium">{item.qty}</span>
                  </p>
                ))}
              </div>
            ))}
          </div>
          {pdm.length > 0 && (
            <p className="mt-2 text-xs font-semibold text-gray-700 border-t border-gray-100 pt-2">
              Total PDM: {pdmTotal}
            </p>
          )}
        </div>
      )}

      {/* ── Observação ─────────────────────────────────────────────────── */}
      {order.observacao && (
        <div className="border-t border-orange-100 bg-orange-50 px-4 py-2 text-xs text-orange-800">
          <span className="font-semibold">Obs!</span> {order.observacao}
        </div>
      )}

      {/* ── Rodapé: telefone + endereço ────────────────────────────────── */}
      {(order.telefone || order.endereco) && (
        <div className="grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 text-xs text-gray-500">
          <div className="px-4 py-2">{order.telefone || "—"}</div>
          <div className="px-4 py-2">{order.endereco || "—"}</div>
        </div>
      )}
    </div>
  );
}
