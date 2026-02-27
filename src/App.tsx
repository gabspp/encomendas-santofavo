import { Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import HojeAmanha from "@/pages/HojeAmanha";
import Calendario from "@/pages/Calendario";
import PorProducao from "@/pages/PorProducao";
import PorEntrega from "@/pages/PorEntrega";
import SoBolos from "@/pages/SoBolos";
import SoPdm from "@/pages/SoPdm";

export default function App() {
  return (
    <div className="flex h-screen bg-brand-cream overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto p-6">
          <Routes>
            <Route path="/" element={<HojeAmanha />} />
            <Route path="/calendario" element={<Calendario />} />
            <Route path="/producao" element={<PorProducao />} />
            <Route path="/entrega" element={<PorEntrega />} />
            <Route path="/bolos" element={<SoBolos />} />
            <Route path="/pdm" element={<SoPdm />} />
            <Route path="*" element={<HojeAmanha />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
