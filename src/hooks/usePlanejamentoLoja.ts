import { useEffect, useState } from "react";
import { calcularProducao, gerarMensagem, SABORES_IDS } from "@/utils/producao";
import type { FlavorId, FlavorData } from "@/utils/producao";

interface UsePlanejamentoLojaParams {
  storeId: "26" | "248";
  date: string; // "YYYY-MM-DD"
  sobras: Record<FlavorId, number>; // efetivas (pós-transferência)
  encomendas: Record<FlavorId, number>;
  textoEncomendas: string;
}

/**
 * Encapsula o mesmo par de useEffect de recálculo (calcularProducao →
 * gerarMensagem) usado em Planejamento.tsx, para ser instanciado uma vez
 * por loja no fluxo de planejamento de 2 lojas. O estado (ajustes, total,
 * toggle) começa zerado — quem carrega um dia já salvo usa os setters
 * retornados aqui para repopular a partir de /api/planejamento-get.
 */
export function usePlanejamentoLoja({
  storeId,
  date,
  sobras,
  encomendas,
  textoEncomendas,
}: UsePlanejamentoLojaParams) {
  const [ajustes, setAjustes] = useState<Partial<Record<FlavorId, number>>>({});
  const [dlsemToggle, setDlsemToggle] = useState(false);
  const [totalProducao, setTotalProducao] = useState(0);
  const [flavorData, setFlavorData] = useState<Record<FlavorId, FlavorData>>(
    {} as Record<FlavorId, FlavorData>,
  );
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    const result = calcularProducao(sobras, encomendas, totalProducao, dlsemToggle, ajustes);
    setFlavorData(result);
  }, [sobras, encomendas, totalProducao, dlsemToggle, ajustes]);

  useEffect(() => {
    const efetivos = Object.fromEntries(
      SABORES_IDS.map((id) => [id, flavorData[id]?.ajuste ?? 0]),
    ) as Record<FlavorId, number>;
    const msg = gerarMensagem(efetivos, date, storeId, encomendas.DLSem, textoEncomendas);
    setMensagem(msg);
  }, [flavorData, date, storeId, encomendas.DLSem, textoEncomendas]);

  function handleAjuste(id: FlavorId, v: number) {
    setAjustes((s) => ({ ...s, [id]: v }));
  }

  function resetAjustes() {
    setAjustes({});
  }

  const totalAjustes = SABORES_IDS.reduce((sum, id) => sum + (flavorData[id]?.ajuste ?? 0), 0);
  const totalFechado = totalAjustes === totalProducao;

  return {
    ajustes,
    setAjustes,
    handleAjuste,
    resetAjustes,
    dlsemToggle,
    setDlsemToggle,
    totalProducao,
    setTotalProducao,
    flavorData,
    mensagem,
    totalAjustes,
    totalFechado,
  };
}
