import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ris = await readFile(new URL("../app/ris.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("a exportação RIS preserva dados bibliográficos e proveniência", () => {
  for (const tag of ["TY  - JOUR", "TI", "AU", "PY", "DO", "UR", "AB", "AN", "N1", "ER  -"]) {
    assert.match(ris, new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(ris, /Fonte de descoberta/);
  assert.match(ris, /consulta:/);
  assert.match(ris, /application\/x-research-info-systems/);
});

test("a interface exporta somente o conjunto atualmente filtrado", () => {
  assert.match(page, /downloadRisExport/);
  assert.match(page, /works: filteredWorks/);
  assert.match(page, /Exportar RIS/);
  assert.match(page, /exportNotice/);
});
