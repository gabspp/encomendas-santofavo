import {
  AlertCircle,
  Calendar,
  Cake,
  CheckCircle2,
  Egg,
  FileText,
  Gift,
  MapPin,
  Package,
  Phone,
  Repeat2,
  Star,
  Truck,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ParsedOrder } from "@/types";
import { formatBrDateFull } from "@/utils/notion";

// ── Status ──────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  "Em aberto": "bg-gray-100 text-gray-500",
  "Confirmado": "bg-blue-100 text-blue-700",
  "Pronto":     "bg-green-100 text-green-700",
  "Entregue":   "bg-gray-200 text-gray-400",
};

// ── Categoria (ícone da página no Notion) ────────────────────────────────────

interface CategoryDef {
  Icon: LucideIcon;
  label: string;
  className: string;
}

const CATEGORY_MAP: Record<string, CategoryDef> = {
  "✔️": { Icon: CheckCircle2, label: "Pronto",   className: "bg-green-100 text-green-700" },
  "‼️": { Icon: AlertCircle,  label: "Atenção",  className: "bg-red-100 text-red-700" },
  "🔁": { Icon: Repeat2,      label: "Revenda",  className: "bg-blue-100 text-blue-700" },
  "🎂": { Icon: Cake,         label: "Bolo",     className: "bg-pink-100 text-pink-700" },
  "🐰": { Icon: Egg,          label: "Páscoa",   className: "bg-yellow-100 text-yellow-800" },
  "🎅": { Icon: Gift,         label: "Natal",    className: "bg-red-100 text-red-700" },
  "✡️": { Icon: Star,         label: "Rosh Hashaná", className: "bg-amber-100 text-amber-700" },
  // 🟢 = normal, sem badge
};

// ── Entrega ──────────────────────────────────────────────────────────────────

function getDeliveryInfo(entrega: string) {
  const isEntrega = entrega.startsWith("Entrega");
  const loja = entrega.includes("248") ? "248" : entrega.includes("26") ? "26" : "";
  return {
    DeliveryIcon: isEntrega ? Truck : Package,
    loja,
    badgeClass:
      loja === "248"
        ? "bg-purple-100 text-purple-800"
        : loja === "26"
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-600",
  };
}

// ── Component ────────────────────────────────────────────────────────────────

interface OrderCardProps {
  order: ParsedOrder;
}

export function OrderCard({ order }: OrderCardProps) {
  const delivery = getDeliveryInfo(order.entrega);
  const category = CATEGORY_MAP[order.icon] ?? null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">

      {/* Header: nome + badges */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm leading-tight">
          <User size={13} className="text-gray-400 shrink-0" />
          {order.cliente || "—"}
        </h3>
        <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
          {/* Categoria */}
          {category && (
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${category.className}`}>
              <category.Icon size={11} />
              {category.label}
            </span>
          )}
          {/* Status */}
          {order.status && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500"}`}>
              {order.status}
            </span>
          )}
          {/* Loja */}
          {delivery.loja && (
            <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${delivery.badgeClass}`}>
              <delivery.DeliveryIcon size={11} />
              {delivery.loja === "248" ? "CONDOR 248" : "26B"}
            </span>
          )}
        </div>
      </div>

      {/* Tipo de entrega */}
      {order.entrega && (
        <p className="text-xs text-gray-400 -mt-1">{order.entrega}</p>
      )}

      {/* Data de entrega */}
      {order.dataEntrega && (
        <p className="flex items-center gap-1.5 text-xs text-gray-600">
          <Calendar size={12} className="text-gray-400 shrink-0" />
          Entrega:{" "}
          <span className="font-medium">{formatBrDateFull(order.dataEntrega)}</span>
        </p>
      )}

      {/* Produtos */}
      {order.products.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
            Produtos
          </p>
          <div className="flex flex-wrap gap-1">
            {order.products.map((item) => (
              <span
                key={item.name}
                className="text-xs bg-amber-50 text-amber-900 px-2 py-0.5 rounded-full border border-amber-100"
              >
                {item.name}: {item.qty}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Observação */}
      {order.observacao && (
        <div className="flex gap-2 text-xs text-orange-800 bg-orange-50 rounded-md px-3 py-2 border border-orange-100">
          <FileText size={12} className="shrink-0 mt-0.5" />
          <span>{order.observacao}</span>
        </div>
      )}

      {/* Telefone + Endereço */}
      {(order.telefone || order.endereco) && (
        <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-100">
          {order.telefone && (
            <p className="flex items-center gap-1.5">
              <Phone size={12} className="text-gray-400 shrink-0" />
              {order.telefone}
            </p>
          )}
          {order.endereco && (
            <p className="flex items-center gap-1.5">
              <MapPin size={12} className="text-gray-400 shrink-0" />
              {order.endereco}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
