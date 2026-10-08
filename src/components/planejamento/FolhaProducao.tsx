import { createPortal } from "react-dom";
import { SABORES, SABORES_IDS } from "@/utils/producao";
import type { FlavorId, FlavorData, OrderDetail } from "@/utils/producao";
import { stripCaixas } from "@/utils/notion";

// Folha A4 da produção do dia, impressa pelo navegador (window.print).
// Fica escondida na tela; no @media print só ela aparece (ver index.css).
// Layout: "Ficha de Producao v2" (claude.ai/design, projeto "Ficha de pães de mel redesenhada").

const NOME_CURTO: Partial<Record<FlavorId, string>> = { Mes: "Mês", DLSem: "DL sem nozes" };
const nomeCurto = (id: string) => NOME_CURTO[id as FlavorId] ?? id;

function dataExtenso(iso: string): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  const txt = d.toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
  });
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}

interface FolhaProducaoProps {
  storeId: "26" | "248";
  date: string;
  flavorData: Record<FlavorId, FlavorData>;
  orderDetails: OrderDetail[];
  textoEncomendas: string;
  encomendas: Record<FlavorId, number>;
}

export function FolhaProducao(props: FolhaProducaoProps) {
  return createPortal(<FolhaConteudo {...props} />, document.body);
}

export function FolhaConteudo({
  storeId, date, flavorData, orderDetails, textoEncomendas, encomendas,
}: FolhaProducaoProps) {
  const sabores = SABORES
    .map((s) => ({ ...s, qtd: flavorData[s.id]?.ajuste ?? 0 }))
    .filter((s) => s.qtd > 0);
  const total = sabores.reduce((sum, s) => sum + s.qtd, 0);

  const resumo = SABORES_IDS
    .map((id) => ({ id, qtd: encomendas[id] ?? 0 }))
    .filter((r) => r.qtd > 0);
  const totalEncomendas = resumo.reduce((sum, r) => sum + r.qtd, 0);
  const temEncomendas = orderDetails.length > 0 || textoEncomendas.trim() !== "";

  return (
    <div className="folha-producao">
      <header className="fp-header">
        <div className="fp-titulo">
          <h1>Pão de mel · Loja {storeId}</h1>
          <span>{dataExtenso(date)}</span>
        </div>
        <div className="fp-total-topo">
          <span>Total</span>
          <strong>{total}</strong>
        </div>
      </header>

      <section>
        <div className="fp-cab-sabores">
          <span>Sabor</span>
          <span className="fp-dir">Qtd.</span>
          <span className="fp-cab-decor">Decorados</span>
        </div>
        {sabores.map((s) => (
          <div key={s.id} className="fp-sabor">
            <span className="fp-sabor-linha">
              <span>{s.nome}</span>
              <span className="fp-pontilhado" />
              <span className="fp-sabor-qtd">{s.qtd}</span>
            </span>
            <div className="fp-decor">
              <span />
            </div>
          </div>
        ))}
        <div className="fp-sabor-total">
          <span>Total</span>
          <strong>{total}</strong>
          <span />
        </div>
      </section>

      {temEncomendas && (
        <section>
          <div className="fp-cab-secao">
            <h2>Encomendas</h2>
            {orderDetails.length > 0 && (
              <span>
                {orderDetails.length} {orderDetails.length === 1 ? "pedido" : "pedidos"} · {totalEncomendas} un.
              </span>
            )}
          </div>
          {orderDetails.length > 0 ? (
            <div className="fp-encomendas">
              {orderDetails.map((o, i) => {
                const itens = Object.entries(o.flavors).filter(([, q]) => q > 0);
                const obs = o.observation ? stripCaixas(o.observation).trim() : "";
                return (
                  <div key={i} className="fp-encomenda">
                    <div className="fp-encomenda-corpo">
                      <span className="fp-cliente">{o.clientName}</span>
                      <ul>
                        {itens.map(([id, q]) => <li key={id}>{nomeCurto(id)} {q}</li>)}
                      </ul>
                      {obs && <span className="fp-obs">{obs}</span>}
                    </div>
                    <span className="fp-encomenda-total">{itens.reduce((a, [, q]) => a + q, 0)}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <pre className="fp-texto">{textoEncomendas}</pre>
          )}
        </section>
      )}

      {resumo.length > 0 && (
        <section className="fp-inteira">
          <div className="fp-cab-secao">
            <h2>Resumo das encomendas</h2>
          </div>
          <ul className="fp-resumo">
            {resumo.map((r) => <li key={r.id}>{nomeCurto(r.id)} {r.qtd}</li>)}
          </ul>
          <div className="fp-resumo-total">
            <span>Total</span>
            <strong>{totalEncomendas}</strong>
          </div>
        </section>
      )}
    </div>
  );
}
