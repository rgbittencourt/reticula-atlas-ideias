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
