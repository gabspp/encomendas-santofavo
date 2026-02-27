import { useState, useMemo } from "react";
import { useOrdersRange } from "@/hooks/useOrdersRange";
import { FilterBar } from "@/components/orders/FilterBar";
import { OrderCard } from "@/components/orders/OrderCard";
import type { ParsedOrder } from "@/types";
import { RefreshCw, ChevronLeft, ChevronRight, X } from "lucide-react";

const MONTHS_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function buildCalendarGrid(year: number, month: number): (string | null)[][] {
  const firstDow = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
  const lastDate = new Date(year, month, 0).getDate();

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= lastDate; d++) {
    cells.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

function formatDay(dateStr: string): number {
  return parseInt(dateStr.split("-")[2], 10);
}

function isToday(dateStr: string): boolean {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  return dateStr === todayStr;
}

interface OrderDetailModalProps {
  order: ParsedOrder;
  onClose: () => void;
  onStatusChange: (id: string, status: Parameters<React.ComponentProps<typeof OrderCard>["onStatusChange"]>[1]) => Promise<void>;
  onEntregaChange: (id: string, entrega: string) => Promise<void>;
  onDateChange: (id: string, field: "producao" | "entrega", date: string) => Promise<void>;
}

function OrderDetailModal({ order, onClose, onStatusChange, onEntregaChange, onDateChange }: OrderDetailModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative z-10 max-w-sm w-full">
        <button
          onClick={onClose}
          className="absolute -top-3 -right-3 z-20 bg-white rounded-full p-1 shadow-lg hover:bg-gray-100 cursor-pointer"
        >
          <X className="h-4 w-4 text-gray-500" />
        </button>
        <OrderCard
          order={order}
          onStatusChange={onStatusChange}
          onEntregaChange={onEntregaChange}
          onDateChange={onDateChange}
        />
      </div>
    </div>
  );
}

export default function Calendario() {
  const now = new Date();
  const [displayMonth, setDisplayMonth] = useState({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  });
  const [selectedOrder, setSelectedOrder] = useState<ParsedOrder | null>(null);

  const startDate = `${displayMonth.year}-${String(displayMonth.month).padStart(2, "0")}-01`;
  const endDate = `${displayMonth.year}-${String(displayMonth.month).padStart(2, "0")}-${new Date(displayMonth.year, displayMonth.month, 0).getDate()}`;

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
  } = useOrdersRange({ startDate, endDate });

  const weeks = useMemo(
    () => buildCalendarGrid(displayMonth.year, displayMonth.month),
    [displayMonth]
  );

  // Group orders by their selected date field
  const ordersByDate = useMemo(() => {
    const map = new Map<string, ParsedOrder[]>();
    for (const order of filteredOrders) {
      const date =
        filters.dateField === "producao" ? order.dataProducao : order.dataEntrega;
      if (!date) continue;
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(order);
    }
    return map;
  }, [filteredOrders, filters.dateField]);

  function prevMonth() {
    setDisplayMonth((prev) => {
      const m = prev.month === 1 ? 12 : prev.month - 1;
      const y = prev.month === 1 ? prev.year - 1 : prev.year;
      return { year: y, month: m };
    });
  }

  function nextMonth() {
    setDisplayMonth((prev) => {
      const m = prev.month === 12 ? 1 : prev.month + 1;
      const y = prev.month === 12 ? prev.year + 1 : prev.year;
      return { year: y, month: m };
    });
  }

  const viewLabel = filters.dateField === "producao" ? "produção" : "entrega";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-brown">Calendário</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Por data de {viewLabel}
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

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ChevronLeft className="h-5 w-5 text-gray-600" />
        </button>
        <h2 className="text-lg font-bold text-brand-brown">
          {MONTHS_PT[displayMonth.month - 1]} {displayMonth.year}
        </h2>
        <button
          onClick={nextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <ChevronRight className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-3">
          <span><strong>Erro:</strong> {error}</span>
          <button onClick={() => void refresh()} className="underline cursor-pointer">
            Tentar novamente
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {WEEK_DAYS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="text-sm">Carregando...</span>
          </div>
        ) : (
          <div>
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-gray-100 last:border-b-0">
                {week.map((dateStr, di) => {
                  const dayOrders = dateStr ? (ordersByDate.get(dateStr) ?? []) : [];
                  const today = dateStr ? isToday(dateStr) : false;

                  return (
                    <div
                      key={di}
                      className={`min-h-[90px] p-1.5 border-r border-gray-100 last:border-r-0 ${
                        !dateStr ? "bg-gray-50" : ""
                      }`}
                    >
                      {dateStr && (
                        <>
                          <div
                            className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                              today
                                ? "bg-brand-brown text-white"
                                : "text-gray-600"
                            }`}
                          >
                            {formatDay(dateStr)}
                          </div>
                          <div className="space-y-0.5">
                            {dayOrders.map((order) => (
                              <button
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="w-full text-left text-xs bg-brand-cream hover:bg-brand-yellow/30 rounded px-1.5 py-0.5 flex items-center gap-1 transition-colors cursor-pointer truncate"
                              >
                                <span className="shrink-0 text-[10px]">
                                  {order.icon || "🟢"}
                                </span>
                                <span className="truncate text-brand-brown font-medium">
                                  {order.cliente}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onStatusChange={async (id, status) => {
            await updateOrderStatus(id, status);
            setSelectedOrder((prev) =>
              prev?.id === id ? { ...prev, status } : prev
            );
          }}
          onEntregaChange={async (id, entrega) => {
            await updateOrderEntrega(id, entrega);
            setSelectedOrder((prev) =>
              prev?.id === id ? { ...prev, entrega } : prev
            );
          }}
          onDateChange={async (id, field, date) => {
            await updateOrderDate(id, field, date);
            setSelectedOrder((prev) => {
              if (prev?.id !== id) return prev;
              return field === "producao"
                ? { ...prev, dataProducao: date }
                : { ...prev, dataEntrega: date };
            });
          }}
        />
      )}
    </div>
  );
}
