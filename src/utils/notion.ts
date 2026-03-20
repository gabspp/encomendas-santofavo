import type { BoxConfig } from "@/types";

// ─── Caixas helpers ─────────────────────────────────────────────────────────

// Abbreviated flavor names for compact display
export const PDM_SHORT: Record<string, string> = {
  "🟫 PDM DLN":  "Dln",
  "🟥 PDM CAR":  "Car",
  "🟨 PDM MAR":  "Mar",
  "⬛️ PDM CAJU": "Caju",
  "🟦 PDM SR":   "Sr",
  "🟧 PDM LAR":  "Lar",
  "⬜️ PDM MÊS":  "Mês",
  "PDM DL Sem":  "DL Sem",
};

// All 8 PDM flavor fields (keys used in Notion / draft.products)
export const PDM_FLAVOR_FIELDS = Object.keys(PDM_SHORT);

// Serialize boxes[] → "[Caixas: 2×6(DLN:2,CAR:2,MAR:2)|1×6(DLN:3,CAJU:1,LAR:2)]"
// Returns "" if no boxes
export function buildCaixasStr(boxes: BoxConfig[]): string {
  if (!boxes.length) return "";
  const parts = boxes
    .filter((b) => b.quantity > 0)
    .map((b) => {
      const flavorParts = Object.entries(b.flavors)
        .filter(([, qty]) => qty > 0)
        .map(([field, qty]) => `${PDM_SHORT[field] ?? field}:${qty}`)
        .join(",");
      return `${b.quantity}×${b.size}(${flavorParts})`;
    });
  return parts.length ? `[Caixas: ${parts.join("|")}]` : "";
}

// Extract "[Caixas: ...]" block from observacao → raw string inside brackets (or null)
export function extractCaixasStr(obs: string): string | null {
  if (!obs) return null;
  const match = obs.match(/\[Caixas: ([^\]]+)\]/);
  return match ? match[1] : null;
}

// Remove "[Caixas: ...]" block from observacao
export function stripCaixas(obs: string): string {
  if (!obs) return "";
  return obs.replace(/\[Caixas: [^\]]+\]\n?/, "").trim();
}

// ─── Horário helpers ─────────────────────────────────────────────────────────

// Extract "Horário: 14h" from observacao → "14h" (or null)
export function extractHorario(obs: string): string | null {
  if (!obs) return null;
  const match = obs.match(/[Hh]or[aá]rio:\s*([^\n]+)/);
  return match ? match[1].trim() : null;
}

// Remove the "Horário: X" line from observacao
export function stripHorario(obs: string): string {
  if (!obs) return "";
  return obs.replace(/[Hh]or[aá]rio:\s*[^\n]+\n?/, "").trim();
}

// Format "YYYY-MM-DD" → "dd/mm"
export function formatBrDate(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  return `${parts[2]}/${parts[1]}`;
}

// Format "YYYY-MM-DD" → "dd/mm/yyyy"
export function formatBrDateFull(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

const WEEK_DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// Format "YYYY-MM-DD" → "dd/mm (Seg)"
export function formatBrDateWithDay(isoDate: string): string {
  if (!isoDate) return "";
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day); // local time, sem shift de timezone
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")} (${WEEK_DAYS[date.getDay()]})`;
}
