"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { downloadBibtexExport, downloadCsvExport, downloadRisExport, type BibliographicFormat } from "./ris";

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
});
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
};
type Concept = {
  id: string;
  label: string;
  count: number;
  workIds: string[];
  kind: "central" | "concept" | "field";
};
type Atlas = {
  coordinates: { theme: string; subject: string; discipline: string };
  query: string;
  semanticPlan?: {
    intent: string;
    inclusionTerms: string[];
    exclusionTerms: string[];
    queries: Record<string, string>;
    rationale: string;
    source: "openai" | "deterministic";
  };
  works: Work[];
  concepts: Concept[];
  links: { source: string; target: string; weight: number }[];
  provenance: {
    semanticScholar: number;
    crossref: number;
    providers: Record<string, number>;
    providerStatus?: Record<string, {
      count: number;
      state: "recovered" | "empty" | "rate_limited" | "not_configured" | "not_applicable" | "catalog_only" | "aggregated" | "unavailable";
      limit: number;
      capped: boolean;
      detail?: string;
    }>;
    generatedAt: string;
    warnings: string[];
  };
};
type Tab =
  | "rede"
  | "linha"
  | "conceitos"
  | "autores"
  | "fontes"
  | "relacoes"
  | "metodo";
type GraphScope = "completa" | "conceitos" | "autores";
type AuthorPhoto = { image: string; page: string; description: string };

const RETICULA_SERVICES = [
  "OpenAI · análise semântica",
  "Semantic Scholar",
  "Crossref",
  "OpenAlex",
  "SciELO",
  "OpenAIRE",
  "Europe PMC / PubMed",
  "arXiv",
  "CORE",
  "Oasisbr / IBICT",
  "BDTD / IBICT",
  "DOAJ",
  "CAPES Dados Abertos",
  "ERIC",
  "DataCite",
  "LA Referencia",
  "Repositórios BR · OAI-PMH",
] as const;

const contextValue = (value: string | null | undefined, maximum = 240) =>
  (value ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);

async function readJsonResponse(response: Response, operation: string) {
  const payload = await response.text();
  if (!payload.trim()) {
    const status = response.status ? ` (HTTP ${response.status})` : "";
    throw new Error(
      `O serviço não retornou dados ao ${operation}${status}. Tente novamente em instantes.`,
    );
  }
  try {
    return JSON.parse(payload);
  } catch {
    throw new Error(
      `O serviço retornou uma resposta inválida ao ${operation}. Tente novamente em instantes.`,
    );
  }
}

