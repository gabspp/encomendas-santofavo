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

// Páscoa products (trimmed names, matching what the API returns)
const OVO_PRODUCTS = [
  "⚪️ Ovo Casca Car",
  "🔴 Ovo PDM CAR",
  "⚫️ Ovo Fudge",
  "🟠 Ovo Casca Caju Lar",
  "🟡 Ovo PDM DLN",
  "🟤 Ovo Amendoim",
];

const BARRA_PRODUCTS = [
  "🔷️ Barra Caju",
  "🔺️ Barra Car",
];

const PASCOA_PRODUCTS = [...OVO_PRODUCTS, ...BARRA_PRODUCTS];
const PASCOA_SET = new Set(PASCOA_PRODUCTS);

function isPascoaOrder(order: ParsedOrder): boolean {
  return order.products.some((p) => PASCOA_SET.has(p.name));
}

interface Summary {
  ovos: { name: string; qty: number }[];
  barras: { name: string; qty: number }[];
  totalOvos: number;
  totalBarras: number;
}

function summarizePascoa(orders: ParsedOrder[]): Summary {
  const totals = new Map<string, number>();
  for (const order of orders) {
    for (const product of order.products) {
      if (PASCOA_SET.has(product.name)) {
        totals.set(product.name, (totals.get(product.name) ?? 0) + product.qty);
      }
    }
  }

  const ovos = OVO_PRODUCTS.filter((n) => (totals.get(n) ?? 0) > 0).map((name) => ({
    name,
    qty: totals.get(name)!,
  }));
  const barras = BARRA_PRODUCTS.filter((n) => (totals.get(n) ?? 0) > 0).map((name) => ({
    name,
    qty: totals.get(name)!,
  }));

  return {
    ovos,
    barras,
    totalOvos: ovos.reduce((s, x) => s + x.qty, 0),
    totalBarras: barras.reduce((s, x) => s + x.qty, 0),
  };
}

function shortOvoName(name: string): string {
  return name
    .replace("⚪️ Ovo Casca Car", "Casca Car")
    .replace("🔴 Ovo PDM CAR", "PDM Car")
    .replace("⚫️ Ovo Fudge", "Fudge")
    .replace("🟠 Ovo Casca Caju Lar", "Casca Caju/Lar")
    .replace("🟡 Ovo PDM DLN", "PDM DLN")
    .replace("🟤 Ovo Amendoim", "Amendoim");
}

function shortBarraName(name: string): string {
  return name
    .replace("🔷️ Barra Caju", "Caju")
    .replace("🔺️ Barra Car", "Caramelo");
}

interface PascoaDaySectionProps {
  date: string;
  orders: ParsedOrder[];
  onStatusChange: Parameters<typeof DaySection>[0]["onStatusChange"];
  onEntregaChange: Parameters<typeof DaySection>[0]["onEntregaChange"];
  onDateChange: Parameters<typeof DaySection>[0]["onDateChange"];
}

function PascoaDaySection({ date, orders, onStatusChange, onEntregaChange, onDateChange }: PascoaDaySectionProps) {
  const summary = useMemo(() => summarizePascoa(orders), [orders]);

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
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 space-y-3">
        {/* Ovos */}
        {summary.ovos.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">🐰</span>
              <span className="font-bold text-yellow-800">
                {summary.totalOvos} {summary.totalOvos === 1 ? "ovo" : "ovos"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {summary.ovos.map((item) => (
                <div key={item.name} className="flex items-center gap-1 text-sm text-yellow-700">
                  <span className="font-semibold">{item.qty}×</span>
                  <span>{shortOvoName(item.name)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Barras */}
        {summary.barras.length > 0 && (
          <div className={summary.ovos.length > 0 ? "border-t border-yellow-200 pt-2" : ""}>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">🍫</span>
              <span className="font-bold text-yellow-800">
                {summary.totalBarras} {summary.totalBarras === 1 ? "barra" : "barras"}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {summary.barras.map((item) => (
                <div key={item.name} className="flex items-center gap-1 text-sm text-yellow-700">
                  <span className="font-semibold">{item.qty}×</span>
                  <span>{shortBarraName(item.name)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Individual order cards */}
      <DaySection
        title=""
        orders={orders}
        emptyMessage="Nenhum pedido de Páscoa para esta data."
        onStatusChange={onStatusChange}
        onEntregaChange={onEntregaChange}
        onDateChange={onDateChange}
      />
    </div>
  );
}

export default function SoPascoa() {
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
    defaultDateField: "entrega",
  });

  // Filter to only Páscoa orders
  const pascoaOrders = useMemo(
    () => filteredOrders.filter(isPascoaOrder),
    [filteredOrders]
  );

  // Group by selected date field
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ParsedOrder[]>();
    for (const order of pascoaOrders) {
      const date =
        filters.dateField === "producao" ? order.dataProducao : order.dataEntrega;
      if (!date) continue;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(order);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, orders]) => ({ date, orders }));
  }, [pascoaOrders, filters.dateField]);

  const viewLabel = filters.dateField === "producao" ? "produção" : "entrega";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-brown">🐰 Páscoa</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Ovos e barras por data de {viewLabel} · próximos 60 dias
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

      {/* Filter bar */}
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
              Nenhum pedido de Páscoa encontrado nos próximos 60 dias.
            </p>
          ) : (
            groupedByDate.map((group) => (
              <PascoaDaySection
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
