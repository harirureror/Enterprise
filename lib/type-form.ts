import { PROJECT_TYPES } from "./types";

/* Validasi keterangan jenis proyek. Sengaja dipisah dari `project-form.ts`
   karena yang divalidasi beda: di sini yang diubah label dan urutannya,
   bukan isi proyeknya. */

export type TypeDraft = {
  label: string;
  description: string;
  sortOrder: string;
};

export type TypeField = keyof TypeDraft;
export type TypeErrors = Partial<Record<TypeField, string>>;

export const LABEL_MAX = 40;
export const TYPE_DESCRIPTION_MAX = 200;

/** `code` tidak ikut divalidasi di sini — nilainya tidak boleh diubah sama sekali. */
export function validateTypeDraft(draft: TypeDraft): TypeErrors {
  const errors: TypeErrors = {};

  const label = draft.label.trim();
  if (label === "") errors.label = "Label jenis wajib diisi.";
  else if (label.length > LABEL_MAX) errors.label = `Label maksimal ${LABEL_MAX} karakter.`;

  if (draft.description.trim().length > TYPE_DESCRIPTION_MAX) {
    errors.description = `Keterangan maksimal ${TYPE_DESCRIPTION_MAX} karakter.`;
  }

  const urutan = Number(draft.sortOrder);
  if (draft.sortOrder.trim() === "" || !Number.isInteger(urutan)) {
    errors.sortOrder = "Urutan harus berupa angka bulat.";
  } else if (urutan < 0 || urutan >= PROJECT_TYPES.length) {
    errors.sortOrder = `Urutan harus antara 0 dan ${PROJECT_TYPES.length - 1}.`;
  }

  return errors;
}
