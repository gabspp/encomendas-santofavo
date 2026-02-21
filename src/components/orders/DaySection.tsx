import type { ParsedOrder, OrderStatus } from "@/types";
import { OrderCard } from "./OrderCard";

interface DaySectionProps {
  title: string;
  orders: ParsedOrder[];
  emptyMessage: string;
  onStatusChange: (orderId: string, status: OrderStatus) => Promise<void>;
  onEntregaChange: (orderId: string, entrega: string) => Promise<void>;
  onDateChange: (orderId: string, field: "producao" | "entrega", date: string) => Promise<void>;
  onRevendaChange: (orderId: string, revenda: boolean) => Promise<void>;
}

export function DaySection({ title, orders, emptyMessage, onStatusChange, onEntregaChange, onDateChange, onRevendaChange }: DaySectionProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
          {title}
        </h2>
        <span className="bg-brand-yellow text-brand-brown text-xs font-bold px-2.5 py-0.5 rounded-full">
          {orders.length}
        </span>
      </div>

      {orders.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">
          {emptyMessage}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} onStatusChange={onStatusChange} onEntregaChange={onEntregaChange} onDateChange={onDateChange} onRevendaChange={onRevendaChange} />
          ))}
        </div>
      )}
    </section>
  );
}
