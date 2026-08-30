import type { ProgressEntryView } from "@/lib/api";
import { formatDate } from "@/lib/ui";

/* Riwayat progres sebagai garis waktu vertikal, terbaru di atas.
   Komponen server — tidak ada state, jadi tidak perlu dikirim ke browser. */

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) {
    return <span className="text-xs text-muted">catatan pertama</span>;
  }
  if (delta === 0) {
    return <span className="text-xs text-muted">tanpa perubahan angka</span>;
  }

  const naik = delta > 0;
  return (
    <span className={`text-xs font-medium ${naik ? "text-low" : "text-med"}`}>
      {naik ? "+" : ""}
      {delta} poin
    </span>
  );
}

export default function ProgressHistory({ entries }: { entries: ProgressEntryView[] }) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
        Belum ada catatan progres. Pembaruan pertama akan muncul di sini.
      </p>
    );
  }

  return (
    <ol className="rounded-xl border border-border bg-surface p-4 shadow-card sm:p-5">
      {entries.map((e, i) => (
        <li key={e.id} className="relative flex gap-4 pb-5 last:pb-0">
          {/* Garis penghubung; tidak digambar di bawah entri terakhir. */}
          {i < entries.length - 1 && (
            <span aria-hidden className="absolute left-[7px] top-4 h-full w-px bg-border" />
          )}
          <span
            aria-hidden
            className={`relative mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-2 ring-surface ${
              i === 0 ? "bg-accent" : "bg-border"
            }`}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-semibold tabular-nums">{e.progressPct}%</span>
              <DeltaBadge delta={e.delta} />
              <span className="ml-auto text-xs text-muted">
                <time dateTime={e.createdAt}>{formatDate(e.createdAt)}</time>
              </span>
            </div>

            {e.note && <p className="mt-1 text-sm">{e.note}</p>}

            <p className="mt-1 text-xs text-muted">
              Dicatat oleh {e.user?.name ?? "anggota yang sudah tidak terdaftar"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
