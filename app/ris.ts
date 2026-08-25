export type BibliographicWork = {
  id: string;
  title: string;
  year: number | null;
  authors: string[];
  venue: string;
  doi: string | null;
  url: string;
  abstract: string | null;
  source: string;
};

export type BibliographicExport = {
  works: BibliographicWork[];
  query: string;
  coordinates: { theme: string; subject: string; discipline: string };
  generatedAt: string;
};

/** Compatibilidade com o contrato RIS originalmente publicado. */
export type RisWork = BibliographicWork;
export type RisExport = BibliographicExport;
export type BibliographicFormat = "ris" | "bibtex" | "csv";

const oneLine = (value: string | null | undefined) =>
  (value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

const risLine = (tag: string, value: string | null | undefined) => {
  const content = oneLine(value);
  return content ? `${tag}  - ${content}\r\n` : "";
};

const bibtexValue = (value: string | null | undefined) =>
  oneLine(value)
    .replace(/\\/g, "\\\\")
    .replace(/[{}]/g, "\\$&")
    .replace(/([%_&#])/g, "\\$1")
    .replace(/\^/g, "\\^{}")
    .replace(/~/g, "\\~{}");

const csvCell = (value: string | number | null | undefined) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const safeFilename = (value: string) =>
  oneLine(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56) || "atlas";

/** Gera RIS legível por gerenciadores bibliográficos, sem inventar metadados. */
export function createRisExport({ works, query, coordinates, generatedAt }: BibliographicExport) {
  const provenance = `Retícula — Atlas de Literatura Científica | consulta: ${query} | coordenadas: ${coordinates.theme} / ${coordinates.subject} / ${coordinates.discipline} | exportado em: ${generatedAt}`;
  return works
    .map((work) => {
      const lines = [
        "TY  - JOUR\r\n",
        risLine("TI", work.title),
        ...work.authors.map((author) => risLine("AU", author)),
        work.year ? risLine("PY", String(work.year)) : "",
        risLine("JO", work.venue),
        risLine("DO", work.doi),
        risLine("UR", work.url),
        risLine("AB", work.abstract),
        risLine("AN", work.id),
        risLine("N1", `Fonte de descoberta: ${work.source}`),
        risLine("N1", provenance),
        "ER  - \r\n",
      ];
      return lines.join("");
    })
    .join("\r\n");
}

/** Gera BibTeX com campos apenas quando o atlas os recuperou. */
export function createBibtexExport({ works, query, coordinates, generatedAt }: BibliographicExport) {
  const provenance = `Retícula — Atlas de Literatura Científica; consulta: ${query}; coordenadas: ${coordinates.theme} / ${coordinates.subject} / ${coordinates.discipline}; exportado em: ${generatedAt}`;
  return works.map((work, index) => {
    const key = `reticula_${(oneLine(work.id).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 72) || String(index + 1))}`;
    const fields = [
      ["title", work.title],
      ["author", work.authors.length ? work.authors.join(" and ") : ""],
      ["year", work.year ? String(work.year) : ""],
      ["journal", work.venue],
      ["doi", work.doi],
      ["url", work.url],
      ["abstract", work.abstract],
      ["note", `Fonte de descoberta: ${work.source}; ${provenance}`],
    ].filter(([, value]) => oneLine(value));
    return `@article{${key},\n${fields.map(([field, value]) => `  ${field} = {${bibtexValue(value)}},`).join("\n")}\n}`;
  }).join("\n\n");
}

/** Gera CSV RFC 4180 com BOM UTF-8 para facilitar abertura em planilhas. */
export function createCsvExport({ works, query, coordinates, generatedAt }: BibliographicExport) {
  const header = ["id", "title", "authors", "year", "venue", "doi", "url", "abstract", "source", "query", "theme", "subject", "discipline", "exportedAt"];
  const rows = works.map(work => [
    work.id,
    work.title,
    work.authors.join("; "),
    work.year,
    work.venue,
    work.doi,
    work.url,
    work.abstract,
    work.source,
    query,
    coordinates.theme,
    coordinates.subject,
    coordinates.discipline,
    generatedAt,
  ].map(csvCell).join(","));
  return `\uFEFF${header.map(csvCell).join(",")}\r\n${rows.join("\r\n")}\r\n`;
}

function exportContent(input: BibliographicExport, format: BibliographicFormat) {
  if (format === "bibtex") return { content: createBibtexExport(input), extension: "bib", type: "application/x-bibtex" };
  if (format === "csv") return { content: createCsvExport(input), extension: "csv", type: "text/csv;charset=utf-8" };
  return { content: createRisExport(input), extension: "ris", type: "application/x-research-info-systems" };
}

export function downloadBibliographicExport(input: BibliographicExport, format: BibliographicFormat) {
  const { content, extension, type } = exportContent(input, format);
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reticula-${safeFilename(input.coordinates.theme)}-${input.works.length}-registros.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function downloadRisExport(input: RisExport) {
  downloadBibliographicExport(input, "ris");
}

export function downloadBibtexExport(input: BibliographicExport) {
  downloadBibliographicExport(input, "bibtex");
}

export function downloadCsvExport(input: BibliographicExport) {
  downloadBibliographicExport(input, "csv");
}
