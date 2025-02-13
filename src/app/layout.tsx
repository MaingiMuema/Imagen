import "./globals.css";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Imagen - AI Video Generation",
  description: "Transform your stories into cinematic experiences with AI",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased`}>
        <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--gradient-start),transparent_50%),radial-gradient(ellipse_at_bottom,_var(--gradient-end),transparent_50%)] opacity-50 pointer-events-none" />
        <div className="relative">{children}</div>
      </body>
    </html>
  );
}
