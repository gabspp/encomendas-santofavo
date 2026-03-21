import { useState, useEffect, useCallback, useRef } from "react";
import { Copy, Loader2, RefreshCw } from "lucide-react";
import {
  SABORES,
  SABOR_RESTANTE,
  SABORES_IDS,
  BLANK_FLAVORS,
  calcularProducao,
  gerarMensagem,
  parseTextToFlavors,
} from "@/utils/producao";
import type { FlavorId, FlavorData, OrderDetail } from "@/utils/producao";
import { getPreviousBusinessDay } from "@/utils/estoque";

// ── Constantes ────────────────────────────────────────────────────────────────

const STORES = [
  { id: "248", label: "Loja 248" },
  { id: "26",  label: "Loja 26"  },
] as const;

// ── Helpers de data ───────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function todayISO(): string {
  return toISODate(new Date());
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toISODate(d);
}

// ── Shared input styles ───────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-brown transition-colors bg-white";
const labelCls =
  "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

// ── Componente FlavorRow — linha com [−] n [+] ────────────────────────────────

function FlavorRow({
  sabor,
  value,
  onChange,
  disabled = false,
}: {
  sabor: (typeof SABORES)[number];
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between py-1.5 ${disabled ? "opacity-40" : ""}`}>
      <span className="text-sm text-gray-700 flex-1 mr-3 leading-tight">
        <span className="mr-1">{sabor.emoji}</span>
        {sabor.nome}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={disabled || value === 0}
          className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <input
          type="number"
          min="0"
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          disabled={disabled}
          className={`w-12 text-center text-sm font-medium border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown transition-colors ${value > 0 ? "text-brand-brown" : "text-gray-400"}`}
          placeholder="0"
        />
        <button
          onClick={() => onChange(value + 1)}
          disabled={disabled}
          className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function Planejamento() {
  // Seleção de contexto
  const [date, setDate] = useState<string>(todayISO());
  const [storeId, setStoreId] = useState<"248" | "26">("248");

  // Inputs
  const [sobras, setSobras] = useState<Record<FlavorId, number>>({ ...BLANK_FLAVORS });
  const [encomendas, setEncomendas] = useState<Record<FlavorId, number>>({ ...BLANK_FLAVORS });
  const [ajustes, setAjustes] = useState<Partial<Record<FlavorId, number>>>({});
  const [dlsemToggle, setDlsemToggle] = useState(false);
  const [totalProducao, setTotalProducao] = useState(196);

  // Texto das encomendas
  const [textoInput, setTextoInput] = useState("");
  const [textoEncomendas, setTextoEncomendas] = useState("");
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);

  // Estado de cálculo
  const [flavorData, setFlavorData] = useState<Record<FlavorId, FlavorData>>(
    {} as Record<FlavorId, FlavorData>
  );
  const [mensagem, setMensagem] = useState("");

  // Loading states
  const [loadingData, setLoadingData] = useState(false);
  const [loadingNotion, setLoadingNotion] = useState(false);
  const [loadingSobras, setLoadingSobras] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toast simples
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // ── Carregar dados do Supabase ──────────────────────────────────────────────

  const loadData = useCallback(async (d: string, s: string) => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/planejamento-get?date=${d}&storeId=${s}`);
      const data = await res.json() as {
        empty?: boolean;
        sobras?: Record<FlavorId, number>;
        encomendas?: Record<FlavorId, number>;
        ajustes?: Record<FlavorId, number>;
        totalProducao?: number;
        dlsemToggle?: boolean;
        orderDetails?: OrderDetail[];
        textoEncomendas?: string;
      };

      if (data.empty) {
        setSobras({ ...BLANK_FLAVORS });
        setEncomendas({ ...BLANK_FLAVORS });
        setAjustes({});
        setTotalProducao(196);
        setDlsemToggle(false);
        setOrderDetails([]);
        setTextoEncomendas("");
      } else {
        setSobras({ ...BLANK_FLAVORS, ...data.sobras });
        setEncomendas({ ...BLANK_FLAVORS, ...data.encomendas });
        setAjustes(data.ajustes ?? {});
        setTotalProducao(data.totalProducao ?? 196);
        setDlsemToggle(data.dlsemToggle ?? false);
        setOrderDetails(data.orderDetails ?? []);
        setTextoEncomendas(data.textoEncomendas ?? "");
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadData(date, storeId);
  }, [date, storeId, loadData]);

  // ── Recalcular produção quando inputs mudam ──────────────────────────────────

  useEffect(() => {
    const result = calcularProducao(sobras, encomendas, totalProducao, dlsemToggle, ajustes);
    setFlavorData(result);
  }, [sobras, encomendas, totalProducao, dlsemToggle, ajustes]);

  // ── Gerar mensagem quando flavorData/context muda ───────────────────────────

  useEffect(() => {
    const efetivos = Object.fromEntries(
      SABORES_IDS.map((id) => [id, flavorData[id]?.ajuste ?? 0])
    ) as Record<FlavorId, number>;
    const msg = gerarMensagem(efetivos, date, storeId, encomendas.DLSem, textoEncomendas);
    setMensagem(msg);
  }, [flavorData, date, storeId, encomendas.DLSem, textoEncomendas]);

  // ── Auto-save com debounce 1s ────────────────────────────────────────────────

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch("/api/planejamento-save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date, storeId, sobras, encomendas,
            ajustes: Object.fromEntries(
              SABORES_IDS.map((id) => [id, flavorData[id]?.ajuste ?? 0])
            ),
            totalProducao, dlsemToggle, orderDetails,
            formattedMessage: mensagem, textoEncomendas,
          }),
        });
      } catch {
        // silently ignore
      }
    }, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [sobras, encomendas, ajustes, totalProducao, dlsemToggle, date, storeId, mensagem, textoEncomendas, orderDetails]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleSobra(id: FlavorId, v: number) {
    setSobras((s) => ({ ...s, [id]: v }));
  }

  function handleEncomenda(id: FlavorId, v: number) {
    setEncomendas((s) => ({ ...s, [id]: v }));
  }

  function handleAjuste(id: FlavorId, v: number) {
    setAjustes((s) => ({ ...s, [id]: v }));
  }

  function resetAjustes() {
    setAjustes({});
  }

  async function handleBuscarSobras() {
    const yesterday = getPreviousBusinessDay(date);
    setLoadingSobras(true);
    try {
      const res = await fetch(`/api/planejamento-sobras?date=${yesterday}&storeId=${storeId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { sobras?: Record<FlavorId, number>; empty?: boolean; error?: string };
      if (data.error) throw new Error(data.error);
      if (data.empty) {
        showToast(`Sem estoque registrado para ${yesterday}`, "err");
      } else {
        setSobras({ ...BLANK_FLAVORS, ...data.sobras });
        setAjustes({});
        showToast("Sobras carregadas!");
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao buscar sobras", "err");
    } finally {
      setLoadingSobras(false);
    }
  }

  async function handleBuscarNotion() {
    setLoadingNotion(true);
    try {
      const res = await fetch(`/api/planejamento-notion?date=${date}&storeId=${storeId}`);
      const data = await res.json() as {
        error?: string;
        encomendas?: Record<FlavorId, number>;
        orderDetails?: OrderDetail[];
        textoEncomendas?: string;
      };
      if (data.error) throw new Error(data.error);

      setEncomendas({ ...BLANK_FLAVORS, ...data.encomendas });
      setOrderDetails(data.orderDetails ?? []);
      setTextoEncomendas(data.textoEncomendas ?? "");
      if ((data.encomendas?.DLSem ?? 0) > 0) setDlsemToggle(true);
      setAjustes({}); // recalcular sugestões com as novas encomendas
      showToast("Encomendas carregadas do Notion!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao buscar do Notion", "err");
    } finally {
      setLoadingNotion(false);
    }
  }

  function handleProcessarTexto() {
    if (!textoInput.trim()) return;
    const parsed = parseTextToFlavors(textoInput);
    setEncomendas((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(parsed) as FlavorId[]) {
        next[id] = (next[id] ?? 0) + parsed[id];
      }
      return next;
    });
    if (parsed.DLSem > 0) setDlsemToggle(true);
    setTextoEncomendas((prev) => (prev ? prev + "\n\n" + textoInput : textoInput));
    setTextoInput("");
    showToast("Texto processado e adicionado!");
  }

  async function handleCopiar() {
    await navigator.clipboard.writeText(mensagem);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Totais para display ──────────────────────────────────────────────────────

  const totalSobras = Object.values(sobras).reduce((a, b) => a + b, 0);
  const totalEncomendas = Object.values(encomendas).reduce((a, b) => a + b, 0);
  const totalParaLoja = Math.max(0, totalProducao + totalSobras - totalEncomendas);
  const totalAjustes = SABORES_IDS.reduce((sum, id) => sum + (flavorData[id]?.ajuste ?? 0), 0);
  const totalFechado = totalAjustes === totalProducao;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-8">

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all
            ${toast.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── 1. Header — data + loja ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-brand-brown">🍫 Planejamento PDM</h1>
          {loadingData && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>

        {/* Data */}
        <div className="mb-3">
          <p className={labelCls}>Data de produção</p>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setDate(todayISO())}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${date === todayISO() ? "bg-brand-brown text-white" : "border border-gray-200 text-gray-700 hover:border-gray-400"}`}
            >
              Hoje
            </button>
            <button
              onClick={() => setDate(tomorrowISO())}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer ${date === tomorrowISO() ? "bg-brand-brown text-white" : "border border-gray-200 text-gray-700 hover:border-gray-400"}`}
            >
              Amanhã
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-brand-brown"
            />
          </div>
        </div>

        {/* Loja */}
        <div>
          <p className={labelCls}>Loja</p>
          <div className="flex gap-2">
            {STORES.map((s) => (
              <button
                key={s.id}
                onClick={() => setStoreId(s.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors cursor-pointer ${
                  storeId === s.id
                    ? "bg-brand-brown text-white border-brand-brown"
                    : "border-gray-200 text-gray-700 hover:border-gray-400"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Card Encomendas ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Encomendas
          </h2>
          <button
            onClick={() => { setEncomendas({ ...BLANK_FLAVORS }); setDlsemToggle(false); setTextoEncomendas(""); setOrderDetails([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Resetar
          </button>
        </div>

        {/* Notion + Texto */}
        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            onClick={() => void handleBuscarNotion()}
            disabled={loadingNotion}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 cursor-pointer transition-colors"
          >
            {loadingNotion ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span>📥</span>}
            Buscar do Notion
          </button>
        </div>

        {/* Textarea para texto */}
        <div className="mb-3">
          <textarea
            value={textoInput}
            onChange={(e) => setTextoInput(e.target.value)}
            placeholder={"Cole aqui o texto das encomendas...\nExemplo: 15 dln, 10 car"}
            rows={3}
            className={`${inputCls} resize-none font-mono text-xs`}
          />
          <button
            onClick={handleProcessarTexto}
            disabled={!textoInput.trim()}
            className="mt-1.5 text-xs text-brand-brown font-medium hover:underline disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            📝 Processar texto
          </button>
        </div>

        {/* Lista de sabores */}
        <div className="divide-y divide-gray-50">
          {/* DLSem com toggle */}
          <div className={`py-1.5 ${!dlsemToggle ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer flex-1 mr-3">
                <input
                  type="checkbox"
                  checked={dlsemToggle}
                  onChange={(e) => {
                    setDlsemToggle(e.target.checked);
                    if (!e.target.checked) setEncomendas((s) => ({ ...s, DLSem: 0 }));
                  }}
                  className="accent-brand-brown"
                />
                <span className="text-sm text-gray-700">
                  🟫 Doce de Leite sem Nozes
                </span>
              </label>
              {dlsemToggle && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => handleEncomenda("DLSem", Math.max(0, encomendas.DLSem - 1))}
                    disabled={encomendas.DLSem === 0}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <input
                    type="number" min="0"
                    value={encomendas.DLSem === 0 ? "" : encomendas.DLSem}
                    onChange={(e) => handleEncomenda("DLSem", parseInt(e.target.value, 10) || 0)}
                    className="w-12 text-center text-sm font-medium border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown text-brand-brown"
                    placeholder="0"
                  />
                  <button
                    onClick={() => handleEncomenda("DLSem", encomendas.DLSem + 1)}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Outros sabores */}
          {SABORES.filter((s) => s.id !== "DLSem").map((sabor) => (
            <FlavorRow
              key={sabor.id}
              sabor={sabor}
              value={encomendas[sabor.id]}
              onChange={(v) => handleEncomenda(sabor.id, v)}
            />
          ))}
        </div>
      </div>

      {/* ── 3. Card Sobras ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Sobras do Dia Anterior
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleBuscarSobras}
              disabled={loadingSobras}
              className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-2.5 py-1 hover:border-gray-400 hover:text-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingSobras
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <RefreshCw className="h-3 w-3" />}
              Buscar Sobras
            </button>
            <button
              onClick={() => setSobras({ ...BLANK_FLAVORS })}
              className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              Resetar
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {SABORES.filter((s) => s.id !== "DLSem" || dlsemToggle).map((sabor) => (
            <FlavorRow
              key={sabor.id}
              sabor={sabor}
              value={sobras[sabor.id]}
              onChange={(v) => handleSobra(sabor.id, v)}
            />
          ))}
        </div>
      </div>

      {/* ── 4. Card Quantidade ───────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">
          Quantidade a Produzir
        </h2>

        <div className="flex items-center gap-4 mb-3">
          <input
            type="range"
            min={0} max={980} step={49}
            value={totalProducao}
            onChange={(e) => setTotalProducao(parseInt(e.target.value, 10))}
            className="flex-1 accent-brand-brown"
          />
          <input
            type="number"
            min="0"
            value={totalProducao}
            onChange={(e) => setTotalProducao(parseInt(e.target.value, 10) || 0)}
            className="w-20 text-center text-lg font-bold border border-gray-200 rounded-lg py-1 outline-none focus:border-brand-brown"
          />
        </div>

        <div className="flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="bg-gray-100 rounded-full px-3 py-1">
            Sobras: <strong className="text-gray-700">{totalSobras}</strong>
          </span>
          <span className="bg-gray-100 rounded-full px-3 py-1">
            Encomendas: <strong className="text-gray-700">{totalEncomendas}</strong>
          </span>
          <span className="bg-gray-100 rounded-full px-3 py-1">
            Para loja: <strong className="text-gray-700">{totalParaLoja}</strong>
          </span>
        </div>
      </div>

      {/* ── 5. Tabela de Cálculo ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Cálculo de Produção
          </h2>
          <button
            onClick={resetAjustes}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Resetar ajustes
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-brand-brown text-white text-left">
                <th className="px-3 py-2 font-semibold">Sabor</th>
                <th className="px-3 py-2 font-semibold text-center hidden md:table-cell">Sobra</th>
                <th className="px-3 py-2 font-semibold text-center hidden md:table-cell">Enc</th>
                <th className="px-3 py-2 font-semibold text-center hidden md:table-cell">Meta</th>
                <th className="px-3 py-2 font-semibold text-center">Sug.</th>
                <th className="px-3 py-2 font-semibold text-center">Ajuste</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {SABORES.filter((s) => s.id !== "DLSem" || dlsemToggle).map((sabor) => {
                const row = flavorData[sabor.id] ?? { sobra: 0, encomenda: 0, metaLoja: 0, sugerido: 0, ajuste: 0 };
                const isRestante = sabor.id === SABOR_RESTANTE;
                return (
                  <tr key={sabor.id} className={isRestante ? "bg-amber-50/50" : ""}>
                    <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                      <span className="mr-1">{sabor.emoji}</span>
                      {sabor.id}
                      {isRestante && <span className="ml-1 text-gray-400 font-normal text-[10px]">(rest.)</span>}
                    </td>
                    <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell">{row.sobra}</td>
                    <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell">{row.encomenda}</td>
                    <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell">{row.metaLoja}</td>
                    <td className="px-3 py-2 text-center font-medium text-gray-700">{row.sugerido}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleAjuste(sabor.id, Math.max(0, row.ajuste - 1))}
                          className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={row.ajuste}
                          onChange={(e) => handleAjuste(sabor.id, parseInt(e.target.value, 10) || 0)}
                          className="w-12 text-center text-sm font-bold border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown text-brand-brown"
                        />
                        <button
                          onClick={() => handleAjuste(sabor.id, row.ajuste + 1)}
                          className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex justify-end">
          <span
            className={`inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full ${
              totalFechado
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700"
            }`}
          >
            {totalFechado ? "✓" : "✗"} Total: {totalAjustes} / {totalProducao}
          </span>
        </div>
      </div>

      {/* ── 6. Mensagem Final ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Mensagem de Produção
          </h2>
          <button
            onClick={() => void handleCopiar()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-brand-brown text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
        <textarea
          value={mensagem}
          readOnly
          rows={12}
          className="w-full font-mono text-xs border border-gray-100 rounded-lg p-3 bg-gray-50 text-gray-700 resize-none outline-none whitespace-pre"
        />
      </div>

    </div>
  );
}
