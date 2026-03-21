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

const navItems = [
  { name: "Hoje",      href: "/",          icon: CalendarDays },
  { name: "Calendário",href: "/calendario", icon: Calendar },
  { name: "Planejar",  href: "/planejamento", icon: FlaskConical },
  { name: "Estoque",   href: "/estoque",      icon: BarChart2 },
  { name: "Produção",  href: "/producao",   icon: ClipboardList },
  { name: "Entrega",   href: "/entrega",    icon: Truck },
  { name: "Bolos",     href: "/bolos",      icon: Cake },
  { name: "PDM",       href: "/pdm",        icon: Coffee },
  { name: "Páscoa",    href: "/pascoa",     icon: Egg },
];

export function BottomNav() {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-brown border-t border-white/10 flex md:hidden items-center overflow-x-auto">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex-1 min-w-[64px] flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors ${
              isActive
                ? "text-brand-yellow"
                : "text-white/60 hover:text-white"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" />
            <span className="truncate w-full text-center px-0.5">{item.name}</span>
          </Link>
        );
      })}
      
      <button
        onClick={signOut}
        className="flex-1 min-w-[64px] flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors text-white/60 hover:text-white"
      >
        <LogOut className="h-5 w-5 shrink-0" />
        <span className="truncate w-full text-center px-0.5">Sair</span>
      </button>
    </nav>
  );
}
