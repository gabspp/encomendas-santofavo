export interface ProductItem {
  name: string;
  qty: number;
}

export type OrderStatus = "Em aberto" | "Confirmado" | "Pronto" | "Entregue" | "";

export interface ParsedOrder {
  id: string;
  cliente: string;
  icon: string; // emoji do ícone da página no Notion
  dataProducao: string; // "YYYY-MM-DD"
  dataEntrega: string; // "YYYY-MM-DD"
  dataPedido: string; // "YYYY-MM-DD"
  entrega: string; // "Entrega 26" | "Retirada 26" | "Entrega 248" | "Retirada 248"
  status: OrderStatus;
  revenda: boolean;
  atendente: string;
  observacao: string;
  telefone: string;
  endereco: string;
  products: ProductItem[];
}

export interface NewOrderDraft {
  atendente: string;
  cliente: string;
  telefone: string;
  cep: string;
  endereco: string;      // rua (auto-preenchida pelo CEP)
  numero: string;        // número do endereço
  complemento: string;   // complemento (opcional)
  dataEntrega: string;   // "YYYY-MM-DD"
  dataProducao: string;  // "YYYY-MM-DD"
  entrega: string;
  metodoPagamento: string;
  taxaEntrega: string;   // string para input binding
  revenda: boolean;
  products: Record<string, number>; // chave = nome exato do campo no Notion
  observacao: string;
}

export interface FilterState {
  loja: "todas" | "26" | "248";
  saida: "todos" | "entrega" | "retirada";
  categoria: "todas" | "pdm" | "bolo" | "revenda";
}
