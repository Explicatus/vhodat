import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Входът — управление на етажна собственост",
  description: "Такси, разходи, обяви, гласувания и сигнали за вашата етажна собственост — на едно място.",
};

export const viewport: Viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#eef2fb" }, { media: "(prefers-color-scheme: dark)", color: "#070b18" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
