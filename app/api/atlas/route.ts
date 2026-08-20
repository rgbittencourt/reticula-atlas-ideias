import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type Work = {
  id: string;
  title: string;
  year: number | null;
  authors: string[];
  venue: string;
  doi: string | null;
  url: string;
  abstract: string | null;
  citations: number;
  source: string;
  fields: string[];
};
type Provider = { name: string; limit: number; search: (query: string) => Promise<Work[]> };

const STOP = new Set(
  `a o as os um uma de da do das dos em no na nos nas para por com sem sobre entre e ou que como ao seu sua seus suas este esta isso ser ter sao mais menos estudo estudos analise research study studies analysis effect effects using based approach review systematic from into with without this that these those their our evidence results method methods data model models`.split(
    /\s+/,
  ),
);
const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const titleOf = (v: unknown) =>
  Array.isArray(v) ? String(v[0] || "") : String(v || "");
const yearOf = (parts: any) => (parts?.[0]?.[0] ? Number(parts[0][0]) : null);
const strip = (s: any) =>
  s
    ? String(s)
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : null;
const decodeXml = (s: string) =>
  strip(
    s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'"),
  ) || "";
const tags = (xml: string, tag: string) =>
  [
    ...xml.matchAll(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"),
    ),
  ].map((m) => decodeXml(m[1]));
const blocks = (xml: string, tag: string) =>
  [
    ...xml.matchAll(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi"),
    ),
  ].map((m) => m[1]);

async function timedFetch(input: string, init: RequestInit = {}, timeoutMs = 12_000) {
  void timeoutMs;
  return fetch(input, init);
}

async function semanticScholar(query: string): Promise<Work[]> {
  const fields =
    "title,year,authors,venue,url,abstract,citationCount,externalIds,fieldsOfStudy";
  const headers: Record<string, string> = {
    "User-Agent": "ReticulaAtlas/2.0 (academic discovery)",
  };
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }
  const limit = process.env.SEMANTIC_SCHOLAR_API_KEY ? 100 : 60;
  const r = await timedFetch(
    `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=${encodeURIComponent(fields)}`,
    { headers },
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();
  return (j.data || [])
    .filter((p: any) => p.title)
    .map((p: any) => ({
      id: `s2:${p.paperId}`,
      title: p.title,
      year: p.year || null,
      authors: (p.authors || []).map((a: any) => a.name).filter(Boolean),
      venue: p.venue || "",
      doi: p.externalIds?.DOI || null,
      url: p.externalIds?.DOI
        ? `https://doi.org/${p.externalIds.DOI}`
        : p.url || "",
      abstract: p.abstract || null,
      citations: p.citationCount || 0,
      source: "Semantic Scholar",
      fields: p.fieldsOfStudy || [],
    }));
}

async function crossrefSearch(query: string, scielo = false): Promise<Work[]> {
  const select =
    "DOI,title,author,published,container-title,URL,is-referenced-by-count,abstract,subject,publisher";
  const search = query;
  const pageSize = scielo ? 40 : 60;
  const responses = await Promise.all([0, pageSize].map((offset) => timedFetch(
    `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(search)}&rows=${pageSize}&offset=${offset}${scielo ? "&filter=prefix:10.1590" : ""}&select=${encodeURIComponent(select)}&mailto=inovalab.cte@ifsc.edu.br`, {
      headers: {
        "User-Agent": "ReticulaAtlas/2.0 (mailto:inovalab.cte@ifsc.edu.br)",
      },
    })));
  const failed = responses.find((r) => !r.ok);
  if (failed) throw new Error(`HTTP ${failed.status}`);
  const pages: any[] = await Promise.all(responses.map((r) => r.json()));
  const items = pages.flatMap((j) => j.message?.items || []).filter((p: any) => titleOf(p.title));
  const filtered = items;
  return filtered.map((p: any) => ({
    id: `${scielo ? "scielo" : "cr"}:${p.DOI || normalize(titleOf(p.title))}`,
    title: titleOf(p.title),
    year: yearOf(p.published?.["date-parts"]),
    authors: (p.author || [])
      .map((a: any) => [a.given, a.family].filter(Boolean).join(" "))
      .filter(Boolean),
    venue: titleOf(p["container-title"]),
    doi: p.DOI || null,
    url: p.DOI ? `https://doi.org/${p.DOI}` : p.URL,
    abstract: strip(p.abstract),
    citations: p["is-referenced-by-count"] || 0,
    source: scielo ? "SciELO Brasil (metadados Crossref)" : "Crossref",
    fields: p.subject || [],
  }));
}

