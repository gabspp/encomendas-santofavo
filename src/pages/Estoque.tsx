import { useState, useEffect, useCallback, useRef } from "react";
import { Save, Share2, FileText, Loader2, X } from "lucide-react";
import {
  INITIAL_ITEMS,
  INITIAL_BARS,
  calculateTotals,
  calculateGrandTotal,
  generateReportText,
  getInitialHeaders,
  formatDateForInput,
} from "@/utils/estoque";
import type { StockItem, BarItem, StoreId } from "@/utils/estoque";
import { toPng } from "html-to-image";

// ── Helpers ────────────────────────────────────────────────────────────────────

function todayISO(): string {
  const today = new Date();
  return formatDateForInput(today);
}

function deepCloneItems(items: StockItem[]): StockItem[] {
  return items.map((item) => ({
    ...item,
    values: [...item.values],
  }));
}

// ── Componente ─────────────────────────────────────────────────────────────────

export default function Estoque() {
  const [storeId, setStoreId] = useState<StoreId>("248");
  const [reportDate, setReportDate] = useState<string>(todayISO());
  const [headers, setHeaders] = useState<string[]>(getInitialHeaders());
  const [items, setItems] = useState<StockItem[]>(deepCloneItems(INITIAL_ITEMS));
  const [bars, setBars] = useState<BarItem[]>([...INITIAL_BARS]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [reportText, setReportText] = useState("");
  const [copiedReport, setCopiedReport] = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const tableRef = useRef<HTMLDivElement>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (date: string, store: StoreId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/estoque-get?date=${date}&storeId=${store}`);
      const data = await res.json() as {
        empty?: boolean;
        headers?: string[];
        items?: StockItem[];
        bars?: BarItem[];
      };

      if (data.empty) {
        setHeaders(getInitialHeaders());
        setItems(deepCloneItems(INITIAL_ITEMS));
        setBars([...INITIAL_BARS]);
      } else {
        setHeaders(data.headers ?? getInitialHeaders());
        // Recalcular totais ao carregar
        const loaded = calculateTotals(
          (data.items ?? INITIAL_ITEMS).map((it) => ({
            ...it,
            values: it.values?.length === 3 ? it.values : [0, 0, 0],
          }))
        );
        setItems(loaded);
        setBars(data.bars ?? [...INITIAL_BARS]);
      }
    } catch {
      showToast("Erro ao carregar dados", "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(reportDate, storeId);
  }, [reportDate, storeId, loadData]);

  // ── Handlers de edição ─────────────────────────────────────────────────────

  function handleValue(itemIdx: number, colIdx: number, raw: string) {
    const num = parseInt(raw, 10);
    const val = isNaN(num) ? "" : Math.max(0, num);
    setItems((prev) => {
      const next = deepCloneItems(prev);
      next[itemIdx].values[colIdx] = val;
      return calculateTotals(next);
    });
  }

  function handleDec(itemIdx: number, raw: string) {
    const num = parseInt(raw, 10);
    const val = isNaN(num) ? "" : num;
    setItems((prev) => {
      const next = deepCloneItems(prev);
      next[itemIdx].dec = val;
      return calculateTotals(next);
    });
  }

  function handleBar(barIdx: number, raw: string) {
    const num = parseInt(raw, 10);
    const val = isNaN(num) ? "" : Math.max(0, num);
    setBars((prev) => {
      const next = [...prev];
      next[barIdx] = { ...next[barIdx], quantity: val };
      return next;
    });
  }

  function handleHeader(colIdx: number, value: string) {
    setHeaders((prev) => {
      const next = [...prev];
      next[colIdx] = value;
      return next;
    });
  }

  // ── Navegação com Enter (mesma coluna, próxima linha) ───────────────────────

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    itemIdx: number,
    colKey: string,
    totalRows: number,
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const nextIdx = itemIdx + 1;
    if (nextIdx >= totalRows) return;
    const nextInput = document.querySelector<HTMLInputElement>(
      `[data-row="${nextIdx}"][data-col="${colKey}"]`
    );
    nextInput?.focus();
    nextInput?.select();
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/estoque-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: reportDate, storeId, headers, items, bars }),
      });
      if (!res.ok) throw new Error("Erro ao salvar");
      showToast("Salvo com sucesso!");
    } catch {
      showToast("Erro ao salvar", "err");
    } finally {
      setSaving(false);
    }
  }

  // ── Auto-save debounce 2s ──────────────────────────────────────────────────

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (isFirstLoad.current) { isFirstLoad.current = false; return; }
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/estoque-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date: reportDate, storeId, headers, items, bars }),
        });
      } catch {
        // silently ignore
      }
    }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [items, bars, headers]);

  // ── Relatório ──────────────────────────────────────────────────────────────

  function handleReport() {
    const text = generateReportText(storeId, headers, items, bars);
    setReportText(text);
    setShowReport(true);
  }

  async function handleCopyReport() {
    await navigator.clipboard.writeText(reportText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2000);
  }

  // ── Compartilhar (html-to-image + Web Share) ───────────────────────────────

  async function handleShare() {
    if (!tableRef.current) return;
    try {
      const dataUrl = await toPng(tableRef.current, { backgroundColor: "#faf7f2" });
      const blob = await fetch(dataUrl).then((r) => r.blob());
      const file = new File([blob], `estoque-${storeId}-${reportDate}.png`, { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Estoque ${storeId} ${reportDate}` });
      } else {
        // Fallback: download
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = file.name;
        link.click();
      }
    } catch {
      showToast("Erro ao gerar imagem", "err");
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const grandTotal = calculateGrandTotal(items);

  const inputBase =
    "w-full text-center text-sm bg-transparent outline-none border-b border-transparent focus:border-brand-brown transition-colors py-1 tabular-nums";

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-8">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all
            ${toast.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-brand-brown">📦 Estoque PDM</h1>
          {loading && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>

        <div className="flex flex-wrap gap-3 items-end">
          {/* Loja */}
          <div>
            <p className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Loja</p>
            <div className="flex gap-2">
              {(["248", "26"] as StoreId[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStoreId(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                    storeId === s
                      ? "bg-brand-brown text-white border-brand-brown"
                      : "border-gray-200 text-gray-700 hover:border-gray-400"
                  }`}
                >
                  Loja {s}
                </button>
              ))}
            </div>
          </div>

          {/* Data do relatório */}
          <div>
            <p className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Data do registro</p>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-brand-brown"
            />
          </div>
        </div>
      </div>

      {/* ── Tabela de estoque ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" ref={tableRef}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-brand-brown/5 border-b border-gray-200">
                <th className="sticky left-0 bg-brand-brown/5 text-left px-4 py-2.5 text-xs font-bold text-gray-600 uppercase tracking-wide min-w-[80px]">
                  Sabor
                </th>
                {headers.map((h, ci) => (
                  <th key={ci} className="px-2 py-1.5 text-center">
                    <input
                      type="date"
                      value={h}
                      onChange={(e) => handleHeader(ci, e.target.value)}
                      className="text-xs font-semibold text-gray-600 text-center bg-transparent outline-none border-b border-transparent focus:border-brand-brown w-full transition-colors"
                      title={`Data coluna ${ci + 1}`}
                    />
                  </th>
                ))}
                <th className="px-2 py-2.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wide min-w-[52px]">
                  Dec
                </th>
                <th className="px-3 py-2.5 text-center text-xs font-bold text-gray-600 uppercase tracking-wide min-w-[60px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, ri) => (
                <tr key={item.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="sticky left-0 bg-white hover:bg-gray-50/50 px-4 py-2 font-semibold text-brand-brown text-sm whitespace-nowrap">
                    {item.name}
                  </td>
                  {item.values.map((v, ci) => (
                    <td key={ci} className="px-2 py-1.5 min-w-[60px]">
                      <input
                        type="number"
                        min="0"
                        value={v === 0 || v === "" ? "" : v}
                        placeholder="0"
                        data-row={ri}
                        data-col={`v${ci}`}
                        onChange={(e) => handleValue(ri, ci, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, ri, `v${ci}`, items.length)}
                        onFocus={(e) => (e.target as HTMLInputElement).select()}
                        className={`${inputBase} ${Number(v) > 0 ? "text-gray-800 font-medium" : "text-gray-400"}`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-1.5 min-w-[52px]">
                    <input
                      type="number"
                      value={item.dec === 0 || item.dec === "" ? "" : item.dec}
                      placeholder="0"
                      data-row={ri}
                      data-col="dec"
                      onChange={(e) => handleDec(ri, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, ri, "dec", items.length)}
                      onFocus={(e) => (e.target as HTMLInputElement).select()}
                      className={`${inputBase} ${Number(item.dec) !== 0 ? "text-orange-600 font-medium" : "text-gray-400"}`}
                    />
                  </td>
                  <td className="px-3 py-2 text-center font-bold text-brand-brown tabular-nums">
                    {item.total}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-brand-brown/5 border-t-2 border-brand-brown/20">
                <td className="sticky left-0 bg-brand-brown/5 px-4 py-2.5 font-bold text-gray-800 text-sm uppercase tracking-wide">
                  Total
                </td>
                {[0, 1, 2].map((ci) => (
                  <td key={ci} className="px-2 py-2.5 text-center font-bold text-gray-700 tabular-nums">
                    {items.reduce((sum, it) => sum + (Number(it.values[ci]) || 0), 0)}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-center font-bold text-orange-600 tabular-nums">
                  {items.reduce((sum, it) => sum + (Number(it.dec) || 0), 0)}
                </td>
                <td className="px-3 py-2.5 text-center font-bold text-brand-brown text-base tabular-nums">
                  {grandTotal}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Barrinhas ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
          Estoque de Barrinhas
        </h2>
        <div className="divide-y divide-gray-100">
          {bars.map((bar, bi) => (
            <div key={bar.id} className="flex items-center justify-between py-2.5">
              <span className="text-sm text-gray-700">{bar.name}</span>
              <input
                type="number"
                min="0"
                value={bar.quantity === 0 || bar.quantity === "" ? "" : bar.quantity}
                placeholder="0"
                onChange={(e) => handleBar(bi, e.target.value)}
                onFocus={(e) => (e.target as HTMLInputElement).select()}
                className="w-20 text-center text-sm border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:border-brand-brown transition-colors tabular-nums"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Botões de ação ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-brown text-white text-sm font-semibold hover:bg-brand-brown/90 disabled:opacity-50 transition-colors cursor-pointer disabled:cursor-not-allowed"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>

        <button
          onClick={handleReport}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:border-gray-400 transition-colors cursor-pointer"
        >
          <FileText className="h-4 w-4" />
          Gerar Relatório
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-700 text-sm font-semibold hover:border-gray-400 transition-colors cursor-pointer"
        >
          <Share2 className="h-4 w-4" />
          Compartilhar
        </button>
      </div>

      {/* ── Modal relatório ──────────────────────────────────────────────────── */}
      {showReport && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowReport(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h3 className="font-bold text-gray-800">Relatório de Estoque</h3>
              <button
                onClick={() => setShowReport(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <pre className="text-xs font-mono bg-gray-50 rounded-lg p-3 whitespace-pre-wrap text-gray-700">
                {reportText}
              </pre>
            </div>
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                onClick={handleCopyReport}
                className="w-full px-4 py-2.5 rounded-lg bg-brand-brown text-white text-sm font-semibold hover:bg-brand-brown/90 transition-colors cursor-pointer"
              >
                {copiedReport ? "Copiado!" : "Copiar para WhatsApp"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
