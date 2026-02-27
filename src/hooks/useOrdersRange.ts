import { useState, useEffect, useCallback } from "react";
import type { ParsedOrder, FilterState, OrderStatus } from "@/types";

const REFRESH_MS = 2 * 60 * 1000; // 2 minutes

interface Config {
  startDate: string;
  endDate: string;
  defaultDateField?: "producao" | "entrega";
}

export function useOrdersRange(config: Config) {
  const [rawOrders, setRawOrders] = useState<ParsedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    loja: "todas",
    saida: "todos",
    categoria: "todas",
    dateField: config.defaultDateField ?? "producao",
  });

  const { startDate, endDate } = config;

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const params = new URLSearchParams({
        startDate,
        endDate,
        field: filters.dateField,
      });
      const res = await fetch(`/api/orders-range?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { orders: ParsedOrder[] };
      setRawOrders(data.orders);
      setLastFetched(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar pedidos"
      );
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, filters.dateField]);

  useEffect(() => {
    setLoading(true);
    void fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    const id = setInterval(() => void fetchOrders(), REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // Client-side filtering
  const filteredOrders = rawOrders.filter((order) => {
    const lojaMatch =
      filters.loja === "todas" || order.entrega.includes(filters.loja);

    const saidaMatch =
      filters.saida === "todos" ||
      (filters.saida === "entrega" && order.entrega.startsWith("Entrega")) ||
      (filters.saida === "retirada" && order.entrega.startsWith("Retirada"));

    const categoriaMatch =
      filters.categoria === "todas" ||
      (filters.categoria === "pdm" && !order.revenda && order.icon !== "🎂") ||
      (filters.categoria === "bolo" && order.icon === "🎂") ||
      (filters.categoria === "revenda" && order.revenda);

    return lojaMatch && saidaMatch && categoriaMatch;
  });

  // Collect unique dates (from the selected date field) and group orders
  const dateMap = new Map<string, ParsedOrder[]>();
  for (const order of filteredOrders) {
    const date =
      filters.dateField === "producao" ? order.dataProducao : order.dataEntrega;
    if (!date) continue;
    if (!dateMap.has(date)) dateMap.set(date, []);
    dateMap.get(date)!.push(order);
  }
  const groupedByDate = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, orders]) => ({ date, orders }));

  // Optimistic mutations
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
    rawOrders,
    filteredOrders,
    groupedByDate,
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
