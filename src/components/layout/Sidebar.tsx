import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  Calendar,
  ClipboardList,
  Truck,
  Cake,
  Coffee,
  Egg,
  FlaskConical,
  BarChart2,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const navGroups = [
  {
    label: "Encomendas",
    items: [
      { name: "Hoje e Próximos Dias", href: "/",          icon: CalendarDays },
      { name: "Calendário",           href: "/calendario", icon: Calendar },
      { name: "Por Data de Produção", href: "/producao",   icon: ClipboardList },
      { name: "Por Data de Entrega",  href: "/entrega",    icon: Truck },
      { name: "Só Bolos",             href: "/bolos",      icon: Cake },
      { name: "Só Pães de Mel",       href: "/pdm",        icon: Coffee },
      { name: "Páscoa",               href: "/pascoa",     icon: Egg },
    ],
  },
  {
    label: "Planejamento de Produção",
    items: [
      { name: "Planejar PDM",         href: "/planejamento",       icon: FlaskConical },
      { name: "Planejar (2 Lojas)",   href: "/planejamento-lojas", icon: FlaskConical },
      { name: "Estoque PDM",          href: "/estoque",            icon: BarChart2 },
      { name: "Histórico Sobras",     href: "/historico-sobras",   icon: BarChart2 },
      { name: "Histórico Produção",   href: "/historico-producao", icon: ClipboardList },
    ],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { signOut, user, role } = useAuth();

  return (
    <aside className="w-56 shrink-0 bg-brand-brown text-white hidden md:flex flex-col h-full">
      {/* Brand */}
      <div className="px-4 py-5 border-b border-white/10">
        <h1 className="text-brand-yellow font-bold text-lg leading-tight">
          🍫 Confeitaria
        </h1>
        <p className="text-white/50 text-xs mt-0.5">Dashboard de Pedidos</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <p className="px-3 mb-1 text-[10px] font-semibold text-white/40 uppercase tracking-widest">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = location.pathname === item.href;
                const Icon = item.icon;

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
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-white/10 mt-auto">
        {user && (
          <div className="mb-3 px-1">
            <p className="text-xs text-brand-yellow truncate">{user.email}</p>
            <p className="text-[10px] text-white/50 uppercase tracking-widest">{role}</p>
          </div>
        )}
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-white/50 hover:bg-white/10 hover:text-white rounded-md transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
