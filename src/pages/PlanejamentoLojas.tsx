import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Copy, Loader2, RefreshCw, ArrowRight } from "lucide-react";
import {
  SABORES,
  SABORES_IDS,
  BLANK_FLAVORS,
  TRAY_SIZE,
  sugerirTotalProducao,
  aplicarTransferencia,
  parseTextToFlavors,
} from "@/utils/producao";
import type { FlavorId, FlavorData, OrderDetail, TransferenciaAjuste } from "@/utils/producao";
import type { StoreId } from "@/utils/estoque";
import { usePlanejamentoLoja } from "@/hooks/usePlanejamentoLoja";

interface SobrasLatestResponse {
  empty?: boolean;
  date?: string | null;
  sobras?: Record<string, number>;
}

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
function fmtSobraDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ── Estilos compartilhados ────────────────────────────────────────────────────

const inputCls =
  "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand-brown transition-colors bg-white";
const labelCls =
  "block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5";

// ── FlavorRow local (duplicado de Planejamento.tsx para não arriscar a página em uso diário) ──

function FlavorRow({
  sabor,
  value,
  onChange,
}: {
  sabor: (typeof SABORES)[number];
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-gray-700 flex-1 mr-3 leading-tight">
        <span className="mr-1">{sabor.emoji}</span>
        {sabor.nome}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <input
          type="number"
          min="0"
          value={value === 0 ? "" : value}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className={`w-12 text-center text-sm font-medium border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown transition-colors ${value > 0 ? "text-brand-brown" : "text-gray-400"}`}
          placeholder="0"
        />
        <button
          onClick={() => onChange(value + 1)}
          className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer"
        >
          +
        </button>
      </div>
    </div>
  );
}

// ── Tabela de cálculo por loja ────────────────────────────────────────────────

