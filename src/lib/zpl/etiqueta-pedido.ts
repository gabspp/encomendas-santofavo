// Etiqueta de pedido em ZPL para a Zebra ZD220 da loja 26.
// Base copiada de etiquetas-santofavo (web/src/lib/zpl/gerar-zpl.ts): mesma
// resolução e mesma quebra manual de linhas. O ZPL vai para a tabela
// fila_impressao e o agente do PC da loja imprime.
//
// Layout:
//   Nome do cliente (grande)
//   [ENTREGA 26]  03/10 - 11:00        ← selo invertido (branco no preto)
//   Endereço (até 3 linhas)
//   Telefone
//   ───────────────
//   1 x Bolo PDM G …
//
// Etiqueta de entrega (gerarZplEntrega) — para colar no pacote:
//   Nome do cliente (grande)
//   Endereço (letra grande, até 4 linhas)
//   ───────────────
//   Telefone                    10/10 - 11:00

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
  fonteNome: number;
  /** Selo "ENTREGA 26" e data/horário ao lado. */
  fonteSelo: number;
  fonteDados: number;
  fonteProdutos: number;
  espacoLinhas: number;
};

export const FORMATO_PEDIDO_50x30: FormatoPedido = {
  nome: "50x30",
  pw: 50 * DOTS_POR_MM, // 400
  ll: 30 * DOTS_POR_MM, // 240
  margem: 20,
  topo: 12,
  fonteNome: 30,
  fonteSelo: 20,
  fonteDados: 19,
  fonteProdutos: 21,
  espacoLinhas: 2,
};

export const FORMATO_PEDIDO_60x40: FormatoPedido = {
  nome: "60x40",
  pw: 60 * DOTS_POR_MM, // 480
  ll: 40 * DOTS_POR_MM, // 320
  margem: 22,
  topo: 14,
  fonteNome: 36,
  fonteSelo: 24,
  fonteDados: 22,
  fonteProdutos: 25,
  espacoLinhas: 3,
};

/** Formato em uso (rolo 60x40 desde 10/10/2026). ⬅ Trocar aqui ao mudar o rolo. */
export const FORMATO_PEDIDO: FormatoPedido = FORMATO_PEDIDO_60x40;

/**
 * Largura estimada de um caractere da fonte ^A0, como fração do corpo.
 * Medido na impressão real da ZD220 (etiqueta de 30/09/2026): minúsculas
 * ≈ 0,39, dígitos ≈ 0,5; maiúsculas vêm da calibragem do projeto de
 * etiquetas (até 0,56). Valores com folga para nunca estourar a linha.
 */
function larguraCaractere(ch: string): number {
  if (ch === " ") return 0.3;
  if (/[0-9]/.test(ch)) return 0.5;
  if (/[MWÆŒ]/.test(ch)) return 0.7;
  if (/[A-ZÀ-Ý]/.test(ch)) return 0.56;
  if (/[mw]/.test(ch)) return 0.62;
  if (/[a-zà-ÿ]/.test(ch)) return 0.45;
  return 0.4; // pontuação, hífen etc.
}

/** Largura estimada do texto em dots. */
function larguraTexto(texto: string, fonte: number): number {
  let soma = 0;
  for (const ch of texto) soma += larguraCaractere(ch);
  return soma * fonte;
}

/** A fonte da impressora não tem o glifo "…". */
const RETICENCIAS = "...";

/** Corta o texto (com reticências) até caber na largura. */
function truncar(texto: string, fonte: number, largura: number): string {
  if (larguraTexto(texto, fonte) <= largura) return texto;
  let t = texto;
  while (t && larguraTexto(t + RETICENCIAS, fonte) > largura) t = t.slice(0, -1);
  return t.trimEnd() + RETICENCIAS;
}

/**
 * Quebra o texto nas linhas que cabem na largura, truncando com reticências
 * o que passar de `maxLinhas`. Feito aqui e não pelo ^FB porque a ZD220
 * sobrepõe o excesso na última linha (vira um borrão preto).
 */
