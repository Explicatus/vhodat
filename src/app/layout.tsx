import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Входът — управление на етажна собственост",
  description: "Такси, разходи, обяви, гласувания и сигнали за вашата етажна собственост — на едно място.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#eef2fb" }, { media: "(prefers-color-scheme: dark)", color: "#070b18" }],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // „Едър текст“ се помни за устройството (бисквитка), напр. на телефона на по-възрастен съсед
  const large = (await cookies()).get("es_text")?.value === "lg";
  return (
    <html lang="bg" data-text={large ? "lg" : undefined}>
      <body>{children}</body>
    </html>
  );
}
