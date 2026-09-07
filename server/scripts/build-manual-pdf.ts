/**
 * Genera el manual de uso en PDF a partir de docs/MANUAL_DE_USO.md.
 *
 * Uso:  npm run manual:pdf     (desde la carpeta server)
 * Salida: docs/Manual-de-uso-The-Warehouse.pdf
 *
 * El markdown es la única fuente de verdad: si se edita el manual, se vuelve a
 * ejecutar este script y el PDF queda al día.
 */
import fs from 'fs';
import path from 'path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';

// Se ejecuta desde la carpeta server, igual que el resto de scripts.
const ROOT = path.resolve(process.cwd(), '..');
const SOURCE = path.join(ROOT, 'docs', 'MANUAL_DE_USO.md');
const OUTPUT = path.join(ROOT, 'docs', 'Manual-de-uso-The-Warehouse.pdf');
const LOGO = path.join(ROOT, 'client', 'public', 'img', 'logo-dfp-records.png');

// Paleta tomada de client/tailwind.config.js para que el PDF y la aplicación
// se reconozcan como lo mismo.
const NAVY = '#0F172A';
const AMBER = '#F59E0B';
const BLUE = '#1E3A5F';
const TEXT = '#26303F';
const MUTED = '#7A8699';
const LINE = '#E2E8F0';
const ZEBRA = '#F6F8FB';
const NOTE_BG = '#FFFBEB';
const NOTE_BORDER = '#F0B429';
const NOTE_TEXT = '#6B4106';

const BODY = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const ITALIC = 'Helvetica-Oblique';
const MONO = 'Courier';

// ---------------------------------------------------------------- markdown

interface Span {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

interface ListItem {
  spans: Span[];
  sub: Span[][];
}

type Block =
  | { kind: 'chapter'; title: string; num: string | null }
  | { kind: 'heading'; spans: Span[] }
  | { kind: 'paragraph'; spans: Span[] }
  | { kind: 'list'; ordered: boolean; items: ListItem[] }
  | { kind: 'table'; head: string[]; rows: string[][] }
  | { kind: 'note'; spans: Span[] };

/** Reconoce **negrita**, *cursiva*, `código` y [texto](enlace). */
function parseInline(raw: string): Span[] {
  const spans: Span[] = [];
  const text = raw.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index) });
    const token = match[0];
    if (token.startsWith('**')) spans.push({ text: token.slice(2, -2), bold: true });
    else if (token.startsWith('`')) spans.push({ text: token.slice(1, -1), code: true });
    else spans.push({ text: token.slice(1, -1), italic: true });
    last = match.index + token.length;
  }
  if (last < text.length) spans.push({ text: text.slice(last) });
  return spans.length ? spans : [{ text }];
}

function splitRow(line: string): string[] {
  return line
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());
}

