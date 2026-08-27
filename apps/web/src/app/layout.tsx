import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Autonomous Voice AI Lab - Solarch BaaS",
  description: "High-fidelity autonomous voice AI research studio, RAG knowledge layer, and 3D spatial web lab built on Solarch.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0603] text-[#fdf3ec] antialiased">
        {children}
      </body>
    </html>
  );
}
