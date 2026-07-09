import { Loader2 } from "lucide-react";
import type { StoreId } from "@/utils/estoque";

export interface HistoricoRow {
  date: string;
  storeId: string;
  values: Record<string, number>;
  total: number;
}

export interface HistoricoColumn {
  id: string;
  label: string;
  emoji?: string;
}

interface HistoricoTableProps {
  rows: HistoricoRow[];
  columns: HistoricoColumn[];
  loading: boolean;
  start: string;
  end: string;
  storeId: StoreId | "todas";
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onStoreChange: (v: StoreId | "todas") => void;
}

function formatDateDisplay(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function HistoricoTable({
  rows, columns, loading,
  start, end, storeId,
  onStartChange, onEndChange, onStoreChange,
}: HistoricoTableProps) {
  const sortedRows = [...rows].sort((a, b) => b.date.localeCompare(a.date) || a.storeId.localeCompare(b.storeId));

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <p className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">De</p>
            <input
              type="date"
              value={start}
              onChange={(e) => onStartChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-brand-brown"
            />
          </div>
          <div>
            <p className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Até</p>
            <input
              type="date"
              value={end}
              onChange={(e) => onEndChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-brand-brown"
            />
          </div>
          <div>
            <p className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Loja</p>
            <div className="flex gap-2">
              {(["todas", "26", "248"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onStoreChange(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                    storeId === s
                      ? "bg-brand-brown text-white border-brand-brown"
                      : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  {s === "todas" ? "Todas" : `Loja ${s}`}
                </button>
              ))}
            </div>
          </div>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400 mb-2" />}
        </div>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand-brown text-white text-left">
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Data</th>
                <th className="px-3 py-2 font-semibold whitespace-nowrap">Loja</th>
                {columns.map((c) => (
                  <th key={c.id} className="px-3 py-2 font-semibold text-center whitespace-nowrap">
                    {c.emoji ? `${c.emoji} ` : ""}{c.label}
                  </th>
                ))}
                <th className="px-3 py-2 font-semibold text-center whitespace-nowrap">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sortedRows.length === 0 && !loading && (
                <tr>
                  <td colSpan={columns.length + 3} className="px-3 py-6 text-center text-gray-400">
                    Nenhum registro no período selecionado.
                  </td>
                </tr>
              )}
              {sortedRows.map((row) => (
                <tr key={`${row.date}-${row.storeId}`}>
                  <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    {formatDateDisplay(row.date)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 whitespace-nowrap">Loja {row.storeId}</td>
                  {columns.map((c) => (
                    <td key={c.id} className="px-3 py-2 text-center text-gray-600">
                      {row.values[c.id] ?? 0}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold text-brand-brown">{row.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