function TabelaCalculo({
  storeLabel,
  flavorData,
  dlsemToggle,
  totalAjustes,
  totalProducao,
  totalFechado,
  onAjuste,
  onResetAjustes,
}: {
  storeLabel: string;
  flavorData: Record<FlavorId, FlavorData>;
  dlsemToggle: boolean;
  totalAjustes: number;
  totalProducao: number;
  totalFechado: boolean;
  onAjuste: (id: FlavorId, v: number) => void;
  onResetAjustes: () => void;
}) {
  const sabores = SABORES.filter((s) => s.id !== "DLSem" || dlsemToggle);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">{storeLabel}</h3>
        <button onClick={onResetAjustes} className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer">
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
            {sabores.map((sabor) => {
              const row = flavorData[sabor.id] ?? { sobra: 0, encomenda: 0, metaLoja: 0, sugerido: 0, ajuste: 0 };
              return (
                <tr key={sabor.id}>
                  <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">
                    <span className="mr-1">{sabor.emoji}</span>
                    {sabor.id}
                  </td>
                  <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell">{row.sobra}</td>
                  <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell">{row.encomenda}</td>
                  <td className="px-3 py-2 text-center text-gray-500 hidden md:table-cell">{row.metaLoja}</td>
                  <td className="px-3 py-2 text-center font-medium text-gray-700">{row.sugerido}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => onAjuste(sabor.id, Math.max(0, row.ajuste - 1))}
                        className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={row.ajuste}
                        onChange={(e) => onAjuste(sabor.id, parseInt(e.target.value, 10) || 0)}
                        className="w-12 text-center text-sm font-bold border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown text-brand-brown"
                      />
                      <button
                        onClick={() => onAjuste(sabor.id, row.ajuste + 1)}
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
            totalFechado ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          }`}
        >
          {totalFechado ? "✓" : "✗"} Total: {totalAjustes} / {totalProducao}
        </span>
      </div>
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function PlanejamentoLojas() {
  const [date, setDate] = useState<string>(todayISO());

  // Venda média diária (config persistida)
  const [vendaDiaria, setVendaDiaria] = useState<Record<StoreId, number>>({ "26": 0, "248": 0 });

  // Sobras brutas (pré-transferência) + transferência 26→248
  const [sobraBase26, setSobraBase26] = useState<Record<FlavorId, number>>({ ...BLANK_FLAVORS });
  const [sobraBase248, setSobraBase248] = useState<Record<FlavorId, number>>({ ...BLANK_FLAVORS });
  const [transferencia, setTransferencia] = useState<TransferenciaAjuste>({});
  // Data de origem de cada contagem trazida pela busca (só para exibição)
  const [sobrasDate26, setSobrasDate26] = useState<string | null>(null);
  const [sobrasDate248, setSobrasDate248] = useState<string | null>(null);

  // Encomendas (sempre loja 26)
  const [encomendas26, setEncomendas26] = useState<Record<FlavorId, number>>({ ...BLANK_FLAVORS });
  const [orderDetails, setOrderDetails] = useState<OrderDetail[]>([]);
  const [textoEncomendas, setTextoEncomendas] = useState("");
  const [textoInput, setTextoInput] = useState("");

  // Loading / toast
  const [loadingData, setLoadingData] = useState(false);
  const [loadingNotion, setLoadingNotion] = useState(false);
  const [loadingSobras, setLoadingSobras] = useState(false);
  const [copied26, setCopied26] = useState(false);
  const [copied248, setCopied248] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function showToast(msg: string, type: "ok" | "err" = "ok") {
    setToast({ msg, type });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // Sobras efetivas (pós-transferência) — memoizadas para não disparar recálculo à toa
  const sobrasEfetivas = useMemo(
    () => aplicarTransferencia(sobraBase26, sobraBase248, transferencia),
    [sobraBase26, sobraBase248, transferencia],
  );

  const loja26 = usePlanejamentoLoja({
    storeId: "26",
    date,
    sobras: sobrasEfetivas.sobras26,
    encomendas: encomendas26,
    textoEncomendas,
  });
  const loja248 = usePlanejamentoLoja({
    storeId: "248",
    date,
    sobras: sobrasEfetivas.sobras248,
    encomendas: BLANK_FLAVORS,
    textoEncomendas: "",
  });

  // ── Carregar venda média diária (uma vez) ───────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/planejamento-lojas?resource=store-config`);
        const data = (await res.json()) as { configs?: Record<StoreId, { vendaDiaria: number }> };
        if (data.configs) {
          setVendaDiaria({
            "26": data.configs["26"]?.vendaDiaria ?? 0,
            "248": data.configs["248"]?.vendaDiaria ?? 0,
          });
        }
      } catch {
        // silently ignore
      }
    })();
  }, []);

  function handleVendaDiaria(storeId: StoreId, v: number) {
    setVendaDiaria((prev) => ({ ...prev, [storeId]: v }));
  }

  async function handleVendaDiariaBlur(storeId: StoreId) {
    try {
      await fetch("/api/planejamento-lojas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "store-config", storeId, vendaDiaria: vendaDiaria[storeId] }),
      });
    } catch {
      // silently ignore
    }
  }

  // ── Carregar dados do dia (production_records das duas lojas) ──────────────

  const loadData = useCallback(async (d: string) => {
    setLoadingData(true);
    setSobrasDate26(null);
    setSobrasDate248(null);
    try {
      const [res26, res248] = await Promise.all([
        fetch(`/api/planejamento-get?date=${d}&storeId=26`),
        fetch(`/api/planejamento-get?date=${d}&storeId=248`),
      ]);
      const data26 = (await res26.json()) as PlanejamentoGetResponse;
      const data248 = (await res248.json()) as PlanejamentoGetResponse;

      if (data26.empty && data248.empty) {
        setSobraBase26({ ...BLANK_FLAVORS });
        setSobraBase248({ ...BLANK_FLAVORS });
        setTransferencia({});
        setEncomendas26({ ...BLANK_FLAVORS });
        setOrderDetails([]);
        setTextoEncomendas("");
        loja26.setAjustes({});
        loja26.setTotalProducao(0);
        loja26.setDlsemToggle(false);
        loja248.setAjustes({});
        loja248.setTotalProducao(0);
        loja248.setDlsemToggle(false);
        setLoadingData(false);
        return;
      }

      const transf248 = (data248.transferenciaAjuste ?? {}) as TransferenciaAjuste;
      const transf26 = (data26.transferenciaAjuste ?? {}) as TransferenciaAjuste;

      const base26 = { ...BLANK_FLAVORS };
      const base248 = { ...BLANK_FLAVORS };
      for (const id of SABORES_IDS) {
        base26[id] = (data26.sobras?.[id] ?? 0) - (transf26[id] ?? 0);
        base248[id] = (data248.sobras?.[id] ?? 0) - (transf248[id] ?? 0);
      }

      setSobraBase26(base26);
      setSobraBase248(base248);
      setTransferencia(transf248);
      setEncomendas26({ ...BLANK_FLAVORS, ...data26.encomendas });
      setOrderDetails(data26.orderDetails ?? []);
      setTextoEncomendas(data26.textoEncomendas ?? "");

      loja26.setAjustes(data26.ajustes ?? {});
      loja26.setTotalProducao(data26.totalProducao ?? 0);
      loja26.setDlsemToggle(data26.dlsemToggle ?? false);

      loja248.setAjustes(data248.ajustes ?? {});
      loja248.setTotalProducao(data248.totalProducao ?? 0);
      loja248.setDlsemToggle(false);
    } catch {
      showToast("Erro ao carregar dados", "err");
    } finally {
      setLoadingData(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadData(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // ── Buscar sobras (26 e 248) ─────────────────────────────────────────────────

  async function handleBuscarSobras() {
    setLoadingSobras(true);
    try {
      // Cada loja puxa sua contagem de estoque mais recente (report_date <= data
      // do planejamento), independentemente — resolve o caso de as duas lojas
      // terem a última contagem em datas diferentes.
      const [res26, res248] = await Promise.all([
        fetch(`/api/planejamento-lojas?resource=sobras-latest&date=${date}&storeId=26`),
        fetch(`/api/planejamento-lojas?resource=sobras-latest&date=${date}&storeId=248`),
      ]);
      const data26 = (await res26.json()) as SobrasLatestResponse;
      const data248 = (await res248.json()) as SobrasLatestResponse;

      if (data26.empty && data248.empty) {
        showToast("Nenhuma contagem de estoque encontrada", "err");
        return;
      }

      setSobraBase26({ ...BLANK_FLAVORS, ...data26.sobras });
      setSobraBase248({ ...BLANK_FLAVORS, ...data248.sobras });
      setSobrasDate26(data26.date ?? null);
      setSobrasDate248(data248.date ?? null);
      setTransferencia({});
      loja26.setAjustes({});
      loja248.setAjustes({});
      showToast("Sobras carregadas!");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erro ao buscar sobras", "err");
    } finally {
      setLoadingSobras(false);
    }
  }

  function handleSobra26(id: FlavorId, v: number) {
    setSobraBase26((s) => ({ ...s, [id]: v }));
  }
  function handleSobra248(id: FlavorId, v: number) {
    setSobraBase248((s) => ({ ...s, [id]: v }));
  }
  function handleTransferencia(id: FlavorId, v: number) {
    setTransferencia((s) => ({ ...s, [id]: v }));
  }

  // ── Encomendas (Notion + texto) ──────────────────────────────────────────────

  async function handleBuscarNotion() {
    setLoadingNotion(true);
    try {
      const res = await fetch(`/api/planejamento-notion?date=${date}`);
      const data = (await res.json()) as {
        error?: string;
        encomendas?: Record<FlavorId, number>;
        orderDetails?: OrderDetail[];
        textoEncomendas?: string;
      };
      if (data.error) throw new Error(data.error);

      setEncomendas26({ ...BLANK_FLAVORS, ...data.encomendas });
      setOrderDetails(data.orderDetails ?? []);
      setTextoEncomendas(data.textoEncomendas ?? "");
      if ((data.encomendas?.DLSem ?? 0) > 0) loja26.setDlsemToggle(true);
      loja26.setAjustes({});
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
    setEncomendas26((prev) => {
      const next = { ...prev };
      for (const id of Object.keys(parsed) as FlavorId[]) {
        next[id] = (next[id] ?? 0) + parsed[id];
      }
      return next;
    });
    if (parsed.DLSem > 0) loja26.setDlsemToggle(true);
    setTextoEncomendas((prev) => (prev ? prev + "\n\n" + textoInput : textoInput));
    setTextoInput("");
    showToast("Texto processado e adicionado!");
  }

  // ── Auto-save (debounce 1s) — uma requisição por loja ───────────────────────

  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const transf248: TransferenciaAjuste = {};
      const transf26: TransferenciaAjuste = {};
      for (const id of SABORES_IDS) {
        const t = transferencia[id] ?? 0;
        transf248[id] = t;
        transf26[id] = -t;
      }

      try {
        await Promise.all([
          fetch("/api/planejamento-save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date, storeId: "26",
              sobras: sobrasEfetivas.sobras26, encomendas: encomendas26,
              ajustes: Object.fromEntries(SABORES_IDS.map((id) => [id, loja26.flavorData[id]?.ajuste ?? 0])),
              totalProducao: loja26.totalProducao, dlsemToggle: loja26.dlsemToggle,
              orderDetails, formattedMessage: loja26.mensagem, textoEncomendas,
              transferenciaAjuste: transf26,
            }),
          }),
          fetch("/api/planejamento-save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              date, storeId: "248",
              sobras: sobrasEfetivas.sobras248, encomendas: BLANK_FLAVORS,
              ajustes: Object.fromEntries(SABORES_IDS.map((id) => [id, loja248.flavorData[id]?.ajuste ?? 0])),
              totalProducao: loja248.totalProducao, dlsemToggle: false,
              orderDetails: [], formattedMessage: loja248.mensagem, textoEncomendas: "",
              transferenciaAjuste: transf248,
            }),
          }),
        ]);
      } catch {
        // silently ignore
      }
    }, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [date, sobrasEfetivas, encomendas26, orderDetails, textoEncomendas, transferencia, loja26.flavorData, loja26.totalProducao, loja26.dlsemToggle, loja26.mensagem, loja248.flavorData, loja248.totalProducao, loja248.mensagem]);

  // ── Copiar mensagens ─────────────────────────────────────────────────────────

  async function handleCopiar(storeId: StoreId) {
    const mensagem = storeId === "26" ? loja26.mensagem : loja248.mensagem;
    await navigator.clipboard.writeText(mensagem);
    if (storeId === "26") { setCopied26(true); setTimeout(() => setCopied26(false), 2000); }
    else { setCopied248(true); setTimeout(() => setCopied248(false), 2000); }
  }

  // ── Totais para sugestão de quantidade ───────────────────────────────────────

  const totalSobras26 = SABORES_IDS.reduce((s, id) => s + (sobrasEfetivas.sobras26[id] ?? 0), 0);
  const totalSobras248 = SABORES_IDS.reduce((s, id) => s + (sobrasEfetivas.sobras248[id] ?? 0), 0);
  const totalEncomendas26 = SABORES_IDS.reduce((s, id) => s + (encomendas26[id] ?? 0), 0);

  const sugestao26 = sugerirTotalProducao(vendaDiaria["26"], totalSobras26, totalEncomendas26);
  const sugestao248 = sugerirTotalProducao(vendaDiaria["248"], totalSobras248, 0);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-8">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg transition-all
            ${toast.type === "ok" ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}
        >
          {toast.msg}
        </div>
      )}

      {/* ── 1. Header — data ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold text-brand-brown">🍫🍫 Planejamento PDM — 2 Lojas</h1>
          {loadingData && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
        </div>
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

      {/* ── 2. Venda Média Diária ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-1">Venda Média Diária</h2>
        <p className="text-xs text-gray-400 mb-3">
          Usada para sugerir o total a produzir: venda × 2 dias − sobra + encomendas.
        </p>
        <div className="flex gap-4 flex-wrap">
          {(["26", "248"] as StoreId[]).map((s) => (
            <div key={s}>
              <p className={labelCls}>Loja {s}</p>
              <input
                type="number"
                min="0"
                value={vendaDiaria[s] === 0 ? "" : vendaDiaria[s]}
                placeholder="0"
                onChange={(e) => handleVendaDiaria(s, parseInt(e.target.value, 10) || 0)}
                onBlur={() => void handleVendaDiariaBlur(s)}
                className="w-28 text-center text-sm font-bold border border-gray-200 rounded-lg py-1.5 outline-none focus:border-brand-brown"
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── 3. Encomendas (loja 26) ──────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Encomendas (sempre Loja 26)
          </h2>
          <button
            onClick={() => { setEncomendas26({ ...BLANK_FLAVORS }); loja26.setDlsemToggle(false); setTextoEncomendas(""); setOrderDetails([]); }}
            className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            Resetar
          </button>
        </div>

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

        <div className="divide-y divide-gray-50">
          <div className={`py-1.5 ${!loja26.dlsemToggle ? "opacity-50" : ""}`}>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer flex-1 mr-3">
                <input
                  type="checkbox"
                  checked={loja26.dlsemToggle}
                  onChange={(e) => {
                    loja26.setDlsemToggle(e.target.checked);
                    if (!e.target.checked) setEncomendas26((s) => ({ ...s, DLSem: 0 }));
                  }}
                  className="accent-brand-brown"
                />
                <span className="text-sm text-gray-700">🟫 Doce de Leite sem Nozes</span>
              </label>
              {loja26.dlsemToggle && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setEncomendas26((s) => ({ ...s, DLSem: Math.max(0, s.DLSem - 1) }))}
                    disabled={encomendas26.DLSem === 0}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 flex items-center justify-center text-base leading-none cursor-pointer disabled:cursor-not-allowed"
                  >
                    −
                  </button>
                  <input
                    type="number" min="0"
                    value={encomendas26.DLSem === 0 ? "" : encomendas26.DLSem}
                    onChange={(e) => setEncomendas26((s) => ({ ...s, DLSem: parseInt(e.target.value, 10) || 0 }))}
                    className="w-12 text-center text-sm font-medium border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown text-brand-brown"
                    placeholder="0"
                  />
                  <button
                    onClick={() => setEncomendas26((s) => ({ ...s, DLSem: s.DLSem + 1 }))}
                    className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center justify-center text-base leading-none cursor-pointer"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </div>

          {SABORES.filter((s) => s.id !== "DLSem").map((sabor) => (
            <FlavorRow
              key={sabor.id}
              sabor={sabor}
              value={encomendas26[sabor.id]}
              onChange={(v) => setEncomendas26((s) => ({ ...s, [sabor.id]: v }))}
            />
          ))}
        </div>
      </div>

      {/* ── 4. Sobras + Transferência ────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Sobras + Transferência</h2>
          <button
            onClick={handleBuscarSobras}
            disabled={loadingSobras}
            className="flex items-center gap-1 text-xs text-gray-500 border border-gray-200 rounded-full px-2.5 py-1 hover:border-gray-400 hover:text-gray-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingSobras ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Buscar Sobras (26 e 248)
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className={labelCls}>
              Sobra base — Loja 26
              {sobrasDate26 && <span className="ml-1 normal-case font-normal text-gray-400">(contagem de {fmtSobraDate(sobrasDate26)})</span>}
            </p>
            <div className="divide-y divide-gray-50">
              {SABORES.filter((s) => s.id !== "DLSem").map((sabor) => (
                <FlavorRow key={sabor.id} sabor={sabor} value={sobraBase26[sabor.id]} onChange={(v) => handleSobra26(sabor.id, v)} />
              ))}
            </div>
          </div>
          <div>
            <p className={labelCls}>
              Sobra base — Loja 248
              {sobrasDate248 && <span className="ml-1 normal-case font-normal text-gray-400">(contagem de {fmtSobraDate(sobrasDate248)})</span>}
            </p>
            <div className="divide-y divide-gray-50">
              {SABORES.filter((s) => s.id !== "DLSem").map((sabor) => (
                <FlavorRow key={sabor.id} sabor={sabor} value={sobraBase248[sabor.id]} onChange={(v) => handleSobra248(sabor.id, v)} />
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className={labelCls}>Transferência 26 → 248</p>
          <div className="divide-y divide-gray-50">
            {SABORES.filter((s) => s.id !== "DLSem").map((sabor) => (
              <div key={sabor.id} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-gray-700 flex-1 mr-3 leading-tight">
                  <span className="mr-1">{sabor.emoji}</span>
                  {sabor.nome}
                  <span className="ml-2 text-xs text-gray-400">(disp. {sobraBase26[sabor.id]})</span>
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                  <input
                    type="number"
                    min="0"
                    max={sobraBase26[sabor.id]}
                    value={transferencia[sabor.id] ? transferencia[sabor.id] : ""}
                    placeholder="0"
                    onChange={(e) => {
                      const raw = parseInt(e.target.value, 10) || 0;
                      handleTransferencia(sabor.id, Math.min(Math.max(0, raw), sobraBase26[sabor.id]));
                    }}
                    className="w-14 text-center text-sm font-medium border-b border-gray-200 outline-none bg-transparent focus:border-brand-brown text-brand-brown"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 5. Quantidade a Produzir ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-3">Quantidade a Produzir</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {([
            { id: "26" as StoreId, hook: loja26, sugestao: sugestao26 },
            { id: "248" as StoreId, hook: loja248, sugestao: sugestao248 },
          ]).map(({ id, hook, sugestao }) => (
            <div key={id}>
              <div className="flex items-center justify-between mb-1.5">
                <p className={labelCls + " mb-0"}>Loja {id}</p>
                <button
                  onClick={() => hook.setTotalProducao(sugestao)}
                  className="text-xs bg-amber-50 text-brand-brown border border-amber-200 rounded-full px-2.5 py-1 hover:bg-amber-100 cursor-pointer transition-colors"
                >
                  Sugerido: {sugestao} — usar
                </button>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={0} max={980} step={TRAY_SIZE}
                  value={hook.totalProducao}
                  onChange={(e) => hook.setTotalProducao(parseInt(e.target.value, 10))}
                  className="flex-1 accent-brand-brown"
                />
                <input
                  type="number"
                  min="0"
                  value={hook.totalProducao}
                  onChange={(e) => hook.setTotalProducao(parseInt(e.target.value, 10) || 0)}
                  className="w-20 text-center text-lg font-bold border border-gray-200 rounded-lg py-1 outline-none focus:border-brand-brown"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 6. Cálculo de Produção ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TabelaCalculo
          storeLabel="Loja 26"
          flavorData={loja26.flavorData}
          dlsemToggle={loja26.dlsemToggle}
          totalAjustes={loja26.totalAjustes}
          totalProducao={loja26.totalProducao}
          totalFechado={loja26.totalFechado}
          onAjuste={loja26.handleAjuste}
          onResetAjustes={loja26.resetAjustes}
        />
        <TabelaCalculo
          storeLabel="Loja 248"
          flavorData={loja248.flavorData}
          dlsemToggle={false}
          totalAjustes={loja248.totalAjustes}
          totalProducao={loja248.totalProducao}
          totalFechado={loja248.totalFechado}
          onAjuste={loja248.handleAjuste}
          onResetAjustes={loja248.resetAjustes}
        />
      </div>

      {/* ── 7. Mensagens ─────────────────────────────────────────────────────── */}
      {([
        { id: "26" as StoreId, mensagem: loja26.mensagem, copied: copied26 },
        { id: "248" as StoreId, mensagem: loja248.mensagem, copied: copied248 },
      ]).map(({ id, mensagem, copied }) => (
        <div key={id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Mensagem — Loja {id}</h2>
            <button
              onClick={() => void handleCopiar(id)}
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
      ))}
    </div>
  );
}

interface PlanejamentoGetResponse {
  empty?: boolean;
  sobras?: Record<FlavorId, number>;
  encomendas?: Record<FlavorId, number>;
  ajustes?: Record<FlavorId, number>;
  totalProducao?: number;
  dlsemToggle?: boolean;
  orderDetails?: OrderDetail[];
  textoEncomendas?: string;
  transferenciaAjuste?: TransferenciaAjuste;
}
