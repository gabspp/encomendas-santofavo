import { Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import HojeAmanha from "@/pages/HojeAmanha";
import Calendario from "@/pages/Calendario";
import PorProducao from "@/pages/PorProducao";
import PorEntrega from "@/pages/PorEntrega";
import SoBolos from "@/pages/SoBolos";
import SoPdm from "@/pages/SoPdm";
import SoPascoa from "@/pages/SoPascoa";

export default function App() {
  return (
    <div className="flex h-screen bg-brand-cream overflow-hidden">
      {/* Sidebar: visible on md+ */}
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Extra bottom padding on mobile for the bottom nav bar */}
        <div className="max-w-screen-2xl mx-auto p-4 md:p-6 pb-20 md:pb-6">
          <Routes>
            <Route path="/" element={<HojeAmanha />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/producao" element={<PorProducao />} />
            <Route path="/entrega" element={<PorEntrega />} />
            <Route path="/bolos" element={<SoBolos />} />
            <Route path="/pdm" element={<SoPdm />} />
            <Route path="/pascoa" element={<SoPascoa />} />
            <Route path="*" element={<HojeAmanha />} />
          </Routes>
        </div>
      </main>

      {/* Bottom nav: visible on mobile only */}
      <BottomNav />
    </div>
  );
}
