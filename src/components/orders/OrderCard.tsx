import type { ParsedOrder } from "@/types";
import { formatBrDateFull } from "@/utils/notion";

const STATUS_STYLES: Record<string, string> = {
  "Em aberto": "bg-gray-100 text-gray-500",
  "Confirmado": "bg-blue-100 text-blue-700",
  "Pronto":     "bg-green-100 text-green-700",
  "Entregue":   "bg-gray-200 text-gray-400",
};

function getDeliveryInfo(entrega: string) {
  const isEntrega = entrega.startsWith("Entrega");
  const loja = entrega.includes("248")
    ? "248"
    : entrega.includes("26")
      ? "26"
      : "";

  return {
    icon: isEntrega ? "🚚" : "📦",
    loja,
    badgeClass:
      loja === "248"
        ? "bg-purple-100 text-purple-800"
        : loja === "26"
          ? "bg-blue-100 text-blue-800"
          : "bg-gray-100 text-gray-600",
  };
}

interface OrderCardProps {
  order: ParsedOrder;
}

export function OrderCard({ order }: OrderCardProps) {
  const delivery = getDeliveryInfo(order.entrega);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-col gap-3">
      {/* Header: customer name + delivery badge */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight">
          👤 {order.cliente || "—"}
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {order.status && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[order.status] ?? "bg-gray-100 text-gray-500"}`}
            >
              {order.status}
            </span>
          )}
          <span className="text-base">{delivery.icon}</span>
          {delivery.loja && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${delivery.badgeClass}`}
            >
              {delivery.loja === "248" ? "CONDOR 248" : "26B"}
            </span>
          )}
        </div>
      </div>

      {/* Entrega type */}
      {order.entrega && (
        <p className="text-xs text-gray-400 -mt-1">{order.entrega}</p>
      )}

      {/* Delivery date */}
      {order.dataEntrega && (
        <p className="text-xs text-gray-600">
          📅 Entrega:{" "}
          <span className="font-medium">
            {formatBrDateFull(order.dataEntrega)}
          </span>
        </p>
      )}

      {/* Products (only those with qty > 0) */}
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

      {/* Observation */}
      {order.observacao && (
        <div className="text-xs text-orange-800 bg-orange-50 rounded-md px-3 py-2 border border-orange-100">
          📝 {order.observacao}
        </div>
      )}

      {/* Phone + Address */}
      {(order.telefone || order.endereco) && (
        <div className="text-xs text-gray-500 space-y-0.5 pt-2 border-t border-gray-100">
          {order.telefone && <p>📞 {order.telefone}</p>}
          {order.endereco && <p>📍 {order.endereco}</p>}
        </div>
      )}
    </div>
  );
}
