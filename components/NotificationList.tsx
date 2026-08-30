"use client";

import Link from "next/link";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import Badge from "@/components/Badge";
import {
  KIND_LABELS,
  type Notification,
  type NotificationSeverity,
  notificationHref,
} from "@/lib/notifications";
import {
  type ReadState,
  isUnread,
  markAllRead,
  markRead,
  markUnread,
  prune,
  readStateSnapshot,
  serverReadState,
  setReadState,
  subscribeReadState,
  unreadCount,
} from "@/lib/notification-reads";
import type { ReminderStatus } from "@/lib/api";
import type { User } from "@/lib/types";
import { formatDate } from "@/lib/ui";

/* Notifikasi diturunkan dari keadaan proyek, jadi status "sudah dibaca"
   disimpan di peramban masing-masing, bukan di server. Sebelum status itu
   terbaca (render server dan sesaat sebelum hidrasi), tidak ada titik yang
   ditampilkan — lebih baik telat sedetik daripada menandai semuanya belum
   dibaca lalu berkedip. */

const severityClass: Record<NotificationSeverity, string> = {
  tinggi: "bg-high/10 text-high ring-1 ring-high/20",
  sedang: "bg-med/10 text-med ring-1 ring-med/20",
  info: "bg-foreground/5 text-muted ring-1 ring-border",
};

const borderClass: Record<NotificationSeverity, string> = {
  tinggi: "border-l-4 border-l-high",
  sedang: "border-l-4 border-l-med",
  info: "border-l-4 border-l-border",
};

export default function NotificationList({
  items,
  users,
  reminders = {},
}: {
  items: Notification[];
  users: User[];
  /** Status pengingat per id proyek, supaya PIC tidak diingatkan dua kali. */
  reminders?: Record<number, ReminderStatus>;
}) {
  // `null` selama render server: statusnya belum diketahui, bukan kosong.
  const read = useSyncExternalStore(subscribeReadState, readStateSnapshot, serverReadState);
  const siap = read !== null;

  useEffect(() => {
    // Membuang catatan notifikasi yang penyebabnya sudah beres. Ini menulis ke
    // localStorage — sistem di luar React — jadi memang tempatnya di effect.
    const sekarang = readStateSnapshot();
    const bersih = prune(items, sekarang);
    if (Object.keys(bersih).length !== Object.keys(sekarang).length) setReadState(bersih);
  }, [items]);

  const simpan = (berikutnya: ReadState) => setReadState(berikutnya);

  const belumDibaca = useMemo(
    () => (read === null ? 0 : unreadCount(items, read)),
    [items, read]
  );

  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-5 text-sm text-muted shadow-card">
        Tidak ada yang perlu ditindaklanjuti. Semua tenggat aman dan progresnya terbarui.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted" aria-live="polite">
          {siap
            ? belumDibaca > 0
              ? `${belumDibaca} dari ${items.length} belum dibaca`
              : `Semua ${items.length} notifikasi sudah dibaca`
            : `${items.length} notifikasi`}
        </p>
        {siap && belumDibaca > 0 && (
          <button
            type="button"
            onClick={() => simpan(markAllRead(items, read))}
            className="rounded-lg border border-border px-2.5 py-1 text-sm text-muted hover:bg-surface"
          >
            Tandai semua dibaca
          </button>
        )}
      </div>

      <ul className="grid gap-3">
        {items.map((n) => {
          const pic = users.find((u) => u.id === n.ownerId);
          const baru = read !== null && isUnread(n, read);
          const pengingat = reminders[n.projectId];

          return (
            <li
              key={n.id}
              className={`relative rounded-xl border bg-surface p-4 shadow-card transition-colors hover:bg-background focus-within:ring-2 focus-within:ring-accent ${
                borderClass[n.severity]
              } ${baru ? "border-border" : "border-border/60 opacity-75"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {baru && <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-accent" />}
                    <Badge className={severityClass[n.severity]}>{KIND_LABELS[n.kind]}</Badge>
                    <h3 className="font-semibold leading-snug">
                      {/* `after:` melebarkan area klik ke seluruh kartu tanpa
                          menyarangkan tombol di dalam tautan. */}
                      <Link
                        href={notificationHref(n)}
                        onClick={() => simpan(markRead(n, read ?? {}))}
                        className="outline-none after:absolute after:inset-0 after:rounded-xl"
                      >
                        {n.title}
                        {baru && <span className="sr-only"> (belum dibaca)</span>}
                        <span className="sr-only"> — buka {n.projectName}</span>
                      </Link>
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-muted">{n.detail}</p>
                  <p className="mt-1.5 text-xs text-muted">
                    <span className="font-medium">{n.projectName}</span>
                    {" · PIC "}
                    {pic?.name ?? "—"}
                    {pengingat && pengingat.sentCount > 0 && (
                      <span className="ml-1.5 text-low">
                        · sudah diingatkan {formatDate(pengingat.lastSentAt!)}
                      </span>
                    )}
                    {pengingat?.nextAt && (
                      <span className="ml-1.5 text-accent">
                        · terjadwal {formatDate(pengingat.nextAt)}
                      </span>
                    )}
                  </p>
                </div>

                <div className="relative z-10 flex shrink-0 flex-col items-end gap-2">
                  <span className="text-xs text-muted">{formatDate(n.date)}</span>
                  {siap && (
                    <button
                      type="button"
                      onClick={() => simpan(baru ? markRead(n, read) : markUnread(n, read))}
                      className="rounded-lg border border-border px-2 py-0.5 text-xs text-muted hover:bg-background"
                    >
                      {baru ? "Tandai dibaca" : "Tandai belum"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
