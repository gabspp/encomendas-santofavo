import type { FilterState } from "@/types";

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  showCategoria?: boolean;
}

interface Option<T extends string> {
  value: T;
  label: string;
}

function PillGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  accent,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider shrink-0">
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              value === opt.value
                ? accent
                  ? "bg-brand-yellow text-brand-brown"
                  : "bg-brand-brown text-white"
                : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300 hover:text-gray-800"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function FilterBar({ filters, onChange, showCategoria = true }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center py-3 border-b border-gray-200">
      <PillGroup<FilterState["dateField"]>
        label="Ver por"
        options={[
          { value: "producao", label: "Produção" },
          { value: "entrega",  label: "Entrega" },
        ]}
        value={filters.dateField}
        onChange={(v) => onChange({ ...filters, dateField: v })}
        accent
      />

      <div className="w-px h-5 bg-gray-200 shrink-0" />

      <PillGroup<FilterState["loja"]>
        label="Loja"
        options={[
          { value: "todas", label: "Todas" },
          { value: "26",    label: "26" },
          { value: "248",   label: "248" },
        ]}
        value={filters.loja}
        onChange={(v) => onChange({ ...filters, loja: v })}
      />

      {showCategoria && (
        <PillGroup<FilterState["categoria"]>
          label="Categoria"
          options={[
            { value: "todas",   label: "Todas" },
            { value: "pdm",     label: "PDM" },
            { value: "bolo",    label: "Bolo" },
            { value: "revenda", label: "Revenda" },
          ]}
          value={filters.categoria}
          onChange={(v) => onChange({ ...filters, categoria: v })}
        />
      )}

      <PillGroup<FilterState["saida"]>
        label="Saída"
        options={[
          { value: "todos",    label: "Todos" },
          { value: "entrega",  label: "Entrega" },
          { value: "retirada", label: "Retirada" },
        ]}
        value={filters.saida}
        onChange={(v) => onChange({ ...filters, saida: v })}
      />
    </div>
  );
}
