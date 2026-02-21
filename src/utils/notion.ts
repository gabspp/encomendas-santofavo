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
