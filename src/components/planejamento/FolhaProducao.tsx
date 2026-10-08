import { createPortal } from "react-dom";
import { SABORES, SABORES_IDS } from "@/utils/producao";
import type { FlavorId, FlavorData, OrderDetail } from "@/utils/producao";
import { stripCaixas } from "@/utils/notion";

// Folha A4 da produção do dia, impressa pelo navegador (window.print).
// Fica escondida na tela; no @media print só ela aparece (ver index.css).

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

  const [diaSemana, dataNum] = dataExtenso(date).split(", ");

  return (
    <div className="folha-producao">
      <header className="fp-header">
        <div>
          <p className="fp-marca">Santo Favo · Produção de Pão de Mel</p>
          <h1>Loja {storeId}</h1>
        </div>
        <div className="fp-data">
          <span>{diaSemana}</span>
          <strong>{dataNum}</strong>
        </div>
      </header>

      <table className="fp-tabela">
        <thead>
          <tr>
            <th>Sabor</th>
            <th className="fp-num">Qtd.</th>
            <th className="fp-decor">Decorados</th>
          </tr>
        </thead>
        <tbody>
          {sabores.map((s) => (
            <tr key={s.id}>
              <td>{s.nome}</td>
              <td className="fp-num">{s.qtd}</td>
              <td className="fp-decor" />
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td className="fp-num">{total}</td>
            <td className="fp-decor" />
          </tr>
        </tfoot>
      </table>

      {temEncomendas && (
        <section className="fp-secao">
          <h2>Encomendas</h2>
          {orderDetails.length > 0 ? (
            <div className="fp-encomendas">
              {orderDetails.map((o, i) => {
                const obs = o.observation ? stripCaixas(o.observation).trim() : "";
                return (
                  <div key={i} className="fp-encomenda">
                    <p className="fp-cliente">{o.clientName}</p>
                    <p className="fp-sabores">
                      {Object.entries(o.flavors)
                        .filter(([, q]) => q > 0)
                        .map(([id, q]) => (
                          <span key={id}><strong>{q}</strong> {nomeCurto(id)}</span>
                        ))}
                    </p>
                    {obs && <p className="fp-obs">{obs}</p>}
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
        <section className="fp-secao fp-inteira">
          <h2>Resumo das encomendas</h2>
          <table className="fp-tabela fp-resumo">
            <thead>
              <tr>
                {resumo.map((r) => <th key={r.id}>{nomeCurto(r.id)}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                {resumo.map((r) => <td key={r.id}>{r.qtd}</td>)}
                <td className="fp-total">{totalEncomendas}</td>
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