async function openAlex(query: string): Promise<Work[]> {
  const key = process.env.OPENALEX_API_KEY
    ? `&api_key=${encodeURIComponent(process.env.OPENALEX_API_KEY)}`
    : "";
  const responses = await Promise.all([1, 2].map((page) => timedFetch(
    `https://api.openalex.org/works?search=${encodeURIComponent(query)}&page=${page}&per-page=50&select=id,title,display_name,publication_year,authorships,primary_location,doi,cited_by_count,topics&mailto=inovalab.cte@ifsc.edu.br${key}`,
  )));
  const failed = responses.find((r) => !r.ok);
  if (failed) throw new Error(`HTTP ${failed.status}`);
  const pages: any[] = await Promise.all(responses.map((r) => r.json()));
  return pages.flatMap((j) => j.results || [])
    .map((p: any) => ({
      id: `oa:${p.id}`,
      title: p.title || p.display_name,
      year: p.publication_year || null,
      authors: (p.authorships || [])
        .map((a: any) => a.author?.display_name)
        .filter(Boolean),
      venue: p.primary_location?.source?.display_name || "",
      doi: p.doi?.replace(/^https?:\/\/doi.org\//i, "") || null,
      url: p.doi || p.primary_location?.landing_page_url || p.id,
      abstract: null,
      citations: p.cited_by_count || 0,
      source: "OpenAlex",
      fields: (p.topics || p.concepts || [])
        .slice(0, 8)
        .map((x: any) => x.display_name)
        .filter(Boolean),
    }))
    .filter((p: any) => p.title);
}

async function openAire(query: string): Promise<Work[]> {
  const r = await timedFetch(
    `https://api.openaire.eu/graph/v3/research-products?search=${encodeURIComponent(query)}&type=publication&pageSize=100`,
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();
  return (j.results || [])
    .map((p: any) => {
      const doi = (p.pids || p.identifiers || []).find(
        (x: any) => String(x.scheme || x.type).toLowerCase() === "doi",
      )?.value;
      return {
        id: `openaire:${p.id || doi || normalize(p.title || "")}`,
        title: titleOf(p.title || p.mainTitle),
        year:
          Number(
            String(p.publicationDate || p.dateofacceptance || "").slice(0, 4),
          ) || null,
        authors: (p.authors || p.creators || [])
          .map((a: any) => a.fullName || a.name || a)
          .filter(Boolean),
        venue: p.publisher || p.journal?.name || "",
        doi: doi || null,
        url: doi ? `https://doi.org/${doi}` : p.url || p.id || "",
        abstract: strip(p.description || p.abstract),
        citations: 0,
        source: "OpenAIRE",
        fields: (p.subjects || [])
          .map((x: any) => x.subject || x)
          .filter(Boolean),
      };
    })
    .filter((p: any) => p.title);
}

async function europePmc(query: string): Promise<Work[]> {
  const r = await timedFetch(
    `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(query)}&format=json&pageSize=100&resultType=core`,
  );
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j: any = await r.json();
  return (j.resultList?.result || [])
    .filter((p: any) => p.title)
    .map((p: any) => ({
      id: `epmc:${p.source}:${p.id}`,
      title: strip(p.title) || p.title,
      year: Number(p.pubYear) || null,
      authors: (p.authorList?.author || [])
        .map((a: any) => a.fullName)
        .filter(Boolean),
      venue: p.journalTitle || "",
      doi: p.doi || null,
      url: p.doi
        ? `https://doi.org/${p.doi}`
        : `https://europepmc.org/article/${p.source}/${p.id}`,
      abstract: strip(p.abstractText),
      citations: Number(p.citedByCount) || 0,
      source: p.source === "MED" ? "Europe PMC / PubMed" : "Europe PMC",
      fields: p.pubTypeList?.pubType || [],
    }));
}

async function arxiv(query: string): Promise<Work[]> {
  const responses = await Promise.all([0, 40].map((start) => timedFetch(
    `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=${start}&max_results=40`, {
      headers: { "User-Agent": "ReticulaAtlas/2.0 (inovalab.cte@ifsc.edu.br)" },
    })));
  const failed = responses.find((r) => !r.ok);
  if (failed) throw new Error(`HTTP ${failed.status}`);
  const xmlPages = await Promise.all(responses.map((r) => r.text()));
  return xmlPages.flatMap((xml) => blocks(xml, "entry"))
    .map((entry) => {
      const id = tags(entry, "id")[0] || "";
      const doi = tags(entry, "arxiv:doi")[0] || null;
      return {
        id: `arxiv:${id.split("/").pop()}`,
        title: tags(entry, "title")[0],
        year: Number((tags(entry, "published")[0] || "").slice(0, 4)) || null,
        authors: tags(entry, "name"),
        venue: "arXiv",
        doi,
        url: doi ? `https://doi.org/${doi}` : id,
        abstract: tags(entry, "summary")[0] || null,
        citations: 0,
        source: "arXiv",
        fields: tags(entry, "category"),
      };
    })
    .filter((p) => p.title);
}

async function core(query: string): Promise<Work[]> {
  if (!process.env.CORE_API_KEY) {
    throw new Error("requer uma CORE_API_KEY para consulta confiável");
  }
  const headers: Record<string, string> = { "User-Agent": "ReticulaAtlas/2.0" };
  headers.Authorization = `Bearer ${process.env.CORE_API_KEY}`;
  const r = await timedFetch(
    `https://api.core.ac.uk/v3/search/works/?q=${encodeURIComponent(query)}&limit=100`,
    { headers },
  );
  if (!r.ok)
    throw new Error(
      `HTTP ${r.status}${r.status === 401 || r.status === 403 ? " — requer CORE_API_KEY" : ""}`,
    );
  const j: any = await r.json();
  return (j.results || [])
    .filter((p: any) => p.title)
    .map((p: any) => ({
      id: `core:${p.id}`,
      title: p.title,
      year: p.yearPublished || p.year || null,
      authors: (p.authors || []).map((a: any) => a.name || a).filter(Boolean),
      venue: p.publisher || p.journals?.[0]?.title || "",
      doi: p.doi || null,
      url: p.doi
        ? `https://doi.org/${p.doi}`
        : p.downloadUrl ||
          p.sourceFulltextUrls?.[0] ||
          `https://core.ac.uk/works/${p.id}`,
      abstract: strip(p.abstract),
      citations: Number(p.citationCount) || 0,
      source: "CORE",
      fields: p.topics || [],
    }));
}

function dedupe(groups: Work[][]): Work[] {
  const map = new Map<string, Work>();
  for (const w of groups.flat()) {
    const key = w.doi
      ? `doi:${w.doi.toLowerCase()}`
      : `title:${normalize(w.title)}`;
    const old = map.get(key);
    if (!old) map.set(key, w);
    else
      map.set(key, {
        ...old,
        abstract: old.abstract || w.abstract,
        doi: old.doi || w.doi,
        url: old.url || w.url,
        citations: Math.max(old.citations, w.citations),
        fields: [...new Set([...old.fields, ...w.fields])],
        source: [
          ...new Set([...old.source.split(" + "), ...w.source.split(" + ")]),
        ].join(" + "),
      });
  }
  return [...map.values()];
}
function phrases(text: string) {
  const words = normalize(text)
    .split(" ")
    .filter((w) => w.length > 3 && !STOP.has(w) && !/^\d+$/.test(w));
  const out: string[] = [];
  for (let i = 0; i < words.length; i++) {
    out.push(words[i]);
    if (i < words.length - 1) out.push(`${words[i]} ${words[i + 1]}`);
  }
  return [...new Set(out)];
}
function graph(works: Work[], theme: string) {
  const labels = new Map<
    string,
    {
      label: string;
      count: number;
      workIds: Set<string>;
      kind: "concept" | "field";
    }
  >();
  for (const w of works) {
    const terms = [
      ...phrases(w.title),
      ...w.fields.map(normalize).filter(Boolean),
    ];
    for (const term of new Set(terms)) {
      const v = labels.get(term) || {
        label: term,
        count: 0,
        workIds: new Set<string>(),
        kind: w.fields.map(normalize).includes(term)
          ? ("field" as const)
          : ("concept" as const),
      };
      v.count++;
      v.workIds.add(w.id);
      labels.set(term, v);
    }
  }
  const chosen = [...labels.entries()]
    .filter(([k, v]) => v.count >= 2 && k.length < 55)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 32);
  const concepts: any[] = [
    {
      id: "coordinate:theme",
      label: theme,
      count: works.length,
      workIds: works.slice(0, 30).map((w) => w.id),
      kind: "central",
    },
  ];
  for (const [id, v] of chosen)
    concepts.push({
      id,
      label: v.label,
      count: v.count,
      workIds: [...v.workIds],
      kind: v.kind,
    });
  const links: any[] = [];
  for (const c of concepts.slice(1, 12))
    links.push({
      source: "coordinate:theme",
      target: c.id,
      weight: Math.max(1, Math.round(c.count / 4)),
    });
  for (let i = 1; i < concepts.length; i++)
    for (let j = i + 1; j < concepts.length; j++) {
      const a = new Set(concepts[i].workIds);
      const co = concepts[j].workIds.filter((id: string) => a.has(id)).length;
      if (co >= 2)
        links.push({
          source: concepts[i].id,
          target: concepts[j].id,
          weight: co,
        });
    }
  return {
    concepts,
    links: links.sort((a, b) => b.weight - a.weight).slice(0, 140),
  };
}

async function handleGet(request: NextRequest) {
  const theme = request.nextUrl.searchParams.get("theme")?.trim(),
    subject = request.nextUrl.searchParams.get("subject")?.trim(),
    discipline = request.nextUrl.searchParams.get("discipline")?.trim();
  if (!theme || !subject || !discipline)
    return NextResponse.json(
      { error: "Informe as três coordenadas." },
      { status: 400 },
    );
  const query = `${theme} ${subject} ${discipline}`.slice(0, 280);
  const providers: Provider[] = [
    { name: "Semantic Scholar", limit: process.env.SEMANTIC_SCHOLAR_API_KEY ? 100 : 60, search: semanticScholar },
    { name: "Crossref", limit: 120, search: (q) => crossrefSearch(q) },
    { name: "OpenAlex", limit: 100, search: openAlex },
    { name: "SciELO", limit: 80, search: (q) => crossrefSearch(q, true) },
    { name: "OpenAIRE", limit: 100, search: openAire },
    { name: "Europe PMC / PubMed", limit: 100, search: europePmc },
    { name: "arXiv", limit: 80, search: arxiv },
    { name: "CORE", limit: 100, search: core },
  ];
  const results = await Promise.allSettled(
    providers.map((p) => p.search(query)),
  );
  const warnings: string[] = [],
    groups: Work[][] = [],
    counts: Record<string, number> = {},
    providerStatus: Record<string, {
      count: number;
      state: "recovered" | "empty" | "rate_limited" | "not_configured" | "unavailable";
      limit: number;
      capped: boolean;
      detail?: string;
    }> = {};
  results.forEach((r, i) => {
    counts[providers[i].name] = r.status === "fulfilled" ? r.value.length : 0;
    if (r.status === "fulfilled") groups.push(r.value);
    else
      warnings.push(
        `${providers[i].name} indisponível nesta consulta: ${r.reason?.message || "erro externo"}`,
      );
  });
  results.forEach((result, index) => {
    const provider = providers[index];
    const count = result.status === "fulfilled" ? result.value.length : 0;
    if (result.status === "fulfilled") {
      providerStatus[provider.name] = {
        count,
        state: count ? "recovered" : "empty",
        limit: provider.limit,
        capped: count >= provider.limit,
      };
      return;
    }
    const detail = result.reason?.message || "erro externo";
    providerStatus[provider.name] = {
      count: 0,
      state: /429|rate limit/i.test(detail)
        ? "rate_limited"
        : /API_KEY|chave|configur/i.test(detail)
          ? "not_configured"
          : "unavailable",
      limit: provider.limit,
      capped: false,
      detail,
    };
  });
  const works = dedupe(groups).slice(0, 500);
  if (works.length < 20)
    return NextResponse.json(
      {
        error:
          "As bases retornaram poucos documentos para esse recorte. Tente termos mais amplos ou em inglês.",
        warnings,
      },
      { status: 502 },
    );
  const { concepts, links } = graph(works, theme);
  return NextResponse.json(
    {
      coordinates: { theme, subject, discipline },
      query,
      works: works.map(({ fields, abstract, ...w }) => w),
      concepts,
      links,
      provenance: {
        semanticScholar: counts["Semantic Scholar"] || 0,
        crossref: counts.Crossref || 0,
        providers: counts,
        providerStatus,
        generatedAt: new Date().toISOString(),
        warnings,
      },
    },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}

export async function GET(request: NextRequest) {
  try {
    return await handleGet(request);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Falha ao construir o atlas:", error);
    return NextResponse.json(
      { error: "Falha interna ao processar a consulta.", detail },
      { status: 500 },
    );
  }
}
