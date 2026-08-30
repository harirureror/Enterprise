import Badge from "@/components/Badge";
import type { ReminderStatus } from "@/lib/api";
import { FREQUENCY_LABELS, type ReminderFrequency } from "@/lib/reminder-schedule";
import { formatDate } from "@/lib/ui";

/* Ringkasan sekali lihat: sudah pernah diingatkan atau belum, dan terjadwal
   atau tidak. Dipisah dari formnya supaya bisa dipakai di halaman lain juga. */

export default function ReminderStatusStrip({ status }: { status: ReminderStatus }) {
  const { sentCount, lastSentAt, frequency, nextAt, overdue } = status;

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {sentCount === 0 ? (
        <Badge className="bg-foreground/5 text-muted ring-1 ring-border">Belum pernah diingatkan</Badge>
      ) : (
        <Badge className="bg-low/10 text-low ring-1 ring-low/20">
          {sentCount}× terkirim
          {lastSentAt && <span className="font-normal"> · terakhir {formatDate(lastSentAt)}</span>}
        </Badge>
      )}

      {nextAt === null ? (
        <Badge className="bg-foreground/5 text-muted ring-1 ring-border">Tanpa jadwal</Badge>
      ) : overdue ? (
        // Jadwal aktif tapi tanggalnya sudah lewat — pengiriman otomatis belum jalan.
        <Badge className="bg-high/10 text-high ring-1 ring-high/20">
          Terjadwal {formatDate(nextAt)} · terlewat
        </Badge>
      ) : (
        <Badge className="bg-accent/10 text-accent ring-1 ring-accent/20">
          {FREQUENCY_LABELS[frequency as ReminderFrequency] ?? frequency} · berikutnya{" "}
          {formatDate(nextAt)}
        </Badge>
      )}
    </div>
  );
}
