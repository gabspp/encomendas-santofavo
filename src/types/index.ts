export interface ProductItem {
  name: string;
  qty: number;
}

export type OrderStatus = "Em aberto" | "Confirmado" | "Pronto" | "Entregue" | "";

export interface ParsedOrder {
  id: string;
  cliente: string;
  dataProducao: string; // "YYYY-MM-DD"
  dataEntrega: string; // "YYYY-MM-DD"
  dataPedido: string; // "YYYY-MM-DD"
  entrega: string; // "Entrega 26" | "Retirada 26" | "Entrega 248" | "Retirada 248"
  status: OrderStatus;
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
