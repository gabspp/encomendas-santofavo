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

const BOLO_PRODUCTS = [
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
];

const BOLO_PRODUCT_SET = new Set(BOLO_PRODUCTS);

function isBoloOrder(order: ParsedOrder): boolean {
  return order.products.some((p) => BOLO_PRODUCT_SET.has(p.name));
}

// Summarize bolo totals across orders for a given day
function summarizeBolos(orders: ParsedOrder[]): { name: string; qty: number }[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    for (const product of order.products) {
      if (BOLO_PRODUCT_SET.has(product.name)) {
        totals.set(product.name, (totals.get(product.name) ?? 0) + product.qty);
      }
    }
  }
  return BOLO_PRODUCTS.filter((name) => (totals.get(name) ?? 0) > 0).map(
    (name) => ({ name, qty: totals.get(name)! })
  );
}

function shortBoloName(name: string): string {
  return name
    .replace("Bolo Choco Fatia", "Choco Fatia")
    .replace("Bolo Choco G", "Choco G")
    .replace("Bolo Choco P", "Choco P")
    .replace("Bolo NOZES Fatia", "Nozes Fatia")
    .replace("Bolo NOZES G", "Nozes G")
    .replace("Bolo NOZES P", "Nozes P")
    .replace("Bolo PDM Fatia", "PDM Fatia")
    .replace("Bolo PDM G", "PDM G")
    .replace("Bolo PDM P", "PDM P")
    .replace("Bolo de Especiarias G com calda", "Especiarias G")
    .replace("Bolo de Mel Mini", "Mel Mini");
}

interface BoloDaySectionProps {
  date: string;
  orders: ParsedOrder[];
  onStatusChange: Parameters<typeof DaySection>[0]["onStatusChange"];
  onEntregaChange: Parameters<typeof DaySection>[0]["onEntregaChange"];
  onDateChange: Parameters<typeof DaySection>[0]["onDateChange"];
}

function BoloDaySection({ date, orders, onStatusChange, onEntregaChange, onDateChange }: BoloDaySectionProps) {
  const summary = useMemo(() => summarizeBolos(orders), [orders]);
  const totalBolos = summary.reduce((sum, s) => sum + s.qty, 0);

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
      <div className="bg-pink-50 border border-pink-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🎂</span>
          <span className="font-bold text-pink-800">
            {totalBolos} {totalBolos === 1 ? "bolo" : "bolos"} no total
          </span>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {summary.map((item) => (
            <div key={item.name} className="flex items-center gap-1 text-sm text-pink-700">
              <span className="font-semibold">{item.qty}×</span>
              <span>{shortBoloName(item.name)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Individual order cards */}
      <DaySection
        title=""
        orders={orders}
        emptyMessage="Nenhum pedido de bolo para esta data."
        onStatusChange={onStatusChange}
        onEntregaChange={onEntregaChange}
        onDateChange={onDateChange}
      />
    </div>
  );
}

export default function SoBolos() {
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

  // Filter to only bolo orders
  const boloOrders = useMemo(
    () => filteredOrders.filter(isBoloOrder),
    [filteredOrders]
  );

  // Group by selected date field
  const groupedByDate = useMemo(() => {
    const map = new Map<string, ParsedOrder[]>();
    for (const order of boloOrders) {
      const date =
        filters.dateField === "producao" ? order.dataProducao : order.dataEntrega;
      if (!date) continue;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(order);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, orders]) => ({ date, orders }));
  }, [boloOrders, filters.dateField]);

  const viewLabel = filters.dateField === "producao" ? "produção" : "entrega";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-brown">Só Bolos</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pedidos com bolos por data de {viewLabel} · próximos 60 dias
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

      {/* Filter bar — sem categoria (já estamos filtrados para bolos) */}
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
              Nenhum pedido de bolo encontrado nos próximos 60 dias.
            </p>
          ) : (
            groupedByDate.map((group) => (
              <BoloDaySection
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
