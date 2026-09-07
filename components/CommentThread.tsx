"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { COMMENT_MAX, type CommentErrors, validateComment } from "@/lib/comment-form";
import { formatDate } from "@/lib/ui";

/* Utas diskusi. Urutannya terlama dulu supaya terbaca sebagai percakapan, dan
   komentar milik pengguna yang sedang masuk diberi penanda supaya mudah
   dibedakan dari komentar rekan.

   Dipakai dua tempat — proyek dan rencana strategis. Yang membedakan hanya
   server action pengirimnya, jadi itu yang diterima sebagai prop; sisanya
   sama persis dan tidak perlu digandakan. */

function inisial(nama: string): string {
  return nama
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Bentuk terkecil yang dibutuhkan utas ini. Sengaja bukan CommentView milik
 * proyek: komentar rencana punya planId, bukan projectId, dan sisanya sama —
 * jadi yang diminta hanya bagian yang benar-benar dipakai.
 */
export type UtasKomentar = {
  id: number;
  userId: number;
  body: string;
  createdAt: string;
  user: { id: number; name: string } | null;
};

export type KirimKomentar = (
  body: string
) => Promise<{ ok: true } | { ok: false; error: string; errors: CommentErrors }>;

export default function CommentThread({
  comments,
  currentUserId,
  onKirim,
  bolehTulis = true,
}: {
  comments: UtasKomentar[];
  currentUserId: number;
  /** Server action pengirim, sudah terikat ke proyek atau rencana pemanggil. */
  onKirim: KirimKomentar;
  /** Boleh menambah komentar? Membacanya tidak pernah dibatasi di sini. */
  bolehTulis?: boolean;
}) {
  const router = useRouter();
  const uid = useId();
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<CommentErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [gagal, setGagal] = useState<string | null>(null);

  function ubah(nilai: string) {
    setBody(nilai);
    if (submitted) setErrors(validateComment({ body: nilai }));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
    setGagal(null);

    const temuan = validateComment({ body });
    setErrors(temuan);
    if (Object.keys(temuan).length > 0) {
      document.getElementById(`${uid}-body`)?.focus();
      return;
    }

    setSaving(true);
    try {
      const hasil = await onKirim(body);
      if (!hasil.ok) {
        setErrors(hasil.errors);
        setGagal(hasil.error);
        return;
      }

      setBody("");
      setSubmitted(false);
      router.refresh();
    } catch {
      setGagal("Tidak bisa menghubungi server. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {comments.length === 0 ? (
        <p className="text-sm text-muted">
          Belum ada komentar. Mulai diskusi kalau ada yang perlu dikoordinasikan.
        </p>
      ) : (
        <ul className="space-y-4">
          {comments.map((c) => {
            const milikSendiri = c.userId === currentUserId;
            return (
              <li key={c.id} className="flex gap-3">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-muted ring-1 ring-border"
                >
                  {inisial(c.user?.name ?? "?")}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className="font-medium">{c.user?.name ?? "Pengguna terhapus"}</span>
                    {milikSendiri && <span className="text-xs text-accent">Anda</span>}
                    <span className="text-xs text-muted">{formatDate(c.createdAt)}</span>
                  </p>
                  <p className="mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!bolehTulis && (
        <p className="mt-5 border-t border-border pt-4 text-sm text-muted">
          Akses Anda tidak mencakup penulisan komentar.
        </p>
      )}

      {bolehTulis && (
      <form noValidate onSubmit={handleSubmit} className="mt-5 border-t border-border pt-4">
        {gagal && (
          <p
            role="alert"
            className="mb-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
          >
            {gagal}
          </p>
        )}

        <label htmlFor={`${uid}-body`} className="block text-sm font-medium">
          Tulis komentar
        </label>
        <textarea
          id={`${uid}-body`}
          value={body}
          rows={3}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? `${uid}-error` : undefined}
          onChange={(e) => ubah(e.target.value)}
          placeholder="Contoh: Vendor sudah konfirmasi harga, dokumen menyusul besok."
          className={`mt-1 w-full rounded-lg border bg-surface px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-accent/20 ${
            errors.body ? "border-high focus:border-high" : "border-border focus:border-accent"
          }`}
        />
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs text-muted">
            {body.trim().length}/{COMMENT_MAX} karakter
          </span>
          {errors.body && (
            <p id={`${uid}-error`} className="text-xs text-high">
              {errors.body}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-on-brand transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Mengirim…" : "Kirim Komentar"}
        </button>
      </form>
      )}
    </div>
  );
}
