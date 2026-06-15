import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FolioDoctor - Diagnóstico Clínico de Portafolios",
  description: "Audita la salud técnica, interactividad y optimización por IA de tu portafolio web de inmediato.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>
        {children}
      </body>
    </html>
  );
}

