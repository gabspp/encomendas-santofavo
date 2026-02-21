import type { FilterState } from "@/types";

interface FilterBarProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
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
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-8 shrink-0">
        {label}
      </span>
      <div className="flex gap-1">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer ${
              value === opt.value
                ? "bg-brand-brown text-white"
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

export function FilterBar({ filters, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap gap-4 items-center py-3 border-b border-gray-200">
      <PillGroup<FilterState["loja"]>
        label="Loja"
        options={[
          { value: "todas", label: "Todas" },
          { value: "26", label: "26B" },
          { value: "248", label: "CONDOR 248" },
        ]}
        value={filters.loja}
        onChange={(v) => onChange({ ...filters, loja: v })}
      />
      <PillGroup<FilterState["tipo"]>
        label="Tipo"
        options={[
          { value: "todos", label: "Todos" },
          { value: "entregas", label: "🚚 Entregas" },
          { value: "retiradas", label: "📦 Retiradas" },
        ]}
        value={filters.tipo}
        onChange={(v) => onChange({ ...filters, tipo: v })}
      />
    </div>
  );
}
