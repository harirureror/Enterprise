"use client";

import { createContext, useCallback, useContext, useEffect, useSyncExternalStore } from "react";
import {
  ACCENT_STORAGE_KEY,
  type Accent,
  DEFAULT_ACCENT,
  applyAccent,
  loadAccent,
  saveAccent,
} from "@/lib/accent";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
  applyTheme,
  loadTheme,
  resolveTheme,
  saveTheme,
} from "@/lib/theme";

/* Preferensi tema disimpan di localStorage — milik tiap peramban, bukan akun.
   Dibungkus external store, bukan useState + useEffect, karena localStorage dan
   media query memang sistem di luar React.

   ponytail: setelah login jadi, preferensi ini pindah ke USER_PREFERENCES
   (PRD bagian 6) supaya ikut orangnya, bukan perangkatnya. */

type ThemeContextValue = {
  /** Pilihan pengguna, termasuk "system". */
  theme: Theme;
  /** Tema yang benar-benar tampil setelah "system" diterjemahkan. */
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  accent: Accent;
  setAccent: (accent: Accent) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

/* --- Store preferensi ---------------------------------------------------- */

let cache: Theme | null = null;
const listeners = new Set<() => void>();

/**
 * Perubahan dari tab lain datang lewat event `storage`. Tanpa ini, mengganti
 * tema di satu tab meninggalkan tab lain dengan tampilan lama sampai dimuat
 * ulang — padahal preferensinya memang milik peramban, bukan milik satu tab.
 */
function subscribeStorage(kunci: string, onChange: () => void, reset: () => void): () => void {
  const dengar = (e: StorageEvent) => {
    // key null berarti localStorage.clear(); itu ikut mengubah preferensi.
    if (e.key !== null && e.key !== kunci) return;
    reset();
    onChange();
  };
  window.addEventListener("storage", dengar);
  return () => window.removeEventListener("storage", dengar);
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const lepasStorage = subscribeStorage(THEME_STORAGE_KEY, onChange, () => {
    cache = null;
  });
  return () => {
    listeners.delete(onChange);
    lepasStorage();
  };
}

function snapshot(): Theme {
  cache ??= loadTheme();
  return cache;
}

/** Di server tidak ada localStorage; pakai default supaya HTML-nya konsisten. */
function serverSnapshot(): Theme {
  return DEFAULT_THEME;
}

function setStored(theme: Theme): void {
  cache = theme;
  saveTheme(theme);
  for (const l of listeners) l();
}

/* --- Store aksen --------------------------------------------------------- */

let cacheAksen: Accent | null = null;
const listenersAksen = new Set<() => void>();

function subscribeAccent(onChange: () => void): () => void {
  listenersAksen.add(onChange);
  const lepasStorage = subscribeStorage(ACCENT_STORAGE_KEY, onChange, () => {
    cacheAksen = null;
  });
  return () => {
    listenersAksen.delete(onChange);
    lepasStorage();
  };
}

function accentSnapshot(): Accent {
  cacheAksen ??= loadAccent();
  return cacheAksen;
}

function accentServerSnapshot(): Accent {
  return DEFAULT_ACCENT;
}

function setStoredAccent(accent: Accent): void {
  cacheAksen = accent;
  saveAccent(accent);
  for (const l of listenersAksen) l();
}

/* --- Store media query --------------------------------------------------- */

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeSystem(onChange: () => void): () => void {
  const mq = window.matchMedia(DARK_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function systemSnapshot(): boolean {
  return window.matchMedia(DARK_QUERY).matches;
}

/** Server tidak tahu setelan perangkat; anggap terang, lalu dikoreksi klien. */
function systemServerSnapshot(): boolean {
  return false;
}

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const systemDark = useSyncExternalStore(subscribeSystem, systemSnapshot, systemServerSnapshot);
  const accent = useSyncExternalStore(subscribeAccent, accentSnapshot, accentServerSnapshot);
  const resolved = resolveTheme(theme, systemDark);

  // Menulis atribut ke <html> adalah menyentuh DOM di luar React, jadi memang
  // tempatnya di effect. Skrip di <head> sudah memasang nilai yang benar saat
  // cat pertama; ini menjaga agar tetap sinkron setelah pilihan berubah.
  useEffect(() => {
    applyTheme(document.documentElement, theme);
  }, [theme]);

  useEffect(() => {
    applyAccent(document.documentElement, accent);
  }, [accent]);

  const setTheme = useCallback((berikutnya: Theme) => setStored(berikutnya), []);
  const setAccent = useCallback((berikutnya: Accent) => setStoredAccent(berikutnya), []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

/** Dipakai komponen yang perlu membaca atau mengganti tema. */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme harus dipakai di dalam ThemeProvider.");
  return ctx;
}
