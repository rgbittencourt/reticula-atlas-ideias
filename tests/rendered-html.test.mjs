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

test("o retorno ao AcademiaOS tem rótulo visível e acessível no painel de referências", () => {
  const pagePath = new URL("../app/page.tsx", import.meta.url);
  const cssPath = new URL("../app/enhancements.css", import.meta.url);
  const page = readFileSync(pagePath, "utf8");
  const css = readFileSync(cssPath, "utf8");

  assert.match(page, /className="atlas-continue atlas-continue-inline"/);
  assert.match(page, /Continuar no AcademiaOS/);
  assert.match(page, /aria-label="Continuar no AcademiaOS com o contexto deste atlas"/);
  assert.match(css, /\.export-inline-actions \.atlas-continue-inline/);
  assert.match(css, /color: var\(--green\)/);
  assert.match(css, /background: #fffdf7/);
  assert.match(page, /className="atlas-action atlas-action-primary"/);
  assert.match(page, /Exportar BibTeX ↓/);
  assert.match(page, /Exportar CSV ↓/);
  assert.match(page, /className="atlas-action atlas-continue"/);
  assert.match(css, /\.atlas-tools \.atlas-action/);
});