function parseMarkdown(md: string): Block[] {
  const lines = md.split(/\r?\n/);
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: ListItem[] } | null = null;
  let note: string[] = [];
  let skipping = false; // la sección "Índice" se sustituye por la nuestra
  let started = false; // el preámbulo va en la portada

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(' ').replace(/\s+/g, ' ').trim();
    if (joined) blocks.push({ kind: 'paragraph', spans: parseInline(joined) });
    paragraph = [];
  };
  const flushList = () => {
    if (list && list.items.length) blocks.push({ kind: 'list', ...list });
    list = null;
  };
  const flushNote = () => {
    if (!note.length) return;
    blocks.push({ kind: 'note', spans: parseInline(note.join(' ').replace(/\s+/g, ' ').trim()) });
    note = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushNote();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^##\s+/.test(trimmed) && !/^###/.test(trimmed)) {
      flushAll();
      const title = trimmed.replace(/^##\s+/, '').trim();
      if (/^índice$/i.test(title)) {
        skipping = true;
        continue;
      }
      skipping = false;
      started = true;
      const numbered = /^(\d+)\.\s+(.*)$/.exec(title);
      blocks.push({
        kind: 'chapter',
        num: numbered ? numbered[1] : null,
        title: numbered ? numbered[2] : title,
      });
      continue;
    }

    if (skipping || !started) continue;

    if (/^###\s+/.test(trimmed)) {
      flushAll();
      blocks.push({ kind: 'heading', spans: parseInline(trimmed.replace(/^###\s+/, '')) });
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmed)) {
      flushAll();
      continue;
    }

    if (trimmed.startsWith('>')) {
      flushParagraph();
      flushList();
      const content = trimmed.replace(/^>\s?/, '').trim();
      if (content) note.push(content);
      continue;
    }
    if (note.length) flushNote();

    // Tabla: cabecera, separador y filas
    if (trimmed.startsWith('|') && lines[i + 1] && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
      flushAll();
      const head = splitRow(trimmed);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(splitRow(lines[i].trim()));
        i++;
      }
      i--;
      blocks.push({ kind: 'table', head, rows });
      continue;
    }

    const ordered = /^(\d+)\.\s+(.*)$/.exec(trimmed);
    const bullet = /^[-*]\s+(.*)$/.exec(trimmed);
    const indented = /^\s{2,}/.test(line);

    if (indented && (ordered || bullet) && list && list.items.length) {
      flushParagraph();
      list.items[list.items.length - 1].sub.push(parseInline(ordered ? ordered[2] : bullet![1]));
      continue;
    }

    if (!indented && (ordered || bullet)) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      if (!list || list.ordered !== isOrdered) {
        flushList();
        list = { ordered: isOrdered, items: [] };
      }
      list.items.push({ spans: parseInline(ordered ? ordered[2] : bullet![1]), sub: [] });
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Continuación de un item de lista partido en varias líneas
    if (list && indented && list.items.length) {
      const item = list.items[list.items.length - 1];
      const target = item.sub.length ? item.sub[item.sub.length - 1] : item.spans;
      target.push({ text: ' ' }, ...parseInline(trimmed));
      continue;
    }

    paragraph.push(trimmed);
  }

  flushAll();
  return blocks;
}

// ---------------------------------------------------------------- logotipo

/** El logo es un JPEG blanco sobre negro: lo pasamos a PNG con transparencia. */
async function whiteLogo(): Promise<Buffer | null> {
  try {
    const { data, info } = await sharp(LOGO)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const pixels = info.width * info.height;
    const rgba = Buffer.alloc(pixels * 4);
    for (let i = 0; i < pixels; i++) {
      rgba[i * 4] = 255;
      rgba[i * 4 + 1] = 255;
      rgba[i * 4 + 2] = 255;
      rgba[i * 4 + 3] = data[i];
    }
    return await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
      .png()
      .toBuffer();
  } catch (e) {
    console.warn('[manual] No se pudo preparar el logo:', e instanceof Error ? e.message : e);
    return null;
  }
}

// ---------------------------------------------------------------- documento

const MARGIN = { top: 82, bottom: 74, left: 62, right: 62 };

async function build() {
  const md = fs.readFileSync(SOURCE, 'utf8');
  const blocks = parseMarkdown(md);
  const logo = await whiteLogo();

  const doc = new PDFDocument({
    size: 'A4',
    margins: MARGIN,
    bufferPages: true,
    autoFirstPage: false,
    info: {
      Title: 'The Warehouse — Manual de uso',
      Author: 'The Warehouse',
      Subject: 'Guía de uso del sistema de gestión de inventario de audio',
    },
  });
  const out = fs.createWriteStream(OUTPUT);
  doc.pipe(out);

  const contentWidth = () => doc.page.width - MARGIN.left - MARGIN.right;
  const bottomLimit = () => doc.page.height - MARGIN.bottom;

  const chapters: { title: string; num: string | null; page: number }[] = [];
  const pageChapter: string[] = [];
  let currentChapter = '';
  let pageIdx = -1;

  doc.on('pageAdded', () => {
    pageIdx++;
    pageChapter[pageIdx] = currentChapter;
  });

  // --- maquetación de texto enriquecido
  //
  // pdfkit rompe la línea en cada cambio de fuente cuando se usa `continued`,
  // así que las líneas se arman aquí: cada palabra se mide con su propia fuente
  // y se coloca en coordenadas explícitas.

  interface Frag {
    text: string;
    span: Span;
    width: number;
  }
  interface Word {
    frags: Frag[];
    width: number;
  }
  interface Line {
    words: Word[];
  }

  const fontFor = (span: Span) =>
    span.code ? MONO : span.bold ? BOLD : span.italic ? ITALIC : BODY;

  /** Agrupa los spans en palabras. La puntuación pegada no se separa del texto. */
  const toWords = (spans: Span[], size: number): Word[] => {
    const words: Word[] = [];
    let pendingSpace = true;
    for (const span of spans) {
      for (const part of span.text.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          pendingSpace = true;
          continue;
        }
        doc.font(fontFor(span)).fontSize(size);
        const frag: Frag = { text: part, span, width: doc.widthOfString(part) };
        if (!pendingSpace && words.length) {
          const last = words[words.length - 1];
          last.frags.push(frag);
          last.width += frag.width;
        } else {
          words.push({ frags: [frag], width: frag.width });
        }
        pendingSpace = false;
      }
    }
    return words;
  };

  const spaceWidth = (size: number) => {
    doc.font(BODY).fontSize(size);
    return doc.widthOfString(' ');
  };

  const breakLines = (words: Word[], maxWidth: number, size: number): Line[] => {
    const space = spaceWidth(size);
    const lines: Line[] = [];
    let current: Word[] = [];
    let width = 0;
    for (const word of words) {
      const extra = current.length ? space + word.width : word.width;
      if (current.length && width + extra > maxWidth) {
        lines.push({ words: current });
        current = [word];
        width = word.width;
      } else {
        current.push(word);
        width += extra;
      }
    }
    if (current.length) lines.push({ words: current });
    return lines;
  };

  const lineHeight = (size: number, gap: number) => {
    doc.font(BODY).fontSize(size);
    return doc.currentLineHeight(true) + gap;
  };

  interface TextOpts {
    size: number;
    color: string;
    width: number;
    x?: number;
    lineGap?: number;
    /** Color de las negritas, para que los nombres de botones se localicen de un vistazo. */
    boldColor?: string;
  }

  const measure = (spans: Span[], opts: TextOpts) => {
    const gap = opts.lineGap ?? 3.2;
    return breakLines(toWords(spans, opts.size), opts.width, opts.size).length *
      lineHeight(opts.size, gap);
  };

  const drawSpans = (spans: Span[], opts: TextOpts) => {
    const gap = opts.lineGap ?? 3.2;
    const x = opts.x ?? MARGIN.left;
    const lines = breakLines(toWords(spans, opts.size), opts.width, opts.size);
    const lh = lineHeight(opts.size, gap);
    const space = spaceWidth(opts.size);

    for (const line of lines) {
      if (doc.y + lh > bottomLimit()) doc.addPage();
      const y = doc.y;
      let cx = x;
      line.words.forEach((word, i) => {
        if (i) cx += space;
        for (const frag of word.frags) {
          const color = frag.span.code
            ? BLUE
            : frag.span.bold
              ? (opts.boldColor ?? opts.color)
              : opts.color;
          doc
            .font(fontFor(frag.span))
            .fontSize(opts.size)
            .fillColor(color)
            .text(frag.text, cx, y, { lineBreak: false });
          cx += frag.width;
        }
      });
      doc.y = y + lh;
    }
  };

  // ---------------- portada
  currentChapter = '';
  doc.addPage();
  doc.rect(0, 0, doc.page.width, doc.page.height).fill(NAVY);
  doc.rect(0, 0, doc.page.width, 6).fill(AMBER);

  if (logo) doc.image(logo, MARGIN.left, 126, { width: 200 });

  doc
    .font(BOLD)
    .fontSize(10)
    .fillColor(AMBER)
    .text('THE WAREHOUSE', MARGIN.left, 272, { characterSpacing: 3 });

  doc.font(BOLD).fontSize(46).fillColor('#FFFFFF').text('Manual de uso', MARGIN.left, 296);

  doc
    .font(BODY)
    .fontSize(12.5)
    .fillColor('#C3D0E0')
    .text(
      'Gestión de inventario de equipos de audio. Guía práctica para el trabajo del día a día: dar de alta equipos, trasladarlos, montar eventos y saber siempre dónde está cada cosa.',
      MARGIN.left,
      360,
      { width: contentWidth() - 70, lineGap: 5 },
    );

  doc
    .moveTo(MARGIN.left, 466)
    .lineTo(MARGIN.left + 64, 466)
    .lineWidth(2.5)
    .strokeColor(AMBER)
    .stroke();

  const cards: [string, string][] = [
    ['Para quién', 'Cualquier persona que use la aplicación, sin conocimientos técnicos'],
    ['Qué encontrarás', 'Diecinueve capítulos con cada módulo explicado paso a paso'],
    ['Si algo falla', 'El capítulo 17 resuelve las dudas más frecuentes'],
  ];
  let cardY = 504;
  for (const [title, body] of cards) {
    doc
      .font(BOLD)
      .fontSize(9)
      .fillColor(AMBER)
      .text(title.toUpperCase(), MARGIN.left, cardY, { characterSpacing: 1.4 });
    doc
      .font(BODY)
      .fontSize(11)
      .fillColor('#DCE5F0')
      .text(body, MARGIN.left, cardY + 15, { width: contentWidth() - 90 });
    cardY += 54;
  }

  doc
    .font(BODY)
    .fontSize(9.5)
    .fillColor('#7C8CA3')
    .text('Actualizado el 7 de septiembre de 2026', MARGIN.left, doc.page.height - 92);

  // ---------------- índice (se rellena al final, cuando sabemos las páginas)
  currentChapter = 'Contenido';
  doc.addPage();
  const tocPage = pageIdx;

  // ---------------- capítulos
  for (const block of blocks) {
    switch (block.kind) {
      case 'chapter': {
        currentChapter = block.title;
        doc.addPage();
        chapters.push({ title: block.title, num: block.num, page: pageIdx + 1 });
        // Marcadores para el panel de navegación del lector de PDF.
        doc.outline.addItem(block.num ? `${block.num}. ${block.title}` : block.title);

        if (block.num) {
          doc
            .font(BOLD)
            .fontSize(8.5)
            .fillColor(MUTED)
            .text(`CAPÍTULO ${block.num}`, MARGIN.left, MARGIN.top - 24, { characterSpacing: 1.8 });
        }
        doc.font(BOLD).fontSize(23).fillColor(NAVY).text(block.title, MARGIN.left, MARGIN.top);
        const underline = doc.y + 9;
        doc
          .moveTo(MARGIN.left, underline)
          .lineTo(MARGIN.left + 46, underline)
          .lineWidth(2.5)
          .strokeColor(AMBER)
          .stroke();
        doc.y = underline + 26;
        break;
      }

      case 'heading': {
        const h = measure(block.spans, { size: 13, color: BLUE, width: contentWidth() });
        if (doc.y + h + 40 > bottomLimit()) doc.addPage();
        else doc.y += 13;
        drawSpans(block.spans, { size: 13, color: BLUE, width: contentWidth() });
        doc.y += 6;
        break;
      }

      case 'paragraph': {
        drawSpans(block.spans, {
          size: 10.5,
          color: TEXT,
          width: contentWidth(),
          boldColor: NAVY,
        });
        doc.y += 9;
        break;
      }

      case 'note': {
        const inner = contentWidth() - 44;
        const opts = { size: 10, color: NOTE_TEXT, width: inner, lineGap: 3 };
        const h = measure(block.spans, opts) + 24;
        if (doc.y + h + 16 > bottomLimit()) doc.addPage();
        const top = doc.y;
        doc.roundedRect(MARGIN.left, top, contentWidth(), h, 4).fill(NOTE_BG);
        doc.rect(MARGIN.left, top, 3.5, h).fill(NOTE_BORDER);
        doc.y = top + 12;
        drawSpans(block.spans, { ...opts, x: MARGIN.left + 22 });
        doc.y = top + h + 14;
        break;
      }

      case 'list': {
        const indent = 24;
        const width = contentWidth() - indent;
        for (let index = 0; index < block.items.length; index++) {
          const item = block.items[index];
          const itemOpts = {
            size: 10.5,
            color: TEXT,
            width,
            x: MARGIN.left + indent,
            boldColor: NAVY,
          };
          // La viñeta y su primera línea no deben quedar separadas por un salto.
          if (doc.y + lineHeight(10.5, 3.2) * 2 > bottomLimit()) doc.addPage();

          const top = doc.y;
          if (block.ordered) {
            doc.circle(MARGIN.left + 7.5, top + 6.5, 8.5).fill(AMBER);
            doc
              .font(BOLD)
              .fontSize(8.5)
              .fillColor(NAVY)
              .text(String(index + 1), MARGIN.left, top + 3.5, { width: 15, align: 'center' });
          } else {
            doc.circle(MARGIN.left + 5.5, top + 6, 2.6).fill(AMBER);
          }

          doc.y = top;
          drawSpans(item.spans, itemOpts);

          for (const sub of item.sub) {
            doc.y += 3;
            const subX = MARGIN.left + indent + 15;
            const subWidth = contentWidth() - indent - 15;
            if (doc.y + lineHeight(10, 3) > bottomLimit()) doc.addPage();
            const subTop = doc.y;
            doc
              .moveTo(subX - 10, subTop + 5.5)
              .lineTo(subX - 5, subTop + 5.5)
              .lineWidth(1.1)
              .strokeColor(MUTED)
              .stroke();
            doc.y = subTop;
            drawSpans(sub, {
              size: 10,
              color: TEXT,
              width: subWidth,
              x: subX,
              lineGap: 3,
              boldColor: NAVY,
            });
          }

          doc.y += 6;
        }
        doc.y += 4;
        break;
      }

      case 'table': {
        const cols = block.head.length;
        const total = contentWidth();
        // Reparto proporcional al contenido, con suelo y techo para que una
        // columna larga no aplaste a las demás.
        const weights = block.head.map((h, c) => {
          const lengths = [h.length, ...block.rows.map((r) => (r[c] ?? '').length)];
          const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
          return Math.min(Math.max(avg, 9), 44);
        });
        const sum = weights.reduce((a, b) => a + b, 0);
        const widths = weights.map((w) => (w / sum) * total);
        const xs: number[] = [];
        let acc = MARGIN.left;
        for (let c = 0; c < cols; c++) {
          xs.push(acc);
          acc += widths[c];
        }
        const PAD = 7;
        const clean = (cell: string) => cell.replace(/\*\*/g, '').replace(/`/g, '');

        const rowHeight = (cells: string[], font: string, size: number) => {
          doc.font(font).fontSize(size);
          return (
            Math.max(
              ...cells.map((cell, c) =>
                doc.heightOfString(cell, { width: widths[c] - PAD * 2, lineGap: 1.5 }),
              ),
            ) + PAD * 2
          );
        };

        const drawHead = () => {
          const cells = block.head.map(clean);
          const h = rowHeight(cells, BOLD, 9) + 1;
          const top = doc.y;
          doc.rect(MARGIN.left, top, total, h).fill(NAVY);
          cells.forEach((cell, c) => {
            doc
              .font(BOLD)
              .fontSize(9)
              .fillColor('#FFFFFF')
              .text(cell, xs[c] + PAD, top + PAD, {
                width: widths[c] - PAD * 2,
                lineGap: 1.5,
              });
          });
          doc.y = top + h;
        };

        if (doc.y + 90 > bottomLimit()) doc.addPage();
        doc.y += 2;
        drawHead();

        block.rows.forEach((row, r) => {
          const cells = block.head.map((_, c) => clean(row[c] ?? ''));
          const h = rowHeight(cells, BODY, 9.5);
          if (doc.y + h > bottomLimit()) {
            doc.addPage();
            drawHead();
          }
          const top = doc.y;
          if (r % 2 === 1) doc.rect(MARGIN.left, top, total, h).fill(ZEBRA);
          cells.forEach((cell, c) => {
            doc
              .font(c === 0 ? BOLD : BODY)
              .fontSize(9.5)
              .fillColor(c === 0 ? NAVY : TEXT)
              .text(cell, xs[c] + PAD, top + PAD, { width: widths[c] - PAD * 2, lineGap: 1.5 });
          });
          doc
            .moveTo(MARGIN.left, top + h)
            .lineTo(MARGIN.left + total, top + h)
            .lineWidth(0.6)
            .strokeColor(LINE)
            .stroke();
          doc.y = top + h;
        });
        doc.y += 14;
        break;
      }
    }
  }

  // ---------------- índice, encabezados y pies
  const totalPages = doc.bufferedPageRange().count;

  doc.switchToPage(tocPage);
  doc.font(BOLD).fontSize(23).fillColor(NAVY).text('Contenido', MARGIN.left, MARGIN.top);
  let tocY = doc.y + 9;
  doc
    .moveTo(MARGIN.left, tocY)
    .lineTo(MARGIN.left + 46, tocY)
    .lineWidth(2.5)
    .strokeColor(AMBER)
    .stroke();
  tocY += 30;

  for (const chapter of chapters) {
    doc
      .font(BOLD)
      .fontSize(10)
      .fillColor(AMBER)
      .text(chapter.num ? `${chapter.num}.` : '', MARGIN.left, tocY, { width: 22 });
    doc
      .font(chapter.num ? BODY : ITALIC)
      .fontSize(11)
      .fillColor(NAVY)
      .text(chapter.title, MARGIN.left + 24, tocY - 0.5, {
        width: contentWidth() - 70,
        lineBreak: false,
      });
    const dotsFrom = MARGIN.left + 24 + doc.widthOfString(chapter.title) + 8;
    const dotsTo = MARGIN.left + contentWidth() - 24;
    if (dotsTo > dotsFrom) {
      doc
        .moveTo(dotsFrom, tocY + 6.5)
        .lineTo(dotsTo, tocY + 6.5)
        .lineWidth(0.6)
        .dash(1.4, { space: 3 })
        .strokeColor('#C9D4E2')
        .stroke()
        .undash();
    }
    doc
      .font(BOLD)
      .fontSize(10)
      .fillColor(MUTED)
      .text(String(chapter.page), MARGIN.left + contentWidth() - 20, tocY, {
        width: 20,
        align: 'right',
        lineBreak: false,
      });
    tocY += 21.5;
  }

  const startPages = new Set(chapters.map((c) => c.page));
  for (let i = 1; i < totalPages; i++) {
    // La portada (i === 0) va sin encabezado ni pie.
    doc.switchToPage(i);

    // Sin esto, escribir por debajo del margen inferior hace que pdfkit añada
    // una página nueva por cada pie dibujado.
    const keepBottom = doc.page.margins.bottom;
    const keepTop = doc.page.margins.top;
    doc.page.margins.bottom = 0;
    doc.page.margins.top = 0;

    const humanPage = i + 1;
    const chapter = pageChapter[i];
    if (chapter && i !== tocPage && !startPages.has(humanPage)) {
      doc
        .font(BODY)
        .fontSize(8)
        .fillColor(MUTED)
        .text(chapter, MARGIN.left, 46, {
          width: contentWidth(),
          align: 'right',
          lineBreak: false,
        });
    }

    const footY = doc.page.height - 52;
    doc
      .moveTo(MARGIN.left, footY)
      .lineTo(doc.page.width - MARGIN.right, footY)
      .lineWidth(0.6)
      .strokeColor(LINE)
      .stroke();
    doc
      .font(BODY)
      .fontSize(8)
      .fillColor(MUTED)
      .text('The Warehouse · Manual de uso', MARGIN.left, footY + 9, { lineBreak: false });
    doc
      .font(BODY)
      .fontSize(8)
      .fillColor(MUTED)
      .text(`${humanPage} / ${totalPages}`, MARGIN.left, footY + 9, {
        width: contentWidth(),
        align: 'right',
        lineBreak: false,
      });

    doc.page.margins.bottom = keepBottom;
    doc.page.margins.top = keepTop;
  }

  doc.end();

  await new Promise<void>((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });

  const size = (fs.statSync(OUTPUT).size / 1024).toFixed(0);
  console.log(`[manual] PDF generado: ${path.relative(ROOT, OUTPUT)} (${size} KB)`);
  console.log(`[manual] ${chapters.length} capítulos · ${totalPages} páginas`);
}

build().catch((e) => {
  console.error('[manual] Falló la generación:', e);
  process.exit(1);
});
