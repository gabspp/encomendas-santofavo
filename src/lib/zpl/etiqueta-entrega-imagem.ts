// Etiqueta de entrega desenhada como imagem — layout "Etiqueta 2a - Impressao"
// (claude.ai/design, projeto da etiqueta de entrega). A Zebra não tem as fontes
// da marca (Pipo, Fig Grotesk) nem o logo, então o navegador desenha a etiqueta
// num canvas do tamanho exato do rolo (60x40 mm a 203 dpi = 480x320 pontos),
// converte para 1 bit e envia como gráfico ^GF. O resto do caminho (fila +
// agente do PC-26) é o mesmo da etiqueta em texto.
//
//   ENTREGA                     sáb 10/10 · 11:00
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   Nome do Cliente                      (Pipo 42, até 2 linhas)
//   Endereço completo quebrando em        (Fig Grotesk 21)
//   quantas linhas couberem...
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   (21) 98871-4247                 [Santo Favo]

import type { ParsedOrder } from "@/types";
import { extractHorario, stripCaixas } from "@/utils/notion";

const W = 480;
const H = 320;
const MARGEM = 20;
const FONTE_TITULO = "Pipo";
const FONTE_CORPO = "Fig Grotesk";
/** Pixel vira ponto preto abaixo deste brilho (0–255). Um pouco acima de 128
 * para o texto antialiasado não afinar na impressão térmica. */
