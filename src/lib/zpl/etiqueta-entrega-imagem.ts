// Etiqueta de entrega — layout "Etiqueta 2a - Impressao" (claude.ai/design).
//
// Híbrida: a parte de marca vai como imagem e os dados como texto da Zebra.
// - Imagem (^GF): "ENTREGA", nome em Pipo, as réguas e o logo. A Zebra não tem
//   essas fontes nem o logo, então o navegador desenha num canvas do tamanho
//   exato do rolo (60x40 mm a 203 dpi = 480x320 pontos) e converte para 1 bit.
// - Texto da impressora (^A0): data/horário, endereço e telefone. Na primeira
//   impressão tudo em Fig Grotesk, o "86" do endereço saiu ambíguo (números
//   arredondados, letra pequena, rasterizado). A fonte da Zebra é desenhada
//   pela própria impressora: números nítidos e inconfundíveis.
//
//   ENTREGA                     sáb 10/10 - 11:00   ← data em ^A0
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   Nome do Cliente                      (Pipo 42, até 2 linhas, imagem)
//   Endereço completo quebrando em        (^A0, quantas linhas couberem)
//   quantas linhas couberem...
//   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//   (21) 98871-4247                 [Santo Favo]   ← telefone em ^A0

import type { ParsedOrder } from "@/types";
import { extractHorario, stripCaixas } from "@/utils/notion";
import { quebrarTexto, truncar, zplEscape } from "@/lib/zpl/etiqueta-pedido";

const W = 480;
const H = 320;
const MARGEM = 20;
const FONTE_TITULO = "Pipo";
const FONTE_CORPO = "Fig Grotesk";
/** Pixel vira ponto preto abaixo deste brilho (0–255). */
const LIMIAR = 165;

/** Corpo da fonte da Zebra (^A0) para cada dado, em pontos. */
const ZPL_DATA = 26;
const ZPL_ENDERECO = 27;
const ZPL_TELEFONE = 27;
const ESPACO_LINHAS = 3;
/** A estimativa de largura de caractere (etiqueta-pedido.ts) foi medida em
 * letra menor; com corpo 26–27 ela fica otimista. Quebra com 10% de folga:
 * texto que passa do ^FB sai sobreposto (borrão) na Zebra. */
const FOLGA = 0.9;

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

// ── Texto no canvas (só o nome) ──────────────────────────────────────────────

const RETICENCIAS = "…";

function quebrarCanvas(ctx: CanvasRenderingContext2D, texto: string, largura: number, maxLinhas: number): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const p of texto.split(/\s+/).filter(Boolean)) {
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

/** Nome em até 2 linhas; se não couber, tenta primeiro + último nome. */
function nomeQueCabe(ctx: CanvasRenderingContext2D, nome: string, largura: number): string[] {
  const linhas = quebrarCanvas(ctx, nome, largura, 2);
  if (!linhas[linhas.length - 1].endsWith(RETICENCIAS)) return linhas;
  const p = nome.split(" ");
  return p.length > 2 ? quebrarCanvas(ctx, `${p[0]} ${p[p.length - 1]}`, largura, 2) : linhas;
}

// ── Montagem ─────────────────────────────────────────────────────────────────

interface Etiqueta {
  canvas: HTMLCanvasElement;
  /** Comandos ^A0 sobrepostos à imagem (data, endereço, telefone). */
  textos: string[];
}

export async function montarEtiquetaEntrega(order: ParsedOrder): Promise<Etiqueta> {
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
  const textos: string[] = [];
  const zpl = (x: number, y: number, corpo: number, t: string, larguraCampo: number, alinhar = "L") =>
    textos.push(`^FO${x},${y}^A0N,${corpo},${corpo}^FB${larguraCampo},1,0,${alinhar},0^FD${t}^FS`);

  const isRetirada = order.entrega.startsWith("Retirada");

  // ── Faixa de cima: tipo (imagem) + data/horário (Zebra) ──
  // Fig Grotesk só tem Regular: o contorno faz o papel do negrito do design
  ctx.font = `700 24px "${FONTE_CORPO}"`;
  ctx.letterSpacing = "2.9px"; // 0.12em
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1.2;
  ctx.lineJoin = "round";
  const tipo = isRetirada ? "RETIRADA" : "ENTREGA";
  ctx.fillText(tipo, MARGEM, 38);
  ctx.strokeText(tipo, MARGEM, 38);
  ctx.letterSpacing = "0px";
  const larguraTipo = ctx.measureText(tipo).width + 2.9 * tipo.length;

  const horario = extractHorario(stripCaixas(order.observacao));
  const dataHora = zplEscape([dataCurta(order.dataEntrega), horario].filter(Boolean).join(" - "));
  if (dataHora) {
    const x = Math.ceil(MARGEM + larguraTipo + 12);
    zpl(x, 16, ZPL_DATA, truncar(dataHora, ZPL_DATA, (W - MARGEM - x) * FOLGA), W - MARGEM - x, "R");
  }
  ctx.fillRect(MARGEM, 49, largura, 3);

  // ── Faixa de baixo: telefone (Zebra) + logo (imagem) ──
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
    const larguraTel = largura - larguraLogo - 12;
    zpl(MARGEM, yLogo, ZPL_TELEFONE, truncar(zplEscape(order.telefone), ZPL_TELEFONE, larguraTel * FOLGA), larguraTel);
  }

  // ── Corpo: nome (imagem) + endereço (Zebra) ──
  let y = 64;
  ctx.font = `700 42px "${FONTE_TITULO}"`;
  for (const linha of nomeQueCabe(ctx, order.cliente.replace(/\s+/g, " ").trim() || "—", largura)) {
    ctx.fillText(linha, MARGEM, y + 34);
    y += 44; // line-height 1.05
  }
  y += 10;

  const texto = isRetirada ? "Retirada na loja" : zplEscape(order.endereco) || "(sem endereço)";
  const passo = ZPL_ENDERECO + ESPACO_LINHAS;
  const maxLinhas = Math.max(1, Math.floor((yLinhaBaixo - 6 - y + ESPACO_LINHAS) / passo));
  for (const linha of quebrarTexto(texto, ZPL_ENDERECO, largura * FOLGA, maxLinhas)) {
    zpl(MARGEM, y, ZPL_ENDERECO, linha, largura);
    y += passo;
  }

  return { canvas, textos };
}

// ── Canvas → ZPL ^GF ─────────────────────────────────────────────────────────

/**
 * Converte o canvas em ^GFA com a compressão simples do ZPL: linha igual à
 * anterior vira ":" e zeros no fim da linha viram ",".
 */
export function canvasParaGf(canvas: HTMLCanvasElement): string {
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
  return `^FO0,0^GFA,${total},${total},${bytesPorLinha},${corpo}^FS`;
}

export async function gerarZplEntregaImagem(order: ParsedOrder): Promise<string> {
  const { canvas, textos } = await montarEtiquetaEntrega(order);
  return [
    "^XA", "^SZ2", `^PW${W}`, `^LL${H}`, "^CI28",
    canvasParaGf(canvas),
    ...textos,
    "^PQ1", "^XZ",
  ].join("\n");
}

