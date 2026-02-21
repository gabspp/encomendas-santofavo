import { Routes, Route } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import HojeAmanha from "@/pages/HojeAmanha";

export default function App() {
  return (
    <div className="flex h-screen bg-brand-cream overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-screen-2xl mx-auto p-6">
          <Routes>
            <Route path="/" element={<HojeAmanha />} />
            <Route path="*" element={<HojeAmanha />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
