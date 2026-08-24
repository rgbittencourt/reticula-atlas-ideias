import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const route = await readFile(new URL("../app/api/atlas/route.ts", import.meta.url), "utf8");

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
