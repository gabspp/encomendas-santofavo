import { useState } from "react";
import { useOrders } from "@/hooks/useOrders";
import { FilterBar } from "@/components/orders/FilterBar";
import { DaySection } from "@/components/orders/DaySection";
import { NewOrderModal } from "@/components/orders/NewOrderModal";
import { ChatOrderModal } from "@/components/orders/ChatOrderModal";
import { formatBrDate } from "@/utils/notion";
import { RefreshCw, Plus, MessageSquare } from "lucide-react";

export default function HojeAmanha() {
  const {
    todayOrders,
    tomorrowOrders,
    today,
    tomorrow,
    loading,
    error,
    lastFetched,
    filters,
    setFilters,
    refresh,
    updateOrderStatus,
    updateOrderEntrega,
    updateOrderDate,
  } = useOrders();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-brown">
            Hoje e Amanhã
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pedidos por data de produção
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Chat button */}
          <button
            onClick={() => setIsChatOpen(true)}
            className="flex items-center gap-1.5 text-sm font-medium border border-brand-brown text-brand-brown px-3 py-1.5 rounded-lg hover:bg-brand-brown hover:text-white transition-colors cursor-pointer"
          >
            <MessageSquare className="h-4 w-4" />
            Chat
          </button>

          {/* New order button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 text-sm font-semibold bg-brand-brown text-white px-3 py-1.5 rounded-lg hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Novo Pedido
          </button>

          {/* Refresh button */}
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
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} onChange={setFilters} />

      {/* Loading state (only on initial load) */}
      {loading && (
        <div className="flex items-center justify-center py-20 text-gray-400 gap-2">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span className="text-sm">Carregando pedidos...</span>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-3">
          <span>
            <strong>Erro:</strong> {error}
          </span>
          <button
            onClick={() => void refresh()}
            className="underline hover:no-underline cursor-pointer"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Day sections */}
      {!loading && !error && (
        <div className="space-y-8">
          <DaySection
            title={`HOJE${today ? ` (${formatBrDate(today)})` : ""}`}
            orders={todayOrders}
            emptyMessage="Nenhum pedido para hoje com este filtro."
            onStatusChange={updateOrderStatus}
            onEntregaChange={updateOrderEntrega}
            onDateChange={updateOrderDate}
          />
          <DaySection
            title={`AMANHÃ${tomorrow ? ` (${formatBrDate(tomorrow)})` : ""}`}
            orders={tomorrowOrders}
            emptyMessage="Nenhum pedido para amanhã com este filtro."
            onStatusChange={updateOrderStatus}
            onEntregaChange={updateOrderEntrega}
            onDateChange={updateOrderDate}
          />
        </div>
      )}

      {/* Chat modal */}
      {isChatOpen && (
        <ChatOrderModal
          onClose={() => setIsChatOpen(false)}
          onCreated={() => {
            setIsChatOpen(false);
            void refresh();
          }}
        />
      )}

      {/* New order modal */}
      {isModalOpen && (
        <NewOrderModal
          onClose={() => setIsModalOpen(false)}
          onCreated={() => {
            setIsModalOpen(false);
            void refresh();
          }}
        />
      )}
    </div>
  );
}
