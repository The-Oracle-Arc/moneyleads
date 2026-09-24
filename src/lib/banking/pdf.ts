/**
 * Minimal PDF writer. No native modules. Used for statements and receipts.
 */

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function buildPdf(lines: string[]): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const leading = 14;
  const startY = 748;
  const maxLines = 48;
  const pages: string[][] = [];
  let current: string[] = [];
  for (const raw of lines) {
    const wrapped = wrapLine(raw, 92);
    for (const line of wrapped) {
      if (current.length >= maxLines) {
        pages.push(current);
        current = [];
      }
      current.push(line);
    }
  }
  if (current.length) pages.push(current);
  if (!pages.length) pages.push([" "]);

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds: number[] = [];
  const kids: string[] = [];
  let nextId = 3;
  const pageObjectIds: number[] = [];
  for (let i = 0; i < pages.length; i++) {
    pageObjectIds.push(nextId);
    kids.push(`${nextId} 0 R`);
    nextId += 2;
  }
  objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [${kids.join(" ")}] >>`);

  const content: { id: number; stream: string }[] = [];
  pages.forEach((page, i) => {
    const pageId = pageObjectIds[i]!;
    const contentId = pageId + 1;
    pageIds.push(pageId);
    let y = startY;
    const ops = [
      "BT",
      "/F1 10 Tf",
      `${leading} TL`,
      `50 ${y} Td`,
    ];
    page.forEach((line, idx) => {
      if (idx === 0) ops.push(`(${escapePdf(line)}) Tj`);
      else ops.push(`T* (${escapePdf(line)}) Tj`);
    });
    ops.push("ET");
    const stream = ops.join("\n");
    content.push({ id: contentId, stream });
    objects[pageId - 1] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${nextId} 0 R >> >> >>`;
    while (objects.length < pageId) objects.push("<< >>");
    objects[contentId - 1] = "";
  });
  const fontId = nextId;
  while (objects.length < fontId - 1) objects.push("<< >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const body: string[] = ["%PDF-1.4"];
  const offsets = [0];
  function writeObj(id: number, dict: string, stream?: string) {
    offsets[id] = body.join("\n").length + 1;
    if (stream != null) {
      const bytes = Buffer.byteLength(stream, "utf8");
      body.push(`${id} 0 obj`);
      body.push(`<< /Length ${bytes} >>`);
      body.push("stream");
      body.push(stream);
      body.push("endstream");
      body.push("endobj");
    } else {
      body.push(`${id} 0 obj`);
      body.push(dict);
      body.push("endobj");
    }
  }

  writeObj(1, objects[0]!);
  writeObj(2, objects[1]!);
  for (const pageId of pageObjectIds) {
    writeObj(pageId, objects[pageId - 1]!);
    const stream = content.find((c) => c.id === pageId + 1)?.stream ?? "BT ET";
    writeObj(pageId + 1, "", stream);
  }
  writeObj(fontId, objects[fontId - 1]!);

  const xrefAt = body.join("\n").length + 1;
  const maxId = fontId;
  body.push("xref");
  body.push(`0 ${maxId + 1}`);
  body.push("0000000000 65535 f ");
  for (let i = 1; i <= maxId; i++) {
    const off = offsets[i] ?? 0;
    body.push(`${off.toString().padStart(10, "0")} 00000 n `);
  }
  body.push("trailer");
  body.push(`<< /Size ${maxId + 1} /Root 1 0 R >>`);
  body.push("startxref");
  body.push(String(xrefAt));
  body.push("%%EOF");
  return new Uint8Array(Buffer.from(body.join("\n"), "utf8"));
}

function wrapLine(text: string, width: number): string[] {
  if (text.length <= width) return [text || " "];
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (next.length > width) {
      if (cur) lines.push(cur);
      cur = word;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [" "];
}

export function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}
