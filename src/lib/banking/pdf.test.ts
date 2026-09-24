import assert from "node:assert/strict";
import test from "node:test";
import { buildPdf, uint8ToBase64 } from "./pdf.ts";

test("writes a PDF 1.4 document", () => {
  const bytes = buildPdf(["MONEYLEAD", "Statement of Account", "SANDBOX / DEMONSTRATION — NO REAL FUNDS MOVED"]);
  const text = Buffer.from(bytes).toString("latin1");
  assert.match(text, /%PDF-1.4/);
  assert.match(text, /MONEYLEAD/);
  assert.ok(uint8ToBase64(bytes).length > 20);
});
