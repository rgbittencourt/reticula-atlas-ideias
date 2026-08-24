import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renderiza a aplicação Retícula", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Retícula — Atlas de Literatura Científica<\/title>/i);
  assert.match(html, /Retícula/);
  assert.match(html, /Ideias ganham/);
  assert.match(html, /Começar uma pesquisa/);
  assert.match(html, /sem cadastro · sem login/);
  assert.doesNotMatch(html, /Your site is taking shape|Building your site/);
});
