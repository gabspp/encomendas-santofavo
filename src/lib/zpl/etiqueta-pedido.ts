// Etiqueta de pedido em ZPL para a Zebra ZD220 da loja 26.
// Base copiada de etiquetas-santofavo (web/src/lib/zpl/gerar-zpl.ts): mesma
// resolução, mesma calibragem de largura de caractere e mesma quebra manual.
// O ZPL vai para a tabela fila_impressao e o agente do PC da loja imprime.

import type { ParsedOrder } from "@/types";
import { extractHorario, stripCaixas } from "@/utils/notion";

// 203 dpi (8 dots/mm)
const DOTS_POR_MM = 8;

export type FormatoPedido = {
  nome: string;
  /** ^PW — largura útil em dots. */
  pw: number;
  /** ^LL — comprimento da etiqueta em dots. */
  ll: number;
  margem: number;
  topo: number;
  /** Fonte da linha do cliente. */
  fonteTitulo: number;
  /** Fonte das demais linhas. */
  fonte: number;
  espacoLinhas: number;
};

export const FORMATO_PEDIDO_50x30: FormatoPedido = {
  nome: "50x30",
  pw: 50 * DOTS_POR_MM, // 400
  ll: 30 * DOTS_POR_MM, // 240
  margem: 12,
  topo: 8,
  fonteTitulo: 22,
  fonte: 20,
  espacoLinhas: 2,
};

export const FORMATO_PEDIDO_60x40: FormatoPedido = {
  nome: "60x40",
  pw: 60 * DOTS_POR_MM, // 480
  ll: 40 * DOTS_POR_MM, // 320
  margem: 14,
  topo: 10,
  fonteTitulo: 28,
  fonte: 22,
  espacoLinhas: 3,
};

/** Formato em uso. ⬅ Trocar para FORMATO_PEDIDO_60x40 quando mudar o rolo. */
export const FORMATO_PEDIDO: FormatoPedido = FORMATO_PEDIDO_50x30;

/**
 * Largura média de caractere como fração do corpo da fonte ^A0 — calibrada
 * em impressão real no projeto de etiquetas (0,47–0,56).
 */
const LARGURA_CARACTERE = 0.55;

/** A fonte da impressora não tem o glifo "…". */
const RETICENCIAS = "...";

/**
 * Quebra o texto nas linhas que cabem na largura, truncando com reticências
 * o que passar de `maxLinhas`. Feito aqui e não pelo ^FB porque a ZD220
 * sobrepõe o excesso na última linha (vira um borrão preto).
 */
export function quebrarTexto(texto: string, fonte: number, largura: number, maxLinhas: number): string[] {
  const maxChars = Math.max(1, Math.floor(largura / (fonte * LARGURA_CARACTERE)));

  const linhas: string[] = [];
  let atual = "";
  const fechar = () => {
    if (atual) linhas.push(atual);
    atual = "";
  };

  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    if (palavra.length > maxChars) {
      fechar();
      for (let i = 0; i < palavra.length; i += maxChars) {
        linhas.push(palavra.slice(i, i + maxChars));
      }
      continue;
    }
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (tentativa.length <= maxChars) atual = tentativa;
    else {
      fechar();
      atual = palavra;
    }
  }
  fechar();

  if (linhas.length <= maxLinhas) return linhas;

  const mantidas = linhas.slice(0, maxLinhas);
  const ultima = mantidas[maxLinhas - 1];
  mantidas[maxLinhas - 1] =
    ultima.length + RETICENCIAS.length <= maxChars
      ? ultima + RETICENCIAS
      : ultima.slice(0, Math.max(0, maxChars - RETICENCIAS.length)).trimEnd() + RETICENCIAS;
  return mantidas;
}