const LIMIAR = 165;

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function dataCurta(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  const dia = DIAS[new Date(y, m - 1, d).getDay()];
  return `${dia} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

// ── Recursos (fontes + logo), carregados uma vez ─────────────────────────────

let recursos: Promise<HTMLImageElement> | null = null;

function carregarRecursos(): Promise<HTMLImageElement> {
  recursos ??= (async () => {
    const fontes = [
      new FontFace(FONTE_TITULO, "url(/fonts/Pipo-Bold.otf)", { weight: "700" }),
      new FontFace(FONTE_CORPO, "url(/fonts/FigGrotesk-Regular.otf)", { weight: "400" }),
    ];
    for (const f of fontes) document.fonts.add(await f.load());
    const logo = new Image();
    logo.src = "/brand/logo-horizontal.png";
    await logo.decode();
    return logo;
  })().catch((err) => {
    recursos = null; // permite tentar de novo
    throw err;
  });
  return recursos;
}

// ── Texto ────────────────────────────────────────────────────────────────────

const RETICENCIAS = "…";

/** Quebra em linhas que caibam em `largura`; a última leva reticências se sobrar texto. */
function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number, maxLinhas: number): string[] {
  const palavras = texto.split(/\s+/).filter(Boolean);
  const linhas: string[] = [];
  let atual = "";
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(tentativa).width <= largura || !atual) atual = tentativa;
    else {
      linhas.push(atual);
      atual = p;
    }
  }
  if (atual) linhas.push(atual);
  if (linhas.length <= maxLinhas) return linhas;

  const mantidas = linhas.slice(0, maxLinhas);
  let ultima = `${mantidas[maxLinhas - 1]} ${linhas[maxLinhas]}`;
  while (ultima && ctx.measureText(ultima + RETICENCIAS).width > largura) ultima = ultima.slice(0, -1);
  mantidas[maxLinhas - 1] = ultima.trimEnd() + RETICENCIAS;
  return mantidas;
}

/** Remove emojis/controle; a fonte não tem esses glifos. */
function limpar(t: string): string {
  return t.replace(/[^ -ɏ–—·]/g, "").replace(/\s+/g, " ").trim();
}

/** Nome em até 2 linhas; se não couber, tenta primeiro + último nome. */
function nomeQueCabe(ctx: CanvasRenderingContext2D, nome: string, largura: number): string[] {
  const linhas = quebrar(ctx, nome, largura, 2);
  if (!linhas[linhas.length - 1].endsWith(RETICENCIAS)) return linhas;
  const p = nome.split(" ");
  return p.length > 2 ? quebrar(ctx, `${p[0]} ${p[p.length - 1]}`, largura, 2) : linhas;
}

// ── Desenho ──────────────────────────────────────────────────────────────────

export async function desenharEtiquetaEntrega(order: ParsedOrder): Promise<HTMLCanvasElement> {
  const logo = await carregarRecursos();
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  const largura = W - MARGEM * 2;

  const isRetirada = order.entrega.startsWith("Retirada");

  // ── Faixa de cima: tipo + data/horário ──
  ctx.font = `700 24px "${FONTE_CORPO}"`;
  ctx.letterSpacing = "2.9px"; // 0.12em
  // Fig Grotesk só tem Regular: o contorno faz o papel do negrito do design
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  const negrito = (t: string, x: number, yy: number) => { ctx.fillText(t, x, yy); ctx.strokeText(t, x, yy); };
  ctx.textAlign = "left";
  negrito(isRetirada ? "RETIRADA" : "ENTREGA", MARGEM, 38);
  ctx.letterSpacing = "0.5px";
  ctx.textAlign = "right";
  const horario = extractHorario(stripCaixas(order.observacao));
  negrito([dataCurta(order.dataEntrega), horario].filter(Boolean).join(" · "), W - MARGEM, 38);
  ctx.letterSpacing = "0px";
  ctx.fillRect(MARGEM, 49, largura, 3);

  // ── Faixa de baixo: telefone + logo ──
  const yLinhaBaixo = H - 49;
  ctx.fillRect(MARGEM, yLinhaBaixo, largura, 3);
  const alturaLogo = 26;
  const larguraLogo = Math.round((logo.naturalWidth / logo.naturalHeight) * alturaLogo);
  const yLogo = yLinhaBaixo + 3 + 8;
  // Logo em preto (no design: filter: brightness(0))
  const tmp = document.createElement("canvas");
  tmp.width = larguraLogo;
  tmp.height = alturaLogo;
  const tctx = tmp.getContext("2d")!;
  tctx.drawImage(logo, 0, 0, larguraLogo, alturaLogo);
  tctx.globalCompositeOperation = "source-in";
  tctx.fillStyle = "#000";
  tctx.fillRect(0, 0, larguraLogo, alturaLogo);
  ctx.drawImage(tmp, W - MARGEM - larguraLogo, yLogo);

  if (order.telefone) {
    ctx.font = `400 22px "${FONTE_CORPO}"`;
    ctx.letterSpacing = "0.4px";
    ctx.textAlign = "left";
    const larguraTel = largura - larguraLogo - 12;
    const [tel] = quebrar(ctx, limpar(order.telefone), larguraTel, 1);
    ctx.fillText(tel, MARGEM, yLogo + 21);
    ctx.letterSpacing = "0px";
  }

  // ── Corpo: nome + endereço ──
  ctx.textAlign = "left";
  let y = 64;
  ctx.font = `700 42px "${FONTE_TITULO}"`;
  const alturaNome = 44; // line-height 1.05
  for (const linha of nomeQueCabe(ctx, limpar(order.cliente || "—"), largura)) {
    ctx.fillText(linha, MARGEM, y + 34);
    y += alturaNome;
  }
  y += 8;

  ctx.font = `400 ${isRetirada ? 22 : 21}px "${FONTE_CORPO}"`;
  const alturaLinha = 26; // line-height 1.22
  const texto = isRetirada ? "Retirada na loja" : limpar(order.endereco) || "(sem endereço)";
  const maxLinhas = Math.max(1, Math.floor((yLinhaBaixo - 6 - y) / alturaLinha));
  for (const linha of quebrar(ctx, texto, largura, maxLinhas)) {
    ctx.fillText(linha, MARGEM, y + 19);
    y += alturaLinha;
  }

  return canvas;
}

// ── Canvas → ZPL ^GF ─────────────────────────────────────────────────────────

/**
 * Converte o canvas em ^GFA com a compressão simples do ZPL: linha igual à
 * anterior vira ":" e zeros no fim da linha viram ",". Reduz o tamanho de
 * ~38 KB para alguns KB numa etiqueta com bastante branco.
 */
export function canvasParaZpl(canvas: HTMLCanvasElement): string {
  const { width, height } = canvas;
  const dados = canvas.getContext("2d")!.getImageData(0, 0, width, height).data;
  const bytesPorLinha = Math.ceil(width / 8);
  const total = bytesPorLinha * height;

  let corpo = "";
  let anterior = "";
  for (let yy = 0; yy < height; yy++) {
    let hex = "";
    for (let b = 0; b < bytesPorLinha; b++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit;
        if (x >= width) continue;
        const i = (yy * width + x) * 4;
        const lum = 0.299 * dados[i] + 0.587 * dados[i + 1] + 0.114 * dados[i + 2];
        if (lum < LIMIAR) byte |= 0x80 >> bit;
      }
      hex += byte.toString(16).toUpperCase().padStart(2, "0");
    }
    if (hex === anterior) {
      corpo += ":";
      continue;
    }
    anterior = hex;
    const semZeros = hex.replace(/(00)+$/, "");
    corpo += semZeros.length === hex.length ? hex : semZeros + ",";
  }

  return [
    "^XA", `^PW${width}`, `^LL${height}`,
    `^FO0,0^GFA,${total},${total},${bytesPorLinha},${corpo}^FS`,
    "^PQ1", "^XZ",
  ].join("\n");
}

export async function gerarZplEntregaImagem(order: ParsedOrder): Promise<string> {
  return canvasParaZpl(await desenharEtiquetaEntrega(order));
}
