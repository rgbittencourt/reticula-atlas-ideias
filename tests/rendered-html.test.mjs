import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("compila o artefato Worker do Retícula com a identidade da aplicação", () => {
  const workerPath = new URL("../dist/server/index.js", import.meta.url);
  const pagePath = new URL("../app/page.tsx", import.meta.url);
  const layoutPath = new URL("../app/layout.tsx", import.meta.url);

  assert.equal(existsSync(workerPath), true);
  const worker = readFileSync(workerPath, "utf8");
  const page = readFileSync(pagePath, "utf8");
  const layout = readFileSync(layoutPath, "utf8");

  assert.match(worker, /fetch\(/);
  assert.match(layout, /Retícula — Atlas de Literatura Científica/);
  assert.match(page, /Ideias ganham/);
  assert.match(page, /Começar uma pesquisa/);
  assert.match(page, /sem cadastro · sem login/);
  assert.doesNotMatch(page, /Your site is taking shape|Building your site/);
});

test("os comandos de exportação têm rótulos consistentes e não presumem retorno ao AcademiaOS", () => {
  const pagePath = new URL("../app/page.tsx", import.meta.url);
  const cssPath = new URL("../app/enhancements.css", import.meta.url);
  const page = readFileSync(pagePath, "utf8");
  const css = readFileSync(cssPath, "utf8");

  assert.match(page, /Exportar RIS \(\{filteredWorks\.length\}\) ↓/);
  assert.match(page, /Exportar BibTeX \(\{filteredWorks\.length\}\) ↓/);
  assert.match(page, /Exportar CSV \(\{filteredWorks\.length\}\) ↓/);
  assert.doesNotMatch(page, /Continuar no AcademiaOS/);
  assert.doesNotMatch(page, /atlas-action-primary/);
  assert.doesNotMatch(css, /atlas-continue/);
  assert.match(css, /\.atlas-tools \.atlas-action/);
});
