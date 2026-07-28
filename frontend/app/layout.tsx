import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VirsaAI - Preserve Your Family History",
  description: "Transform spoken life stories into beautifully written biographies with interactive timelines and family trees.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
