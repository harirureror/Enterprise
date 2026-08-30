/* Pilihan warna aksen. Nilainya sengaja tidak disimpan sebagai hex di
   JavaScript lalu ditulis inline: yang disimpan hanya namanya, dan CSS yang
   memutuskan hex mana yang dipakai untuk tema terang maupun gelap. Dengan
   begitu satu pilihan tetap benar saat penggunanya berganti mode warna. */

export type Accent = "bawaan" | "biru" | "ungu" | "hijau" | "jingga";

export const ACCENTS: Accent[] = ["bawaan", "biru", "ungu", "hijau", "jingga"];

export const ACCENT_LABELS: Record<Accent, string> = {
  bawaan: "Teal",
  biru: "Biru",
  ungu: "Ungu",
  hijau: "Hijau",
  jingga: "Jingga",
};

/**
 * Warna contoh untuk kotak pratinjau di setelan. Ini hanya untuk swatch —
 * warna yang benar-benar dipakai antarmuka datang dari CSS, supaya tema
 * gelap dapat versinya sendiri tanpa perhitungan di JavaScript.
 */
export const ACCENT_SWATCH: Record<Accent, string> = {
  bawaan: "#006781",
  biru: "#1d4ed8",
  ungu: "#6d28d9",
  hijau: "#15803d",
  jingga: "#c2410c",
};

export const DEFAULT_ACCENT: Accent = "bawaan";

export const ACCENT_STORAGE_KEY = "jsi.aksen.v1";

export function isAccent(nilai: unknown): nilai is Accent {
  return typeof nilai === "string" && (ACCENTS as string[]).includes(nilai);
}

/**
 * Nilai atribut `data-accent`. "bawaan" tidak menulis atribut apa pun supaya
 * token aslinya di :root yang berlaku — tidak perlu aturan CSS duplikat.
 */
export function accentAttribute(accent: Accent): Exclude<Accent, "bawaan"> | null {
  return accent === "bawaan" ? null : accent;
}

export function loadAccent(): Accent {
  try {
    const nilai = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccent(nilai) ? nilai : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function saveAccent(accent: Accent): void {
  try {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Penyimpanan diblokir: pilihannya tetap berlaku, hanya tidak persisten.
  }
}

export function applyAccent(root: HTMLElement, accent: Accent): void {
  const atribut = accentAttribute(accent);
  if (atribut === null) root.removeAttribute("data-accent");
  else root.setAttribute("data-accent", atribut);
}

/** Bagian skrip anti-kedip untuk aksen; digabung dengan milik tema. */
export const ACCENT_INIT_SCRIPT = `try{var a=localStorage.getItem(${JSON.stringify(
  ACCENT_STORAGE_KEY
)});if(a&&a!=="bawaan"&&${JSON.stringify(
  ACCENTS
)}.indexOf(a)>-1){document.documentElement.setAttribute("data-accent",a)}}catch(e){}`;
