import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  Calendar,
  ClipboardList,
  Truck,
  Cake,
  Coffee,
} from "lucide-react";

const navItems = [
  { name: "Hoje e Amanhã", href: "/", icon: CalendarDays, disabled: false },
  {
    name: "Calendário",
    href: "/calendario",
    icon: Calendar,
    disabled: true,
  },
  {
    name: "Por Data de Produção",
    href: "/producao",
    icon: ClipboardList,
    disabled: true,
  },
  {
    name: "Por Data de Entrega",
    href: "/entrega",
    icon: Truck,
    disabled: true,
  },
  { name: "Só Bolos", href: "/bolos", icon: Cake, disabled: true },
  { name: "Só Pães de Mel", href: "/pdm", icon: Coffee, disabled: true },
];

export function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-56 shrink-0 bg-brand-brown text-white flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <h1 className="text-brand-yellow font-bold text-lg leading-tight">
          🍫 Confeitaria
        </h1>
        <p className="text-white/50 text-xs mt-0.5">Dashboard de Pedidos</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map((item) => {
          const isActive = location.pathname === item.href;
          const Icon = item.icon;

          if (item.disabled) {
            return (
              <div
                key={item.href}
                title="Em breve"
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/30 cursor-not-allowed select-none"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.name}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-brand-yellow text-brand-brown font-semibold"
                  : "text-white/80 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <p className="text-white/30 text-xs">Atualização automática: 2 min</p>
      </div>
    </aside>
  );
}
