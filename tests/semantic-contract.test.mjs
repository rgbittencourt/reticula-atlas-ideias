import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/atlas/route.ts", import.meta.url), "utf8");
const translationRoute = await readFile(new URL("../app/api/translate/route.ts", import.meta.url), "utf8");

test("mantém as três coordenadas como papéis semânticos distintos", () => {
  assert.match(route, /buildSemanticPlan\(theme, subject, discipline\)/);
  assert.match(route, /coordinate:theme/);
  assert.match(route, /coordinate:subject/);
  assert.match(route, /coordinate:discipline/);
  assert.match(route, /queries\.portuguese/);
  assert.match(route, /queries\.technical/);
  assert.match(route, /queries\.biomedical/);
  assert.match(route, /relevanceScore/);
});

test("adapta consultas e fontes ao domínio pesquisado", () => {
  assert.match(route, /providerSafeQuery/);
  assert.match(route, /applicable: biomedical/);
  assert.match(route, /applicable: technical/);
  assert.match(route, /not_applicable/);
  assert.match(route, /coordinateFallback/);
  assert.match(route, /usableQuery/);
});

test("traduz as coordenadas com contexto científico e mantém contingência", () => {
  assert.match(translationRoute, /translateWithOpenAI/);
  assert.match(translationRoute, /Traduza para inglês científico/);
  assert.match(translationRoute, /provider: "openai"/);
  assert.match(translationRoute, /provider: "public-fallback"/);
});
