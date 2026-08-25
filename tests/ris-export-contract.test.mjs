import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ris = await readFile(new URL("../app/ris.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("as exportações bibliográficas preservam dados, proveniência e formatos interoperáveis", () => {
  for (const tag of ["TY  - JOUR", "TI", "AU", "PY", "DO", "UR", "AB", "AN", "N1", "ER  -"]) {
    assert.match(ris, new RegExp(tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(ris, /Fonte de descoberta/);
  assert.match(ris, /consulta:/);
  assert.match(ris, /application\/x-research-info-systems/);
  assert.match(ris, /createBibtexExport/);
  assert.match(ris, /@article/);
  assert.match(ris, /bibtexValue/);
  assert.match(ris, /createCsvExport/);
  assert.match(ris, /\\uFEFF/);
  assert.match(ris, /"exportedAt"/);
  assert.match(ris, /downloadBibliographicExport/);
});

test("a interface exporta somente o conjunto filtrado e oferece continuidade contextual", () => {
  assert.match(page, /downloadRisExport/);
  assert.match(page, /downloadBibtexExport/);
  assert.match(page, /downloadCsvExport/);
  assert.match(page, /works: filteredWorks/);
  assert.match(page, /Exportar RIS/);
  assert.match(page, /BibTeX/);
  assert.match(page, /CSV/);
  assert.match(page, /exportNotice/);
  assert.match(page, /cartographerSearchUrl/);
  assert.match(page, /params\.get\("from"\) !== "academiaos"/);
  assert.match(page, /Continuar no AcademiaOS/);
  assert.match(page, /target="_blank"/);
});
