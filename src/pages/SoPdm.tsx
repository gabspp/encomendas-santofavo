import { useMemo } from "react";
import { useOrdersRange } from "@/hooks/useOrdersRange";
import { FilterBar } from "@/components/orders/FilterBar";
import { DaySection } from "@/components/orders/DaySection";
import { formatBrDateWithDay } from "@/utils/notion";
import type { ParsedOrder } from "@/types";
import { RefreshCw } from "lucide-react";

function getBrazilToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(new Date());
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// PDM individual products (excluindo "PDM Avulso" que é fórmula)
const PDM_PRODUCTS = [
  "🟫 PDM DLN",
  "🟥 PDM CAR",
  "🟨 PDM MAR",
  "⬛️ PDM CAJU",
  "🟦 PDM SR",
  "🟧 PDM LAR",
  "⬜️ PDM MÊS",
  "PDM DL Sem",
];

const PDM_PRODUCT_SET = new Set(PDM_PRODUCTS);

function isPdmOrder(order: ParsedOrder): boolean {
  return order.products.some((p) => PDM_PRODUCT_SET.has(p.name));
}

function summarizePdm(orders: ParsedOrder[]): { name: string; qty: number }[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    for (const product of order.products) {
      if (PDM_PRODUCT_SET.has(product.name)) {
        totals.set(product.name, (totals.get(product.name) ?? 0) + product.qty);
      }
    }
  }
  return PDM_PRODUCTS.filter((name) => (totals.get(name) ?? 0) > 0).map(
    (name) => ({ name, qty: totals.get(name)! })
  );
}

// Extract short flavor name from PDM product name
function shortPdmName(name: string): string {
  // "🟥 PDM CAR" → "CAR", "PDM DL Sem" → "DL Sem"
  const match = name.match(/PDM\s+(.+)$/);
  return match ? match[1] : name;
}

interface PdmDaySectionProps {
  date: string;
  orders: ParsedOrder[];
  onStatusChange: Parameters<typeof DaySection>[0]["onStatusChange"];
  onEntregaChange: Parameters<typeof DaySection>[0]["onEntregaChange"];
  onDateChange: Parameters<typeof DaySection>[0]["onDateChange"];
}

function PdmDaySection({ date, orders, onStatusChange, onEntregaChange, onDateChange }: PdmDaySectionProps) {
  const summary = useMemo(() => summarizePdm(orders), [orders]);
  const totalPdm = summary.reduce((sum, s) => sum + s.qty, 0);

  return (
    <div className="space-y-3">
      {/* Day header */}
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          {formatBrDateWithDay(date).toUpperCase()}
        </h2>
        <span className="bg-brand-yellow text-brand-brown text-xs font-bold px-2.5 py-0.5 rounded-full">
          {orders.length} {orders.length === 1 ? "pedido" : "pedidos"}
        </span>
      </div>

      {/* Summary card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🍫</span>
          <span className="font-bold text-amber-800">
            {totalPdm} {totalPdm === 1 ? "pão de mel" : "pães de mel"} no total
          </span>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {summary.map((item) => (
            <div key={item.name} className="flex items-center gap-1 text-sm text-amber-700">
              <span className="font-semibold">{item.qty}×</span>
              <span>{shortPdmName(item.name)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual order cards */}
      <DaySection
        title=""
        orders={orders}
        emptyMessage="Nenhum pedido de PDM para esta data."
        onStatusChange={onStatusChange}
        onEntregaChange={onEntregaChange}
        onDateChange={onDateChange}
      />
    </div>
  );
}

export default function SoPdm() {
  const today = useMemo(() => getBrazilToday(), []);
  const endDate = useMemo(() => addDays(today, 60), [today]);

  const {
    filteredOrders,
    loading,
    error,
    lastFetched,
    filters,
    setFilters,
    refresh,
    updateOrderStatus,
    updateOrderEntrega,
    updateOrderDate,
  } = useOrdersRange({
    startDate: today,
    endDate,
    defaultDateField: "producao",
  });

  // Filter to only PDM orders
  const pdmOrders = useMemo(
    () => filteredOrders.filter(isPdmOrder),
    [filteredOrders]
  );

  // Group by selected date field
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ParsedOrder[]>();
    for (const order of pdmOrders) {
      const date =
        filters.dateField === "producao" ? order.dataProducao : order.dataEntrega;
      if (!date) continue;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(order);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, orders]) => ({ date, orders }));
  }, [pdmOrders, filters.dateField]);

  const viewLabel = filters.dateField === "producao" ? "produção" : "entrega";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-brown">Só Pães de Mel</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pedidos com PDM por data de {viewLabel} · próximos 60 dias
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          disabled={loading}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-50 cursor-pointer"
          title="Atualizar agora"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {lastFetched && (
            <span className="text-xs text-gray-400">
              {lastFetched.toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </button>
      </div>

      {/* Filter bar — sem categoria (já filtrado para PDM) */}
      <FilterBar filters={filters} onChange={setFilters} showCategoria={false} />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando pedidos...</span>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-3">
          <span><strong>Erro:</strong> {error}</span>
          <button onClick={() => void refresh()} className="underline cursor-pointer">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Day sections */}
      {!loading && !error && (
        <div className="space-y-10">
          {groupedByDate.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              Nenhum pedido de PDM encontrado nos próximos 60 dias.
            </p>
          ) : (
            groupedByDate.map((group) => (
              <PdmDaySection
                key={group.date}
                date={group.date}
                orders={group.orders}
                onStatusChange={updateOrderStatus}
                onEntregaChange={updateOrderEntrega}
                onDateChange={updateOrderDate}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
