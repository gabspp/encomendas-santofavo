import { useMemo } from "react";
import { useOrdersRange } from "@/hooks/useOrdersRange";
import { FilterBar } from "@/components/orders/FilterBar";
import { DaySection } from "@/components/orders/DaySection";
import { formatBrDateWithDay } from "@/utils/notion";
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

export default function PorProducao() {
  const today = useMemo(() => getBrazilToday(), []);
  const endDate = useMemo(() => addDays(today, 60), [today]);

  const {
    groupedByDate,
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

  const viewLabel = filters.dateField === "producao" ? "produção" : "entrega";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-brown">
            Por Data de Produção
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pedidos agrupados por data de {viewLabel} · próximos 60 dias
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
      <FilterBar filters={filters} onChange={setFilters} />

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
        <div className="space-y-8">
          {groupedByDate.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              Nenhum pedido encontrado nos próximos 60 dias.
            </p>
          ) : (
            groupedByDate.map((group) => (
              <DaySection
                key={group.date}
                title={formatBrDateWithDay(group.date).toUpperCase()}
                orders={group.orders}
                emptyMessage="Nenhum pedido para esta data com este filtro."
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
