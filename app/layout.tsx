import type { Metadata } from "next";
import "./globals.css";
import "./enhancements.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://reticula-atlas-ideias.rogerio-bittencourt.chatgpt.site"),
  title: "Retícula — Atlas de Literatura Científica",
  description: "Transforme três coordenadas de pesquisa em um atlas 3D de literatura científica verificável.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
  openGraph: {
    title: "Retícula — Atlas de Literatura Científica",
    description: "Ideias ganham forma. Relações ganham sentido.",
    images: [{ url: "/og.png", width: 1792, height: 1024, alt: "Retícula — Atlas de Literatura Científica" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Retícula — Atlas de Literatura Científica",
    description: "Ideias ganham forma. Relações ganham sentido.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
