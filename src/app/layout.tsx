import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Входът — управление на етажна собственост",
  description: "Такси, разходи, обяви, гласувания и сигнали за вашата етажна собственост — на едно място.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bg">
      <body>{children}</body>
    </html>
  );
}
