import { useState, useEffect, useCallback } from "react";
import type { ParsedOrder, FilterState } from "@/types";

const REFRESH_MS = 2 * 60 * 1000; // 2 minutes

export function useOrders() {
  const [rawOrders, setRawOrders] = useState<ParsedOrder[]>([]);
  const [today, setToday] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    loja: "todas",
    saida: "todos",
    categoria: "todas",
  });

  const fetchOrders = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/orders");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        today: string;
        tomorrow: string;
        orders: ParsedOrder[];
      };
      setToday(data.today);
      setTomorrow(data.tomorrow);
      setRawOrders(data.orders);
      setLastFetched(new Date());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar pedidos"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
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

    // PDM = pedidos sem categoria especial (ícone não mapeado para Bolo/Revenda)
    const categoriaMatch =
      filters.categoria === "todas" ||
      (filters.categoria === "pdm"    && order.icon !== "🎂" && order.icon !== "🔁") ||
      (filters.categoria === "bolo"   && order.icon === "🎂") ||
      (filters.categoria === "revenda" && order.icon === "🔁");

    return lojaMatch && saidaMatch && categoriaMatch;
  });

  const todayOrders = filteredOrders.filter((o) => o.dataProducao === today);
  const tomorrowOrders = filteredOrders.filter(
    (o) => o.dataProducao === tomorrow
  );

  return {
    todayOrders,
    tomorrowOrders,
    today,
    tomorrow,
    loading,
    error,
    lastFetched,
    filters,
    setFilters,
    refresh: fetchOrders,
  };
}
