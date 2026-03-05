import { useState, useEffect, useCallback } from "react";
import type { ParsedOrder, FilterState, OrderStatus } from "@/types";

const REFRESH_MS = 2 * 60 * 1000; // 2 minutes

const DEFAULT_FILTERS: FilterState = {
  loja: "todas",
  saida: "todos",
  categoria: "todas",
  dateField: "producao",
};

export function useOrders() {
  const [rawOrders, setRawOrders] = useState<ParsedOrder[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/orders?field=${filters.dateField}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        dates: string[];
        orders: ParsedOrder[];
      };
      setDates(data.dates);
      setRawOrders(data.orders);
      setLastFetched(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar pedidos"
      );
    } finally {
      setLoading(false);
    }
  }, [filters.dateField]);

  // Re-fetch when dateField changes (other filters are client-side only)
  useEffect(() => {
    setLoading(true);
    void fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 2 minutes — silent (no loading spinner on refresh)
  useEffect(() => {
    const id = setInterval(() => void fetchOrders(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // Client-side filtering — no re-fetch needed
  const filteredOrders = rawOrders.filter((order) => {
    const lojaMatch =
      filters.loja === "todas" ||
      order.entrega.includes(filters.loja);

    const saidaMatch =
      filters.saida === "todos" ||
      (filters.saida === "entrega" && order.entrega.startsWith("Entrega")) ||
      (filters.saida === "retirada" && order.entrega.startsWith("Retirada"));

    const hasPdm  = order.products.some((p) => p.name.includes("PDM") || p.name.includes("Pão de Mel"));
    const hasBolo = order.products.some((p) => p.name.startsWith("Bolo"));
    const categoriaMatch =
      filters.categoria === "todas" ||
      (filters.categoria === "pdm"     && hasPdm) ||
      (filters.categoria === "bolo"    && hasBolo) ||
      (filters.categoria === "revenda" && order.revenda);

    return lojaMatch && saidaMatch && categoriaMatch;
  });

  // Group filtered orders by the selected date field
  const groupedByDate = dates.map((date) => ({
    date,
    orders: filteredOrders.filter((o) =>
      filters.dateField === "producao"
        ? o.dataProducao === date
        : o.dataEntrega === date
    ),
  }));

  // Optimistic entrega update — reverts on error
  const updateOrderEntrega = useCallback(
    async (orderId: string, newEntrega: string) => {
      const prev = rawOrders;
      setRawOrders((orders) =>
        orders.map((o) => (o.id === orderId ? { ...o, entrega: newEntrega } : o))
      );
      try {
        const res = await fetch("/api/update-entrega", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: orderId, entrega: newEntrega }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setRawOrders(prev);
        throw err;
      }
    },
    [rawOrders]
  );

  // Optimistic status update — reverts on error
  const updateOrderStatus = useCallback(
    async (orderId: string, newStatus: OrderStatus) => {
      const prev = rawOrders;
      setRawOrders((orders) =>
        orders.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
      try {
        const res = await fetch("/api/update-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: orderId, status: newStatus }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setRawOrders(prev);
        throw err;
      }
    },
    [rawOrders]
  );

  // Optimistic date update — reverts on error
  const updateOrderDate = useCallback(
    async (orderId: string, field: "producao" | "entrega", newDate: string) => {
      const prev = rawOrders;
      setRawOrders((orders) =>
        orders.map((o) =>
          o.id === orderId
            ? field === "producao"
              ? { ...o, dataProducao: newDate }
              : { ...o, dataEntrega: newDate }
            : o
        )
      );
      try {
        const res = await fetch("/api/update-date", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: orderId, field, date: newDate }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setRawOrders(prev);
        throw err;
      }
    },
    [rawOrders]
  );

  // Optimistic revenda toggle — reverts on error
  const updateOrderRevenda = useCallback(
    async (orderId: string, newRevenda: boolean) => {
      const prev = rawOrders;
      setRawOrders((orders) =>
        orders.map((o) => (o.id === orderId ? { ...o, revenda: newRevenda } : o))
      );
      try {
        const res = await fetch("/api/update-revenda", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageId: orderId, revenda: newRevenda }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
      } catch (err) {
        setRawOrders(prev);
        throw err;
      }
    },
    [rawOrders]
  );

  return {
    groupedByDate,
    dates,
    loading,
    error,
    lastFetched,
    filters,
    setFilters,
    refresh: fetchOrders,
    updateOrderStatus,
    updateOrderEntrega,
    updateOrderDate,
    updateOrderRevenda,
  };
}
