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
