export interface ProductItem {
  name: string;
  qty: number;
}

export interface ParsedOrder {
  id: string;
  cliente: string;
  dataProducao: string; // "YYYY-MM-DD"
  dataEntrega: string; // "YYYY-MM-DD"
  dataPedido: string; // "YYYY-MM-DD"
  entrega: string; // "Retirada Loja 26" | "Retirada Loja 248" | "Entrega Loja 26" | "Entrega Loja 248"
  atendente: string;
  observacao: string;
  telefone: string;
  endereco: string;
  products: ProductItem[];
}

export interface FilterState {
  loja: "todas" | "26" | "248";
  tipo: "todos" | "entregas" | "retiradas";
}