export function quebrarTexto(texto: string, fonte: number, largura: number, maxLinhas: number): string[] {
  const cabe = (t: string) => larguraTexto(t, fonte) <= largura;
  const linhas: string[] = [];
  let atual = "";
  const fechar = () => {
    if (atual) linhas.push(atual);
    atual = "";
  };

  for (const palavra of texto.split(/\s+/).filter(Boolean)) {
    if (!cabe(palavra)) {
      // Palavra que não cabe nem sozinha: parte em pedaços duros
      fechar();
      let resto = palavra;
      while (resto) {
        let n = resto.length;
        while (n > 1 && !cabe(resto.slice(0, n))) n--;
        linhas.push(resto.slice(0, n));
        resto = resto.slice(n);
      }
      continue;
    }
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (cabe(tentativa)) atual = tentativa;
    else {
      fechar();
      atual = palavra;
    }
  }
  fechar();

  if (linhas.length <= maxLinhas) return linhas;

  const mantidas = linhas.slice(0, maxLinhas);
  mantidas[maxLinhas - 1] = truncar(mantidas[maxLinhas - 1] + " " + linhas[maxLinhas], fonte, largura);
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

/** Nome que cabe: inteiro → primeiro + último ("Maria Gonçalves") → truncado. */
function nomeQueCabe(cliente: string, fonte: number, largura: number): string {
  const completo = zplEscape(cliente || "—");
  const palavras = completo.split(" ");
  const candidatos = [
    completo,
    palavras.length > 2 ? `${palavras[0]} ${palavras[palavras.length - 1]}` : "",
  ].filter(Boolean);
  return candidatos.find((t) => larguraTexto(t, fonte) <= largura) ?? truncar(completo, fonte, largura);
}

export function gerarZplPedido(order: ParsedOrder, formato: FormatoPedido = FORMATO_PEDIDO): string {
  const { pw, ll, margem, topo, fonteNome, fonteSelo, fonteDados, fonteProdutos, espacoLinhas } = formato;
  const largura = pw - margem * 2;

  const saida: string[] = ["^XA", "^SZ2", `^PW${pw}`, `^LL${ll}`, "^CI28"];
  let y = topo;

  const texto = (x: number, yy: number, corpo: number, t: string, larguraCampo: number, inverso = false) =>
    saida.push(
      `^FO${x},${yy}^A0N,${corpo},${corpo}^FB${larguraCampo},1,0,L,0${inverso ? "^FR" : ""}^FD${t}^FS`
    );
  const linha = (t: string, corpo: number) => {
    texto(margem, y, corpo, t, largura);
    y += corpo + espacoLinhas;
  };

  // ── Nome ──
  linha(nomeQueCabe(order.cliente, fonteNome, largura), fonteNome);
  y += 4;

  // ── Selo invertido "ENTREGA 26" + data/horário ──
  const selo = zplEscape(order.entrega).toUpperCase();
  const horario = extractHorario(stripCaixas(order.observacao));
  const dataHora = [diaMes(order.dataEntrega), horario].filter(Boolean).join(" - ");
  const padX = 8;
  const padY = 4;
  const alturaSelo = fonteSelo + padY * 2;
  if (selo) {
    // Folga extra: com ^FR, texto que passa da caixa sai invertido no branco
    const larguraSelo = Math.ceil(larguraTexto(selo, fonteSelo) * 1.15) + padX * 2;
    saida.push(`^FO${margem},${y}^GB${larguraSelo},${alturaSelo},${alturaSelo},B,0^FS`);
    texto(margem + padX, y + padY + 1, fonteSelo, selo, larguraSelo - padX, true);
    if (dataHora) {
      const x = margem + larguraSelo + 10;
      texto(x, y + padY + 1, fonteSelo, truncar(dataHora, fonteSelo, pw - margem - x), pw - margem - x);
    }
    y += alturaSelo + 6;
  } else if (dataHora) {
    linha(dataHora, fonteSelo);
  }

  // ── Endereço (não em retirada) e telefone ──
  const isRetirada = order.entrega.startsWith("Retirada");
  if (!isRetirada) {
    for (const t of quebrarTexto(zplEscape(order.endereco), fonteDados, largura, 3)) linha(t, fonteDados);
  }
  if (order.telefone) linha(truncar(zplEscape(order.telefone), fonteDados, largura), fonteDados);

  // ── Produtos ──
  y += 2;
  saida.push(`^FO${margem},${y}^GB${largura},2,2,B,0^FS`);
  y += 6;

  const passo = fonteProdutos + espacoLinhas;
  const cabem = Math.max(0, Math.floor((ll - 4 - y + espacoLinhas) / passo));
  const produtos = linhasProdutos(order);
  const mostrar = produtos.length > cabem ? Math.max(0, cabem - 1) : produtos.length;
  for (const p of produtos.slice(0, mostrar)) linha(truncar(p, fonteProdutos, largura), fonteProdutos);
  if (produtos.length > mostrar && cabem > 0) {
    const resto = produtos.length - mostrar;
    linha(`+${resto} ${resto === 1 ? "item" : "itens"}`, fonteProdutos);
  }

  saida.push("^PQ1", "^XZ");
  return saida.join("\n");
}

/**
 * Etiqueta de entrega: o que o entregador precisa ler de relance. Endereço
 * em letra grande e com mais linhas; telefone para ligar se não achar o
 * endereço; data/horário discretos para conferir o pedido. Sem produtos.
 */
export function gerarZplEntrega(order: ParsedOrder, formato: FormatoPedido = FORMATO_PEDIDO): string {
  const { pw, ll, margem, topo, espacoLinhas } = formato;
  const largura = pw - margem * 2;
  // Proporções a partir do formato: nome e endereço maiores que na etiqueta completa
  const fonteNome = Math.round(formato.fonteNome * 1.2);
  const fonteEndereco = Math.round(formato.fonteDados * 1.5);
  const fonteRodape = Math.round(formato.fonteDados * 1.1);

  const saida: string[] = ["^XA", "^SZ2", `^PW${pw}`, `^LL${ll}`, "^CI28"];
  const texto = (x: number, y: number, corpo: number, t: string, larguraCampo: number, alinhar = "L") =>
    saida.push(`^FO${x},${y}^A0N,${corpo},${corpo}^FB${larguraCampo},1,0,${alinhar},0^FD${t}^FS`);

  let y = topo;
  texto(margem, y, fonteNome, nomeQueCabe(order.cliente, fonteNome, largura), largura);
  y += fonteNome + espacoLinhas + 6;

  // Rodapé fixo no pé da etiqueta; o endereço usa todo o espaço entre os dois
  const yRodape = ll - topo - fonteRodape;
  const yDivisor = yRodape - 8;
  const passo = fonteEndereco + espacoLinhas;
  const maxLinhas = Math.max(1, Math.floor((yDivisor - 4 - y + espacoLinhas) / passo));
  const endereco = zplEscape(order.endereco) || "(sem endereço)";
  for (const t of quebrarTexto(endereco, fonteEndereco, largura, maxLinhas)) {
    texto(margem, y, fonteEndereco, t, largura);
    y += passo;
  }

  saida.push(`^FO${margem},${yDivisor}^GB${largura},2,2,B,0^FS`);
  const horario = extractHorario(stripCaixas(order.observacao));
  const dataHora = [diaMes(order.dataEntrega), horario].filter(Boolean).join(" - ");
  const larguraDataHora = dataHora ? Math.ceil(larguraTexto(dataHora, fonteRodape)) + 4 : 0;
  if (order.telefone) {
    texto(margem, yRodape, fonteRodape, truncar(zplEscape(order.telefone), fonteRodape, largura - larguraDataHora - 12), largura - larguraDataHora - 12);
  }
  if (dataHora) {
    texto(pw - margem - larguraDataHora, yRodape, fonteRodape, dataHora, larguraDataHora, "R");
  }

  saida.push("^PQ1", "^XZ");
  return saida.join("\n");
}
