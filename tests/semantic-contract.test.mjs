import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/atlas/route.ts", import.meta.url), "utf8");
const translationRoute = await readFile(new URL("../app/api/translate/route.ts", import.meta.url), "utf8");
const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

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

test("informa na abertura todos os serviços e bases utilizados", () => {
  for (const source of ["OpenAI · análise semântica", "Semantic Scholar", "Oasisbr / IBICT", "BDTD / IBICT", "DOAJ", "CAPES Dados Abertos", "ERIC", "DataCite", "LA Referencia", "OAI-PMH"])
    assert.match(page, new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("adapta consultas e fontes ao domínio pesquisado", () => {
  assert.match(route, /providerSafeQuery/);
  assert.match(route, /applicable: biomedical/);
  assert.match(route, /applicable: technical/);
  assert.match(route, /not_applicable/);
  assert.match(route, /coordinateFallback/);
  assert.match(route, /usableQuery/);
  assert.match(route, /Oasisbr \/ IBICT/);
  assert.match(route, /BDTD \/ IBICT/);
  assert.match(route, /DOAJ/);
  assert.match(route, /CAPES Dados Abertos/);
  assert.match(route, /applicable: education/);
  assert.match(route, /DataCite/);
  assert.match(route, /LA Referencia/);
  assert.match(route, /Repositórios BR \(OAI-PMH\)/);
  assert.match(route, /discoveryQuery/);
});

test("traduz as coordenadas com contexto científico e mantém contingência", () => {
  assert.match(translationRoute, /translateWithOpenAI/);
  assert.match(translationRoute, /Traduza para inglês científico/);
  assert.match(translationRoute, /provider: "openai"/);
  assert.match(translationRoute, /provider: "public-fallback"/);
});

test("trata respostas HTTP vazias ou inválidas antes de construir o atlas", () => {
  assert.match(page, /async function readJsonResponse\(response: Response, operation: string\)/);
  assert.match(page, /const payload = await response\.text\(\)/);
  assert.match(page, /O serviço não retornou dados ao \$\{operation\}/);
  assert.match(page, /O serviço retornou uma resposta inválida ao \$\{operation\}/);
  assert.match(page, /await readJsonResponse\(r, "construir o atlas"\)/);
  assert.match(page, /await readJsonResponse\(r, "traduzir as coordenadas"\)/);
});
