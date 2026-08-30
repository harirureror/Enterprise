/* Validasi komentar proyek. Fungsi murni, dipakai form di browser dan server
   action — pola yang sama dengan lib/reminder-form.ts. */

export type CommentDraft = {
  body: string;
};

export type CommentField = keyof CommentDraft;
export type CommentErrors = Partial<Record<CommentField, string>>;

export const COMMENT_MIN = 2;
export const COMMENT_MAX = 1000;

export function emptyCommentDraft(): CommentDraft {
  return { body: "" };
}

export function validateComment(draft: CommentDraft): CommentErrors {
  const errors: CommentErrors = {};
  const isi = draft.body.trim();

  if (isi === "") errors.body = "Komentar tidak boleh kosong.";
  else if (isi.length < COMMENT_MIN) errors.body = `Komentar minimal ${COMMENT_MIN} karakter.`;
  else if (isi.length > COMMENT_MAX) errors.body = `Komentar maksimal ${COMMENT_MAX} karakter.`;

  return errors;
}
