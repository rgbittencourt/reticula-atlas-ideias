import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function responseText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || [])
    for (const content of item?.content || [])
      if (content?.type === "output_text" && typeof content.text === "string") return content.text;
  return "";
}

async function translateWithOpenAI(theme: string, subject: string, discipline: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_SEMANTIC_MODEL || "gpt-5-mini",
      store: false,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: "Traduza para inglês científico três coordenadas de pesquisa. Preserve o papel de cada campo, siglas técnicas e o nível de especificidade. Não amplie, resuma ou invente conteúdo." }] },
        { role: "user", content: [{ type: "input_text", text: `Tema central: ${theme}\nAssunto: ${subject}\nDisciplina: ${discipline}` }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "translated_research_coordinates",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["theme", "subject", "discipline"],
            properties: {
              theme: { type: "string" },
              subject: { type: "string" },
              discipline: { type: "string" },
            },
          },
        },
      },
      max_output_tokens: 500,
    }),
  });
  if (!response.ok) throw new Error(`OpenAI respondeu ${response.status}`);
  return JSON.parse(responseText(await response.json()));
}

async function translate(text: string) {
  const value = text.slice(0, 450);
  const google = await fetch(
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=pt&tl=en&dt=t&q=${encodeURIComponent(value)}`,
    { headers: { "User-Agent": "Mozilla/5.0 ReticulaAtlas/2.0" } },
  );
  if (google.ok) {
    const data: any = await google.json();
    const translated = (data?.[0] || [])
      .map((part: any) => part?.[0] || "")
      .join("")
      .trim();
    if (translated) return translated;
  }
  const memory = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(value)}&langpair=pt|en`,
    { headers: { "User-Agent": "ReticulaAtlas/2.0 (academic translation)" } },
  );
  if (!memory.ok) throw new Error(`serviços responderam ${google.status} e ${memory.status}`);
  const data: any = await memory.json();
  const translated = data.responseData?.translatedText?.trim();
  if (!translated) throw new Error("os serviços não retornaram uma tradução");
  return translated;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const values = [body.theme, body.subject, body.discipline].map((value) =>
      String(value || "").trim(),
    );
    if (values.some((value) => !value)) {
      return NextResponse.json(
        { error: "Preencha as três coordenadas antes de traduzir." },
        { status: 400 },
      );
    }
    try {
      const translated = await translateWithOpenAI(values[0], values[1], values[2]);
      return NextResponse.json({ ...translated, provider: "openai" });
    } catch (openAIError) {
      const [theme, subject, discipline] = await Promise.all(values.map(translate));
      return NextResponse.json({ theme, subject, discipline, provider: "public-fallback" });
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? `Tradução indisponível: ${error.message}`
            : "Tradução indisponível.",
      },
      { status: 502 },
    );
  }
}
