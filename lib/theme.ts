/* Preferensi tema. Logikanya dipisah dari React supaya bisa diuji tanpa DOM,
   dan supaya skrip anti-kedip di <head> bisa memakai aturan yang sama. */

export type Theme = "system" | "light" | "dark";

/** Tema yang benar-benar dipakai setelah "system" diterjemahkan. */
export type ResolvedTheme = "light" | "dark";

export const THEMES: Theme[] = ["system", "light", "dark"];

export const THEME_LABELS: Record<Theme, string> = {
  system: "Ikut sistem",
  light: "Terang",
  dark: "Gelap",
};

/**
 * Default sengaja "system": menebak preferensi orang lebih buruk daripada
 * mengikuti setelan perangkatnya sampai mereka memilih sendiri.
 */
export const DEFAULT_THEME: Theme = "system";

export const THEME_STORAGE_KEY = "jsi.tema.v1";

export function isTheme(nilai: unknown): nilai is Theme {
  return typeof nilai === "string" && (THEMES as string[]).includes(nilai);
}

/** Terjemahkan pilihan jadi tema nyata. `systemDark` dari media query. */
export function resolveTheme(theme: Theme, systemDark: boolean): ResolvedTheme {
  if (theme === "system") return systemDark ? "dark" : "light";
  return theme;
}

/**
 * Nilai atribut `data-theme` di elemen <html>.
 *
 * "system" sengaja tidak menulis atribut apa pun: CSS-nya sudah menangani
 * lewat `prefers-color-scheme`, dan menuliskan hasil terjemahannya justru
 * membekukan pilihan saat pengguna mengganti setelan perangkat.
 */
export function themeAttribute(theme: Theme): ResolvedTheme | null {
  return theme === "system" ? null : theme;
}

/** Baca preferensi tersimpan. Selalu aman: mode privat pun jatuh ke default. */
export function loadTheme(): Theme {
  try {
    const nilai = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(nilai) ? nilai : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Penyimpanan diblokir: temanya tetap berlaku, hanya tidak persisten.
  }
}

/** Terapkan ke elemen <html>. Dipakai provider dan skrip anti-kedip. */
export function applyTheme(root: HTMLElement, theme: Theme): void {
  const atribut = themeAttribute(theme);
  if (atribut === null) root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", atribut);
}

/**
 * Skrip yang dijalankan sebelum halaman tampil, supaya tema tersimpan sudah
 * terpasang saat cat pertama — tanpa ini layar sempat berkedip terang dulu.
 * Ditulis sebagai string karena harus inline di <head>, sebelum React jalan.
 */
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY
)});if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}`;
