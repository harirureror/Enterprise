import type { Metadata } from "next";
import { Inter } from "next/font/google";
import ThemeProvider from "@/components/ThemeProvider";
import { ACCENT_INIT_SCRIPT } from "@/lib/accent";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dashboard Proyek — Divisi Enterprise JSI",
  description:
    "Pusat pemantauan progres proyek divisi Enterprise Jaya Survei Indonesia.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: skrip di bawah menulis data-theme sebelum React
    // jalan, jadi atribut <html> di klien memang beda dari hasil render server.
    <html lang="id" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Dijalankan sebelum halaman tampil supaya tema tersimpan sudah
            terpasang saat cat pertama — tanpa ini layar berkedip terang dulu. */}
        <script dangerouslySetInnerHTML={{ __html: `${THEME_INIT_SCRIPT}${ACCENT_INIT_SCRIPT}` }} />
        {/* Warna bar peramban di ponsel ikut tema. Dua meta dengan media
            berbeda adalah cara baku memilihnya tanpa JavaScript. */}
        <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8fafc" />
        <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1326" />
      </head>
      <body className="min-h-full bg-background text-foreground font-sans">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
