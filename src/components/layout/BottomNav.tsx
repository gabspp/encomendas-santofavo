import { Link, useLocation } from "react-router-dom";
import {
  CalendarDays,
  Calendar,
  ClipboardList,
  Truck,
  Cake,
  Coffee,
  Egg,
} from "lucide-react";

const navItems = [
  { name: "Hoje",      href: "/",          icon: CalendarDays },
  { name: "Calendário",href: "/calendario", icon: Calendar },
  { name: "Produção",  href: "/producao",   icon: ClipboardList },
  { name: "Entrega",   href: "/entrega",    icon: Truck },
  { name: "Bolos",     href: "/bolos",      icon: Cake },
  { name: "PDM",       href: "/pdm",        icon: Coffee },
  { name: "Páscoa",    href: "/pascoa",     icon: Egg },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-brand-brown border-t border-white/10 flex md:hidden">
      {navItems.map((item) => {
        const isActive = location.pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors min-w-0 ${
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
    </nav>
  );
}
