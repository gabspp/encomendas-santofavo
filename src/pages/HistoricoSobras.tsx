import { useCallback, useEffect, useState } from "react";
import { HistoricoTable } from "@/components/historico/HistoricoTable";
import type { HistoricoRow } from "@/components/historico/HistoricoTable";
import { SABORES } from "@/utils/producao";
import type { StoreId } from "@/utils/estoque";

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}
function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

const COLUMNS = SABORES.filter((s) => s.id !== "DLSem").map((s) => ({
  id: s.id, label: s.id, emoji: s.emoji,
}));

export default function HistoricoSobras() {
  const [start, setStart] = useState(daysAgoISO(13));
  const [end, setEnd] = useState(toISODate(new Date()));
  const [storeId, setStoreId] = useState<StoreId | "todas">("todas");
  const [rows, setRows] = useState<HistoricoRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ resource: "historico-sobras", start, end });
      if (storeId !== "todas") params.set("storeId", storeId);
      const res = await fetch(`/api/planejamento-lojas?${params.toString()}`);
      const data = (await res.json()) as { rows?: HistoricoRow[] };
      setRows(data.rows ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [start, end, storeId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      <h1 className="text-lg font-bold text-brand-brown">📦 Histórico de Sobras</h1>
      <HistoricoTable
        rows={rows}
        columns={COLUMNS}
        loading={loading}
        start={start}
        end={end}
        storeId={storeId}
        onStartChange={setStart}
        onEndChange={setEnd}
        onStoreChange={setStoreId}
      />
    </div>
  );
}
