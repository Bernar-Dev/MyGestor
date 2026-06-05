import "./globals.css";
import { Toaster } from "sonner";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newgestor — Meta Ads para Agências",
  description: "Painel de gestão de tráfego Meta Ads. Cada gestor conecta sua própria conta Meta.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toaster theme="dark" position="top-right" richColors />
      </body>
    </html>
  );
}
