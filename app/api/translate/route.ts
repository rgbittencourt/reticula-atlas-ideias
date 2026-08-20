import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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
    const [theme, subject, discipline] = await Promise.all(values.map(translate));
    return NextResponse.json({ theme, subject, discipline });
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