const clean = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function connectedCore(nodes: any[], links: any[], preferred?: string) {
  const endpoint = (v: any) => String(typeof v === "object" && v ? v.id : v);
  const ids = new Set(nodes.map((n) => n.id));
  const valid = links
    .map((l) => ({
      ...l,
      source: endpoint(l.source),
      target: endpoint(l.target),
    }))
    .filter((l) => ids.has(l.source) && ids.has(l.target));
  const adj = new Map<string, Set<string>>();
  for (const l of valid) {
    const a = String(l.source),
      b = String(l.target);
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  }
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const id of ids) {
    if (seen.has(id) || !adj.has(id)) continue;
    const part: string[] = [];
    const stack = [id];
    seen.add(id);
    while (stack.length) {
      const at = stack.pop()!;
      part.push(at);
      for (const next of adj.get(at) || []) {
        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
    components.push(part);
  }
  const chosen =
    (preferred && components.find((c) => c.includes(preferred))) ||
    components.sort((a, b) => b.length - a.length)[0] ||
    [];
  const keep = new Set(chosen);
  return {
    nodes: nodes.filter((n) => keep.has(n.id)),
    links: valid.filter(
      (l) => keep.has(String(l.source)) && keep.has(String(l.target)),
    ),
  };
}

function proposeCoordinates(brief: string) {
  const text = clean(brief);
  let theme = "",
    subject = "",
    discipline = "";
  const words = new Set(text.split(/\s+/));
  const mentionsRemoteSensing =
    words.has("sar") || text.includes("radar") || text.includes("satelite");
  const core = brief
    .replace(
      /^\s*(eu\s+)?(quero|gostaria de|pretendo)\s+(pesquisar|investigar|estudar|analisar)\s+(sobre\s+)?/i,
      "",
    )
    .split(/\b(isso|essa área|este tema)\s+(é|faz parte)/i)[0]
    .replace(/[.;]+\s*$/, "")
    .trim();
  const object = core.match(
    /\b(?:para|visando|a fim de)\s+(?:identificar|detectar|classificar|analisar|avaliar|investigar|estudar|predizer|prever|mapear|compreender)\s+(?:o |a |os |as )?(.+?)(?:\s+(?:em|por meio de|usando|com)\s+|$)/i,
  )?.[1];
  const about = core.match(/\b(?:sobre|acerca de)\s+(.+)/i)?.[1];
  if (/onda(s)? interna(s)?/.test(text)) {
    theme = "Ocean internal waves";
    discipline = "Physical Oceanography";
    subject = mentionsRemoteSensing
      ? "Detection and classification of internal waves in SAR imagery using deep neural networks"
      : "Detection and classification of internal waves using neural networks and machine learning";
  } else {
    theme = (
      object ||
      about ||
      core
        .split(
          /\b(?:usando|utilizando|por meio de|com aplicação de|para)\b|[,.;]/i,
        )
        .pop() ||
      core
    ).trim();
    theme = theme.split(/\s+/).slice(0, 10).join(" ");
    subject = core || `Investigação de ${theme}`;
    if (/educa|pedagog|aprendiz/.test(text)) discipline = "Education";
    else if (/saude|medic|clin|enferm/.test(text))
      discipline = "Health Sciences";
    else if (/oceano|marinh|oceanograf/.test(text))
      discipline = "Physical Oceanography";
    else if (
      /rede(s)? neural|machine learning|aprendizado de maquina|inteligencia artificial/.test(
        text,
      )
    )
      discipline = "Computer Science";
    else discipline = "Interdisciplinary Studies";
  }
  if (clean(theme) === clean(subject))
    subject = `Methods, evidence and applications related to ${theme}`;
  return {
    theme: theme || "Research topic",
    subject: subject || `Methods and evidence related to ${theme}`,
    discipline,
  };
}

function AuthorRow({
  author,
  index,
  photo,
  onSelect,
}: {
  author: { name: string; count: number };
  index: number;
  photo?: AuthorPhoto;
  onSelect: () => void;
}) {
  const initials = author.name
    .split(/\s+/)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  return (
    <article>
      <button className="author-main" onClick={onSelect}>
        <span className="author-avatar">
          {photo ? (
            <img src={photo.image} alt={`Retrato de ${author.name}`} />
          ) : (
            initials
          )}
        </span>
        <span className="author-number">
          {String(index + 1).padStart(3, "0")}
        </span>
        <strong>{author.name}</strong>
        <small>{author.count} obra(s) →</small>
      </button>
      {photo && (
        <a
          className="photo-credit"
          href={photo.page}
          target="_blank"
          rel="noreferrer"
          title={photo.description}
        >
          foto: Wikipedia ↗
        </a>
      )}
    </article>
  );
}

export default function Home() {
  const [showCover, setShowCover] = useState(true);
  const [theme, setTheme] = useState("");
  const [subject, setSubject] = useState("");
  const [discipline, setDiscipline] = useState("");
  const [atlas, setAtlas] = useState<Atlas | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("rede");
  const [scope, setScope] = useState<GraphScope>("completa");
  const [loading, setLoading] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState("");
  const [brief, setBrief] = useState("");
  const [suggestion, setSuggestion] = useState<{
    theme: string;
    subject: string;
    discipline: string;
  } | null>(null);
  const [authorPhotos, setAuthorPhotos] = useState<Record<string, AuthorPhoto>>(
    {},
  );
  const graphRef = useRef<any>(null);
  const graphHostRef = useRef<HTMLDivElement>(null);
  const [graphSize, setGraphSize] = useState({ width: 1, height: 1 });
  const handledIncomingContext = useRef(false);

  useEffect(() => {
    if (handledIncomingContext.current || typeof window === "undefined") return;
    handledIncomingContext.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") !== "academiaos") return;
    const incomingTheme = contextValue(params.get("theme"));
    const incomingSubject = contextValue(params.get("subject"));
    const incomingDiscipline = contextValue(params.get("discipline"));
    if (!incomingTheme && !incomingSubject && !incomingDiscipline) return;
    setTheme(incomingTheme);
    setSubject(incomingSubject);
    setDiscipline(incomingDiscipline);
    setShowCover(false);
    setExportNotice("Coordenadas recebidas do AcademiaOS. Revise-as e inicie a busca somente quando estiver pronto.");
  }, []);

  const conceptMap = useMemo(
    () => new Map(atlas?.concepts.map((c) => [c.id, c]) || []),
    [atlas],
  );
  const authors = useMemo(() => {
    if (!atlas) return [];
    const m = new Map<
      string,
      { name: string; workIds: Set<string> }
    >();
    atlas.works.forEach((w) =>
      [...new Set(w.authors)].forEach((name) => {
        const a = m.get(name) || { name, workIds: new Set<string>() };
        a.workIds.add(w.id);
        m.set(name, a);
      }),
    );
    return [...m.values()].map((a) => ({
      name: a.name,
      count: a.workIds.size,
      workIds: [...a.workIds],
    })).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [atlas]);
  useEffect(() => {
    if (!authors.length) return;
    const names = authors.slice(0, 36).map((a) => a.name);
    fetch(
      `/api/author-photos?names=${encodeURIComponent(JSON.stringify(names))}`,
    )
      .then((r) => (r.ok ? r.json() : {}))
      .then(setAuthorPhotos)
      .catch(() => setAuthorPhotos({}));
  }, [authors]);
  const authorNodes = useMemo(
    () =>
      authors
        .slice(0, 35)
        .map((a) => ({
          id: `author:${a.name}`,
          label: a.name,
          count: a.count,
          workIds: a.workIds,
          kind: "author",
          val: Math.max(2.5, Math.sqrt(a.count) * 2),
        })),
    [authors],
  );
  const authorLinks = useMemo(() => {
    if (!atlas) return [];
    const out: { source: string; target: string; weight: number }[] = [];
    for (const a of authors.slice(0, 35)) {
      const ids = new Set(a.workIds);
      for (const c of atlas.concepts.slice(1)) {
        const n = c.workIds.filter((id) => ids.has(id)).length;
        if (n)
          out.push({ source: `author:${a.name}`, target: c.id, weight: n });
      }
    }
    return out.sort((a, b) => b.weight - a.weight).slice(0, 120);
  }, [atlas, authors]);
  const coauthorLinks = useMemo(() => {
    if (!atlas) return [];
    const allowed = new Set(authors.slice(0, 35).map((a) => a.name));
    const weights = new Map<string, number>();
    for (const w of atlas.works) {
      const names = w.authors.filter((a) => allowed.has(a)).slice(0, 8);
      for (let i = 0; i < names.length; i++)
        for (let j = i + 1; j < names.length; j++) {
          const pair = [names[i], names[j]].sort();
          const key = `${pair[0]}|||${pair[1]}`;
          weights.set(key, (weights.get(key) || 0) + 1);
        }
    }
    return [...weights.entries()]
      .map(([key, weight]) => {
        const [a, b] = key.split("|||");
        return { source: `author:${a}`, target: `author:${b}`, weight };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 100);
  }, [atlas, authors]);
  const selectedConcept = selected
    ? conceptMap.get(selected)
    : atlas?.concepts[0];
  const selectedAuthor = selected?.startsWith("author:")
    ? authors.find((a) => `author:${a.name}` === selected)
    : null;
  const selectedIds = new Set(
    selectedAuthor?.workIds || selectedConcept?.workIds || [],
  );
  const supportingWorks =
    atlas?.works.filter((w) => selectedIds.has(w.id)) || [];
  const filteredWorks = useMemo(
    () =>
      atlas?.works.filter((w) =>
        clean(`${w.title} ${w.authors.join(" ")} ${w.venue}`).includes(
          clean(query),
        ),
      ) || [],
    [atlas, query],
  );
  const filteredConcepts = useMemo(
    () =>
      atlas?.concepts.filter((c) => clean(c.label).includes(clean(query))) ||
      [],
    [atlas, query],
  );
  const filteredAuthors = useMemo(
    () => authors.filter((a) => clean(a.name).includes(clean(query))),
    [authors, query],
  );
  const relationRows = useMemo(
    () =>
      atlas?.links
        .map((l) => ({
          a: conceptMap.get(String(l.source))?.label || String(l.source),
          b: conceptMap.get(String(l.target))?.label || String(l.target),
          weight: l.weight,
        }))
        .sort((a, b) => b.weight - a.weight) || [],
    [atlas, conceptMap],
  );
  const graphData = useMemo(() => {
    if (!atlas) return { nodes: [], links: [] };
    const concepts = atlas.concepts.map((c) => ({
      ...c,
      val: Math.max(3, Math.sqrt(c.count) * 2.1),
    }));
    if (scope === "conceitos")
      return connectedCore(concepts, atlas.links, "coordinate:theme");
    if (scope === "autores") return connectedCore(authorNodes, coauthorLinks);
    return connectedCore(
      [...concepts, ...authorNodes],
      [...atlas.links, ...authorLinks, ...coauthorLinks],
      "coordinate:theme",
    );
  }, [atlas, scope, authorNodes, authorLinks, coauthorLinks]);
  const centerGraph = () => {
    requestAnimationFrame(() => graphRef.current?.zoomToFit?.(700, 70));
  };
  useEffect(() => {
    if (!atlas || tab !== "rede") return;
    const host = graphHostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      const rect = host.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const width = Math.round(rect.width), height = Math.round(rect.height);
        setGraphSize((current) =>
          current.width === width && current.height === height
            ? current
            : { width, height },
        );
      }
    });
    observer.observe(host);
    const rect = host.getBoundingClientRect();
    setGraphSize({
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height)),
    });
    return () => observer.disconnect();
  }, [atlas, tab]);
  useEffect(() => {
    const timer = setTimeout(centerGraph, 900);
    return () => clearTimeout(timer);
  }, [graphData, graphSize]);

  async function generate() {
    if (!theme.trim() || !subject.trim() || !discipline.trim()) return;
    setLoading(true);
    setError("");
    setAtlas(null);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 75_000);
    try {
      const p = new URLSearchParams({ theme, subject, discipline });
      const r = await fetch(`/api/atlas?${p}`, { signal: controller.signal });
      const d = await readJsonResponse(r, "construir o atlas");
      if (!r.ok)
        throw new Error(d.error || "A pesquisa não pôde ser concluída.");
      setAtlas(d);
      setSelected(d.concepts[0]?.id || null);
      setTab("rede");
    } catch (e) {
      setError(
        e instanceof Error && e.name === "AbortError"
          ? "A consulta excedeu 75 segundos. Tente novamente; uma das bases pode estar temporariamente lenta."
          : e instanceof Error
            ? e.message
            : "Erro inesperado.",
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }
  async function translateCoordinates() {
    if (!theme.trim() || !subject.trim() || !discipline.trim()) return;
    setTranslating(true);
    setError("");
    try {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme, subject, discipline }),
      });
      const d = await readJsonResponse(r, "traduzir as coordenadas");
      if (!r.ok) throw new Error(d.error || "A tradução não pôde ser concluída.");
      setTheme(d.theme);
      setSubject(d.subject);
      setDiscipline(d.discipline);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao traduzir.");
    } finally {
      setTranslating(false);
    }
  }
  function applySuggestion() {
    if (!suggestion) return;
    setTheme(suggestion.theme);
    setSubject(suggestion.subject);
    setDiscipline(suggestion.discipline);
    setGuideOpen(false);
  }
  function chooseTab(next: Tab) {
    setTab(next);
    setQuery("");
  }
  function exportBibliography(format: BibliographicFormat) {
    if (!atlas || !filteredWorks.length) return;
    const generatedAt = new Date().toISOString();
    const payload = {
      works: filteredWorks,
      query: atlas.query,
      coordinates: atlas.coordinates,
      generatedAt,
    };
    if (format === "bibtex") downloadBibtexExport(payload);
    else if (format === "csv") downloadCsvExport(payload);
    else downloadRisExport(payload);
    const labels: Record<BibliographicFormat, string> = { ris: "RIS", bibtex: "BibTeX", csv: "CSV" };
    setExportNotice(
      `Arquivo ${labels[format]} com ${filteredWorks.length} registro${filteredWorks.length === 1 ? "" : "s"} gerado. Consulta, coordenadas, fonte e data de exportação foram preservadas.`,
    );
  }

  function exportRis() { exportBibliography("ris"); }

  if (showCover) return (
    <main className="reticula-cover">
      <section className="cover-story">
        <div className="cover-institutions">
          <img src="/ifsc-continente-logo.png" alt="IFSC Câmpus Florianópolis-Continente" />
          <span />
          <img src="/inovalab-logo-v2.png" alt="INOVALAB — Rede de Inovação e Tecnologia" />
        </div>
        <div className="cover-headline">
          <p>ATLAS DE LITERATURA CIENTÍFICA</p>
          <h1>Ideias ganham<br/><i>forma.</i></h1>
          <h2>Relações ganham<br/>sentido.</h2>
          <p className="cover-description">Transforme um tema de pesquisa em uma rede viva de conceitos, autores e evidências científicas verificáveis.</p>
        </div>
        <div className="cover-credits">
          <p>DESENVOLVIDO POR</p>
          <a className="cover-developer" href="https://github.com/rgbittencourt" target="_blank" rel="noreferrer">
            Prof. Rogério G. Bittencourt
          </a>
          <a className="cover-lab" href="mailto:inovalab.cte@ifsc.edu.br">
            <img src="/inovalab-logo-v2.png" alt="" />
            <span><strong>INOVALAB</strong><small>Laboratório de Inovação e Mídias Digitais</small></span>
          </a>
        </div>
      </section>

      <section className="cover-entry">
        <div className="cover-entry-wrap">
          <div className="cover-app-icon" aria-hidden="true">
            <img src="/favicon.png" alt="" />
          </div>
          <p className="cover-entry-kicker">RETÍCULA</p>
          <h2>Encontre o caminho<br/>entre as ideias.</h2>
          <p className="cover-entry-copy">Informe tema, assunto e disciplina. O Retícula pesquisa bases acadêmicas, reúne as fontes e constrói seu atlas 3D.</p>
          <button className="cover-start" onClick={() => setShowCover(false)}>
            <span className="cover-start-symbol">◎</span>
            <strong>Começar uma pesquisa</strong>
            <span>→</span>
          </button>
          <p className="cover-open-note">Acesso aberto · sem cadastro · sem login</p>
          <div className="cover-divider" />
          <h3>O que você encontrará</h3>
          <div className="cover-benefits">
            <div><span>3D</span><p><strong>Mapa interativo</strong><small>Conceitos e autores conectados visualmente</small></p></div>
            <div><span>08</span><p><strong>Pesquisa multibase</strong><small>Oito serviços acadêmicos consultados em paralelo</small></p></div>
            <div><span>DOI</span><p><strong>Evidência rastreável</strong><small>Referências e links preservados para conferência</small></p></div>
          </div>
        </div>
        <p className="cover-entry-foot">Plataforma experimental do INOVALAB · IFSC</p>
      </section>
    </main>
  );

  return (
    <main className={atlas ? "atlas-app" : ""}>
      <header className="topbar">
        <button className="brand" onClick={() => { setAtlas(null); setShowCover(true); }} aria-describedby="name-explanation">
          <img className="mark" src="/favicon.png" alt="" aria-hidden="true" />
          <span>
            <b>Retícula</b>
            <small>atlas de literatura científica</small>
          </span>
          <span className="name-tooltip" id="name-explanation" role="tooltip">
            <b>Retícula</b> representa a estrutura de pontos e ligações entre documentos, conceitos e autores. <b>Atlas de Literatura Científica</b> indica um instrumento para explorar e orientar-se nesse território do conhecimento.
          </span>
        </button>
        {atlas && (
          <nav>
            {(
              [
                ["rede", "Rede 3D"],
                ["linha", "Linha do tempo"],
                ["conceitos", "Conceitos"],
                ["autores", "Autores"],
                ["fontes", "Fontes"],
              ] as [Tab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                className={tab === id ? "active" : ""}
                onClick={() => chooseTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <span className="verified">FONTES VERIFICÁVEIS</span>
      </header>

      {!atlas ? (
        <section className="setup">
          <div className="setup-copy">
            <span className="eyebrow">PESQUISA ACADÊMICA + MAPA 3D</span>
            <h1>
              Que território do
              <br />
              conhecimento você
              <br />
              <i>quer investigar?</i>
            </h1>
            <p>
              Defina três coordenadas ou use o orientador <span className="inline-spark" aria-hidden="true">(✦)</span>{` `}
              para transformar uma ideia inicial em um recorte acadêmico
              pesquisável.
            </p>
            <div className="source-badges" aria-label="Serviços e bases utilizados pelo Retícula">
              {RETICULA_SERVICES.map((source) => (
                <span key={source}>{source}</span>
              ))}
            </div>
          </div>
          <div className="composer">
            <div className="card-head">
              <span>COORDENADAS DA PESQUISA</span>
              <button
                className="spark"
                onClick={() => setGuideOpen(true)}
                aria-label="Abrir orientador das três coordenadas"
                title="Ajude-me a definir as coordenadas"
              >
                ✦
              </button>
            </div>
            <label>
              <span>1</span>
              <div>
                Tema central<small>A ideia principal da investigação</small>
              </div>
            </label>
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Ex.: Ocean internal waves"
            />
            <label>
              <span>2</span>
              <div>
                Assunto<small>O problema ou recorte específico</small>
              </div>
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex.: Detection using neural networks"
            />
            <label>
              <span>3</span>
              <div>
                Disciplina<small>O campo que orienta a busca</small>
              </div>
            </label>
            <input
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value)}
              placeholder="Ex.: Physical Oceanography"
            />
            <button
              className="translate-coordinates"
              onClick={translateCoordinates}
              disabled={translating || !theme || !subject || !discipline}
            >
              {translating ? "Traduzindo…" : "Traduzir coordenadas para inglês · EN"}
            </button>
            <button
              className="generate"
              onClick={generate}
              disabled={loading || !theme || !subject || !discipline}
            >
              {loading
                ? "Pesquisando bases acadêmicas…"
                : "Construir atlas verificável →"}
            </button>
            {loading && (
              <div className="progress">
                <i />
                <p>Consultando, deduplicando e relacionando documentos. A busca ampliada pode levar até 75 segundos.</p>
              </div>
            )}
            {error && <p className="error">{error}</p>}
          </div>
        </section>
      ) : (
        <section className="atlas">
          <div className="atlas-head">
            <div>
              <span className="eyebrow">
                {atlas.coordinates.discipline.toUpperCase()}
              </span>
              <h1>{atlas.coordinates.theme}</h1>
              <p>{atlas.coordinates.subject}</p>
            </div>
            <div className="counts">
              <button onClick={() => chooseTab("fontes")}>
                <b>{atlas.works.length}</b>documentos
              </button>
              <button onClick={() => chooseTab("conceitos")}>
                <b>{atlas.concepts.length}</b>conceitos
              </button>
              <button onClick={() => chooseTab("relacoes")}>
                <b>{atlas.links.length + authorLinks.length}</b>relações
              </button>
            </div>
          </div>
          <div className="atlas-tools">
            <div className="search">
              <span>⌕</span>
              <input
                aria-label="Buscar no atlas"
                placeholder="Buscar conceito, autor, obra ou tema"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <span>
              {atlas.concepts.length} conceitos · {authors.length} autores ·{" "}
              {atlas.works.length} obras
            </span>
            <button
              className="atlas-action"
              onClick={exportRis}
              disabled={!filteredWorks.length}
              title="Exportar os registros atualmente filtrados em RIS"
            >
              Exportar RIS ({filteredWorks.length}) ↓
            </button>
            <button className="atlas-action" onClick={() => exportBibliography("bibtex")} disabled={!filteredWorks.length} title="Exportar os registros atualmente filtrados em BibTeX">
              Exportar BibTeX ({filteredWorks.length}) ↓
            </button>
            <button className="atlas-action" onClick={() => exportBibliography("csv")} disabled={!filteredWorks.length} title="Exportar os registros atualmente filtrados em CSV auditável">
              Exportar CSV ({filteredWorks.length}) ↓
            </button>
            <button onClick={() => chooseTab("metodo")}>
              Método e proveniência
            </button>
          </div>
          <p className="export-notice" aria-live="polite">{exportNotice}</p>
          {tab === "rede" && (
            <div className="workspace">
              <div className="graph3d" ref={graphHostRef}>
                <div className="graph-note">
                  <b>
                    REDE TRIDIMENSIONAL · {graphData.nodes.length} NÓS
                    CONECTADOS
                  </b>
                  <span>
                    Arraste para girar · roda para zoom · clique em um nó
                  </span>
                </div>
                <div className="scope-controls" aria-label="Conteúdo do grafo">
                  {(
                    [
                      ["completa", "Rede completa"],
                      ["conceitos", "Conceitos"],
                      ["autores", "Autores"],
                    ] as [GraphScope, string][]
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      className={scope === id ? "active" : ""}
                      onClick={() => setScope(id)}
                    >
                      {label}
                    </button>
                  ))}
                  <button
                    className="center-map"
                    onClick={centerGraph}
                    aria-label="Centralizar mapa"
                  >
                    ◎ Centralizar
                  </button>
                </div>
                <ForceGraph3D
                  ref={graphRef}
                  width={graphSize.width}
                  height={graphSize.height}
                  graphData={graphData}
                  backgroundColor="#07110f"
                  showNavInfo={false}
                  warmupTicks={80}
                  cooldownTicks={160}
                  nodeLabel={(n: any) => `${n.label} · ${n.count} documento(s)`}
                  nodeVal="val"
                  nodeColor={(n: any) =>
                    n.kind === "central"
                      ? "#ffcf4a"
                      : n.kind === "author"
                        ? "#eb775d"
                        : n.kind === "field"
                          ? "#68d5c2"
                          : "#f2eee3"
                  }
                  linkColor={(l: any) =>
                    String(l.source?.id || l.source).startsWith("author:")
                      ? "rgba(235,119,93,.34)"
                      : "rgba(104,213,194,.36)"
                  }
                  linkWidth={(l: any) => Math.min(3, 0.45 + l.weight / 3)}
                  linkOpacity={0.78}
                  onEngineStop={centerGraph}
                  onNodeClick={(n: any) => setSelected(n.id)}
                  nodeThreeObject={(n: any) => {
                    const g = new THREE.Group();
                    const geo = new THREE.SphereGeometry(
                      Math.max(2, Math.sqrt(n.count) * 0.65),
                      18,
                      18,
                    );
                    const color =
                      n.kind === "central"
                        ? 0xffcf4a
                        : n.kind === "author"
                          ? 0xeb775d
                          : n.kind === "field"
                            ? 0x68d5c2
                            : 0xf2eee3;
                    g.add(
                      new THREE.Mesh(
                        geo,
                        new THREE.MeshLambertMaterial({ color }),
                      ),
                    );
                    return g;
                  }}
                />
              </div>
              <aside className="detail">
                <span className="detail-type">
                  {selectedAuthor ? "AUTOR DO CORPUS" : "CONCEITO DOCUMENTADO"}
                </span>
                <h2>{selectedAuthor?.name || selectedConcept?.label}</h2>
                <p>
                  Associado a{" "}
                  <b>{selectedAuthor?.count || selectedConcept?.count}</b>{" "}
                  documentos do corpus.
                </p>
                <div className="rule" />
                <h3>Evidências associadas</h3>
                {supportingWorks.map((w) => (
                  <a key={w.id} href={w.url} target="_blank" rel="noreferrer">
                    <span>{w.year ?? "s.d."}</span>
                    {w.title}
                    <small>{w.authors.slice(0, 2).join(", ")}</small>
                  </a>
                ))}
              </aside>
            </div>
          )}
          {tab === "linha" && (
            <div className="view-scroll timeline-view">
              <div className="section-title">
                <span className="eyebrow">CRONOLOGIA DO CORPUS</span>
                <h2>Como a literatura evoluiu.</h2>
              </div>
              <div className="timeline-list">
                {[...filteredWorks]
                  .filter((w) => w.year)
                  .sort((a, b) => (a.year || 0) - (b.year || 0))
                  .map((w) => (
                    <a href={w.url} target="_blank" rel="noreferrer" key={w.id}>
                      <b>{w.year}</b>
                      <span>
                        <strong>{w.title}</strong>
                        <small>{w.authors.slice(0, 3).join(", ")}</small>
                      </span>
                    </a>
                  ))}
              </div>
            </div>
          )}
          {tab === "conceitos" && (
            <div className="view-scroll cards-view">
              <div className="section-title">
                <span className="eyebrow">VOCABULÁRIO DOCUMENTADO</span>
                <h2>{filteredConcepts.length} conceitos.</h2>
              </div>
              <div className="concept-grid">
                {filteredConcepts.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelected(c.id);
                      setTab("rede");
                    }}
                  >
                    <small>
                      {c.kind === "field"
                        ? "CAMPO DE ESTUDO"
                        : c.kind === "central"
                          ? "COORDENADA SEMÂNTICA"
                        : "TERMO RECORRENTE"}
                    </small>
                    <h3>{c.label}</h3>
                    <span>{c.count} documentos →</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {tab === "autores" && (
            <div className="view-scroll cards-view">
              <div className="section-title">
                <span className="eyebrow">PESSOAS NO CORPUS</span>
                <h2>{filteredAuthors.length} autores.</h2>
                <p>
                  Retratos aparecem somente quando há correspondência acadêmica
                  confiável na Wikipedia.
                </p>
              </div>
              <div className="author-list">
                {filteredAuthors.map((a, i) => (
                  <AuthorRow
                    key={a.name}
                    author={a}
                    index={i}
                    photo={authorPhotos[a.name]}
                    onSelect={() => {
                      setSelected(`author:${a.name}`);
                      setScope("completa");
                      setTab("rede");
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          {tab === "fontes" && (
            <div className="view-scroll references">
              <div className="section-intro">
                <span className="eyebrow">CORPUS DOCUMENTAL</span>
                <h2>
                  {filteredWorks.length} registros reais,
                  <br />
                  cada um rastreável.
                </h2>
                <p>DOI e página original preservados para conferência.</p>
                <div className="export-inline-actions">
                  <button className="export-format export-ris-inline" onClick={exportRis} disabled={!filteredWorks.length}>Exportar RIS ({filteredWorks.length}) ↓</button>
                  <button className="export-format export-ris-inline" onClick={() => exportBibliography("bibtex")} disabled={!filteredWorks.length}>Exportar BibTeX ({filteredWorks.length}) ↓</button>
                  <button className="export-format export-ris-inline" onClick={() => exportBibliography("csv")} disabled={!filteredWorks.length}>Exportar CSV ({filteredWorks.length}) ↓</button>
                </div>
              </div>
              <ol>
                {filteredWorks.map((w, i) => (
                  <li key={w.id}>
                    <span>{String(i + 1).padStart(3, "0")}</span>
                    <div>
                      <h3>{w.title}</h3>
                      <p>
                        {w.authors.slice(0, 5).join(", ")}{" "}
                        {w.year ? `· ${w.year}` : ""}{" "}
                        {w.venue ? `· ${w.venue}` : ""}
                      </p>
                      <small>
                        {w.source} · {w.citations} citações{" "}
                        {w.doi ? `· DOI ${w.doi}` : ""}
                      </small>
                    </div>
                    <a href={w.url} target="_blank" rel="noreferrer">
                      Abrir ↗
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {tab === "relacoes" && (
            <div className="view-scroll relations-view">
              <div className="section-title">
                <span className="eyebrow">LIGAÇÕES DOCUMENTAIS</span>
                <h2>{relationRows.length} relações conceituais.</h2>
                <p>
                  Duas ideias são ligadas quando aparecem nos mesmos documentos.
                </p>
              </div>
              <div className="relation-list">
                {relationRows.map((r, i) => (
                  <article key={`${r.a}-${r.b}-${i}`}>
                    <span>{String(i + 1).padStart(3, "0")}</span>
                    <strong>{r.a}</strong>
                    <i>coocorre com</i>
                    <strong>{r.b}</strong>
                    <b>{r.weight} documentos</b>
                  </article>
                ))}
              </div>
            </div>
          )}
          {tab === "metodo" && (
            <div className="view-scroll method">
              <span className="eyebrow">TRANSPARÊNCIA METODOLÓGICA</span>
              <h2>
                O que a Retícula fez —<br />e o que ela não afirma.
              </h2>
              <div className="method-grid">
                <article>
                  <b>01</b>
                  <h3>Recuperação multibase</h3>
                  <p>
                    Tema, assunto e disciplina são interpretados em papéis
                    distintos e geram consultas adequadas a cada serviço.
                  </p>
                </article>
                <article>
                  <b>02</b>
                  <h3>Deduplicação</h3>
                  <p>
                    Registros repetidos são unidos por DOI e título normalizado,
                    preservando as bases de origem.
                  </p>
                </article>
                <article>
                  <b>03</b>
                  <h3>Conceitos</h3>
                  <p>
                    Os nós são termos recorrentes em títulos e campos de estudo
                    dos registros recuperados.
                  </p>
                </article>
                <article>
                  <b>04</b>
                  <h3>Relações</h3>
                  <p>
                    Uma aresta existe quando dois conceitos aparecem nos mesmos
                    documentos. Nenhuma referência é inventada.
                  </p>
                </article>
              </div>
              {atlas.semanticPlan && (
                <div className="semantic-plan">
                  <div>
                    <span className="eyebrow">PLANO SEMÂNTICO</span>
                    <h3>{atlas.semanticPlan.intent}</h3>
                    <p>{atlas.semanticPlan.rationale}</p>
                    <small>
                      Planejador: {atlas.semanticPlan.source === "openai" ? "interpretação por IA" : "fallback determinístico"}
                    </small>
                  </div>
                  <div>
                    <h4>Vocabulário de inclusão</h4>
                    <p>{atlas.semanticPlan.inclusionTerms.join(" · ")}</p>
                    {atlas.semanticPlan.exclusionTerms.length > 0 && (
                      <><h4>Termos excluídos</h4><p>{atlas.semanticPlan.exclusionTerms.join(" · ")}</p></>
                    )}
                  </div>
                  <details>
                    <summary>Ver consultas enviadas às bases</summary>
                    {Object.entries(atlas.semanticPlan.queries).map(([provider, providerQuery]) => (
                      <p key={provider}><b>{provider}:</b> {providerQuery}</p>
                    ))}
                  </details>
                </div>
              )}
              <div className="provenance">
                <h3>Resultados brutos por serviço</h3>
                {Object.entries(atlas.provenance.providerStatus || {}).map(
                  ([name, status]) => {
                    const description = status.state === "recovered"
                      ? `${status.count} registros recuperados${status.capped ? ` (limite de ${status.limit} atingido)` : ""}`
                      : status.state === "empty"
                        ? "nenhum registro compatível nesta consulta"
                        : status.state === "rate_limited"
                          ? "limite temporário de requisições atingido"
                          : status.state === "not_configured"
                            ? "não configurado — requer chave de acesso"
                            : status.state === "not_applicable"
                              ? `não priorizado para este recorte${status.detail ? ` — ${status.detail}` : ""}`
                            : status.state === "catalog_only"
                              ? `catálogo integrado por atualização periódica${status.detail ? ` — ${status.detail}` : ""}`
                            : status.state === "aggregated"
                              ? `cobertura consolidada${status.detail ? ` — ${status.detail}` : ""}`
                            : "temporariamente indisponível";
                    return (
                      <p className={`provider-result provider-${status.state}`} key={name}>
                        <b>{name}:</b> {description}
                      </p>
                    );
                  },
                )}
                {!atlas.provenance.providerStatus && Object.entries(atlas.provenance.providers || {}).map(
                  ([name, count]) => <p key={name}><b>{name}:</b> {count} registros recuperados</p>,
                )}
                <p>
                  <small>
                    SciELO Brasil é recuperado pelo prefixo DOI 10.1590 no
                    Crossref. Europe PMC inclui registros PubMed. Oasisbr reúne
                    repositórios brasileiros via OAI-PMH. Depois da coleta, as
                    duplicatas são consolidadas.
                  </small>
                </p>
                {atlas.provenance.warnings.map((w) => (
                  <p className="warning" key={w}>
                    Aviso: {w}
                  </p>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {guideOpen && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setGuideOpen(false);
          }}
        >
          <section
            className="guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
          >
            <button className="modal-close" onClick={() => setGuideOpen(false)}>
              ×
            </button>
            <span className="eyebrow">ORIENTADOR DE PESQUISA</span>
            <h2 id="guide-title">
              Conte, do seu jeito,
              <br />o que deseja investigar.
            </h2>
            <p>
              Inclua o fenômeno, a técnica ou o problema e, se souber, a área
              científica. Você poderá editar a proposta.
            </p>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Ex.: Quero pesquisar o uso de redes neurais para identificar ondas internas. Isso é Oceanografia Física."
              autoFocus
            />
            <button
              className="guide-action"
              disabled={!brief.trim()}
              onClick={() => setSuggestion(proposeCoordinates(brief))}
            >
              Desenvolver as três coordenadas →
            </button>
            {suggestion && (
              <div className="proposal">
                <label>
                  <span>TEMA CENTRAL</span>
                  <input
                    value={suggestion.theme}
                    onChange={(e) =>
                      setSuggestion({ ...suggestion, theme: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>ASSUNTO</span>
                  <input
                    value={suggestion.subject}
                    onChange={(e) =>
                      setSuggestion({ ...suggestion, subject: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>DISCIPLINA</span>
                  <input
                    value={suggestion.discipline}
                    onChange={(e) =>
                      setSuggestion({
                        ...suggestion,
                        discipline: e.target.value,
                      })
                    }
                  />
                </label>
                <button onClick={applySuggestion}>
                  Usar estas coordenadas ✓
                </button>
              </div>
            )}
          </section>
        </div>
      )}
      <footer className="site-footer">
        <a
          className="inovalab-logo"
          href="mailto:inovalab.cte@ifsc.edu.br"
          aria-label="Enviar e-mail ao INOVALAB"
        >
          <img
            src="/inovalab-logo-v2.png"
            alt="INOVALAB — Rede de Inovação e Tecnologia"
          />
        </a>
        <div className="footer-copy">
          <p>
            Plataforma experimental: pode conter erros. Consulte sempre as
            fontes originais antes de utilizar ou citar as informações.
          </p>
          <p>
            A plataforma recupera e relaciona literatura científica, mas não
            avalia risco de viés, qualidade metodológica ou força da evidência.
          </p>
          <p>
            Desenvolvimento desta teia interativa:{" "}
            <strong>
              <a href="https://github.com/rgbittencourt" target="_blank" rel="noreferrer">
                Rogério G. Bittencourt
              </a>{" "}
              (
              <a
                href="mailto:inovalab.cte@ifsc.edu.br"
              >
                INOVALAB
              </a>{" "}
              - Onde as ideias se transformam em realidade
              )
            </strong>
            .
          </p>
        </div>
        <a
          className="ifsc-logo"
          href="https://www.ifsc.edu.br/web/campus-florianopolis-continente"
          target="_blank"
          rel="noreferrer"
          aria-label="Visitar a página do IFSC Câmpus Florianópolis-Continente"
        >
          <img
            src="/ifsc-continente-logo.png"
            alt="IFSC — Câmpus Florianópolis-Continente"
          />
        </a>
      </footer>
    </main>
  );
}
