export type RisWork = {
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

export type RisExport = {
  works: RisWork[];
  query: string;
  coordinates: { theme: string; subject: string; discipline: string };
  generatedAt: string;
};

const oneLine = (value: string | null | undefined) =>
  (value || "").replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();

const risLine = (tag: string, value: string | null | undefined) => {
  const content = oneLine(value);
  return content ? `${tag}  - ${content}\r\n` : "";
};

const safeFilename = (value: string) =>
  oneLine(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56) || "atlas";

/** Gera RIS legível por gerenciadores bibliográficos, sem inventar metadados. */
export function createRisExport({ works, query, coordinates, generatedAt }: RisExport) {
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

export function downloadRisExport(input: RisExport) {
  const content = createRisExport(input);
  const blob = new Blob([content], { type: "application/x-research-info-systems" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `reticula-${safeFilename(input.coordinates.theme)}-${input.works.length}-registros.ris`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