/** ^ e ~ são caracteres de controle ZPL; emojis não existem na fonte da impressora. */
function zplEscape(texto: string): string {
  return texto
    .replace(/[\^~]/g, " ")
    .replace(/[\r\n]/g, " ")
    .replace(/[^ -ɏ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "2026-10-03" → "03/10" */
function diaMes(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return d && m ? `${d}/${m}` : "";
}

/** Produtos do pedido como "1 x Bolo PDM G" (sem a fórmula "PDM Avulso"). */
export function linhasProdutos(order: ParsedOrder): string[] {
  return order.products
    .filter((p) => p.qty > 0 && p.name !== "PDM Avulso")
    .map((p) => `${p.qty} x ${zplEscape(p.name)}`);
}

/** Linhas de texto da etiqueta, antes de posicionar — exportado para conferência. */
export function conteudoEtiqueta(order: ParsedOrder) {
  const horario = extractHorario(stripCaixas(order.observacao));
  const data = diaMes(order.dataEntrega);
  const isRetirada = order.entrega.startsWith("Retirada");

  return {
    dataHora: [data, horario].filter(Boolean).join(" - "),
    endereco: isRetirada ? "" : order.endereco,
    telefone: order.telefone,
    produtos: linhasProdutos(order),
  };
}

export function gerarZplPedido(order: ParsedOrder, formato: FormatoPedido = FORMATO_PEDIDO): string {
  const { pw, ll, margem, topo, fonteTitulo, fonte, espacoLinhas } = formato;
  const largura = pw - margem * 2;
  const c = conteudoEtiqueta(order);

  const saida: string[] = ["^XA", "^SZ2", `^PW${pw}`, `^LL${ll}`, "^CI28"];
  let y = topo;

  const linha = (texto: string, corpo: number) => {
    saida.push(
      `^FO${margem},${y}^A0N,${corpo},${corpo}^FB${largura},1,0,L,0^FD${texto}^FS`
    );
    y += corpo + espacoLinhas;
  };

  // Só o nome é truncado — "Entrega 26" / "Retirada 248" precisa sempre aparecer
  const sufixo = order.entrega ? ` - ${zplEscape(order.entrega)}` : "";
  const larguraNome = largura - sufixo.length * fonteTitulo * LARGURA_CARACTERE;
  // Nome longo: tenta inteiro → primeiro + último ("Maria Gonçalves") → só o primeiro
  const nomeCompleto = zplEscape(order.cliente || "—");
  const palavras = nomeCompleto.split(" ");
  const candidatos = [
    nomeCompleto,
    palavras.length > 2 ? `${palavras[0]} ${palavras[palavras.length - 1]}` : "",
    palavras[0],
  ].filter(Boolean);
  const cabe = (t: string) => quebrarTexto(t, fonteTitulo, larguraNome, 1)[0] === t;
  const [nome = "—"] = quebrarTexto(candidatos.find(cabe) ?? nomeCompleto, fonteTitulo, larguraNome, 1);
  linha(nome + sufixo, fonteTitulo);
  if (c.dataHora) linha(zplEscape(c.dataHora), fonte);
  for (const t of quebrarTexto(zplEscape(c.endereco), fonte, largura, 3)) linha(t, fonte);
  if (c.telefone) for (const t of quebrarTexto(zplEscape(c.telefone), fonte, largura, 1)) linha(t, fonte);

  // Divisor entre dados do cliente e produtos
  y += 1;
  saida.push(`^FO${margem},${y}^GB${largura},2,2,B,0^FS`);
  y += 5;

  const passo = fonte + espacoLinhas;
  const cabem = Math.max(0, Math.floor((ll - y + espacoLinhas) / passo));
  const produtos = c.produtos;
  const mostrar = produtos.length > cabem ? Math.max(0, cabem - 1) : produtos.length;
  for (const p of produtos.slice(0, mostrar)) {
    for (const t of quebrarTexto(p, fonte, largura, 1)) linha(t, fonte);
  }
  if (produtos.length > mostrar && cabem > 0) {
    const resto = produtos.length - mostrar;
    linha(`+${resto} ${resto === 1 ? "item" : "itens"}`, fonte);
  }

  saida.push("^PQ1", "^XZ");
  return saida.join("\n");
}
