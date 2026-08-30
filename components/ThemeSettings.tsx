"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { ACCENTS, ACCENT_LABELS, ACCENT_SWATCH } from "@/lib/accent";
import { THEMES, THEME_LABELS, type Theme } from "@/lib/theme";

/* Overlay setelan tampilan. Pakai <dialog> bawaan: fokus terkunci di dalam,
   Escape menutup, dan latarnya inert — tanpa library.

   `m-auto` wajib: preflight Tailwind menyetel margin semua elemen jadi 0,
   yang menimpa `margin: auto` bawaan <dialog> untuk memusatkan diri. */

/** Ikon tiap pilihan, supaya bisa dikenali tanpa membaca labelnya. */
const icons: Record<Theme, string> = {
  system:
    "M4 5h16v10H4V5zm0 12h16v2H4v-2zm2-10v6h12V7H6z",
  light:
    "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1",
  dark: "M21 13a9 9 0 1 1-10-10 7 7 0 0 0 10 10z",
};

export default function ThemeSettings() {
  const { theme, resolved, setTheme, accent, setAccent } = useTheme();
  const uid = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [terbuka, setTerbuka] = useState(false);

  // showModal() hanya boleh dipanggil setelah elemennya ada di DOM.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (terbuka && !d.open) d.showModal();
    if (!terbuka && d.open) d.close();
  }, [terbuka]);

  return (
    <>
      <button
        type="button"
        onClick={() => setTerbuka(true)}
        aria-haspopup="dialog"
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted ring-1 ring-border transition-colors hover:bg-background"
        title={`Tampilan: ${THEME_LABELS[theme]}`}
      >
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d={icons[resolved === "dark" ? "dark" : "light"]} />
        </svg>
        <span className="sr-only">Setelan tampilan, sekarang {THEME_LABELS[theme]}</span>
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setTerbuka(false)}
        aria-labelledby={`${uid}-judul`}
        className="m-auto w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-foreground shadow-card backdrop:bg-foreground/40 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            <h2 id={`${uid}-judul`} className="text-headline-sm font-semibold">
              Tampilan
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Tersimpan di peramban ini saja.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTerbuka(false)}
            aria-label="Tutup"
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-background"
          >
            Tutup
          </button>
        </div>

        <div className="px-4 py-4">
          <fieldset>
            <legend className="text-label-caps font-bold text-muted uppercase">Mode warna</legend>

            <div className="mt-3 grid gap-2">
              {THEMES.map((t) => {
                const terpilih = t === theme;
                return (
                  <label
                    key={t}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-accent ${
                      terpilih
                        ? "border-accent bg-accent/10 font-medium"
                        : "border-border hover:bg-background"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${uid}-tema`}
                      value={t}
                      checked={terpilih}
                      onChange={() => setTheme(t)}
                      className="accent-accent"
                    />
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className={`h-4 w-4 shrink-0 fill-current ${
                        terpilih ? "text-accent" : "text-muted"
                      }`}
                    >
                      <path d={icons[t]} />
                    </svg>
                    <span className="flex-1">{THEME_LABELS[t]}</span>
                    {t === "system" && (
                      <span className="text-xs text-muted">
                        kini {resolved === "dark" ? "gelap" : "terang"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <p className="mt-3 text-xs text-muted">
            &quot;Ikut sistem&quot; menyesuaikan otomatis saat setelan perangkat berubah.
          </p>

          <fieldset className="mt-5 border-t border-border pt-4">
            <legend className="text-label-caps font-bold text-muted uppercase">Warna aksen</legend>

            <div className="mt-3 flex flex-wrap gap-2">
              {ACCENTS.map((a) => {
                const terpilih = a === accent;
                return (
                  <label
                    key={a}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-accent ${
                      terpilih
                        ? "border-accent bg-accent/10 font-medium"
                        : "border-border hover:bg-background"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`${uid}-aksen`}
                      value={a}
                      checked={terpilih}
                      onChange={() => setAccent(a)}
                      className="sr-only"
                    />
                    {/* Warna contoh dipasang inline karena memang nilai data,
                        bukan bagian dari sistem token. */}
                    {/* Centang, bukan cuma warna: status terpilih tidak boleh
                        bergantung pada kemampuan membedakan warna saja. */}
                    <span
                      aria-hidden
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-1 ring-border"
                      style={{ backgroundColor: ACCENT_SWATCH[a] }}
                    >
                      {terpilih && (
                        <svg viewBox="0 0 24 24" className="h-3 w-3 fill-none stroke-white stroke-3">
                          <path d="M4 12.5 9.5 18 20 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {ACCENT_LABELS[a]}
                    {terpilih && <span className="sr-only"> (dipilih)</span>}
                  </label>
                );
              })}
            </div>

            <p className="mt-3 text-xs text-muted">
              Tiap warna punya versi sendiri untuk mode gelap, jadi pilihannya tetap
              terbaca saat tampilan berganti.
            </p>
          </fieldset>
        </div>
      </dialog>
    </>
  );
}
