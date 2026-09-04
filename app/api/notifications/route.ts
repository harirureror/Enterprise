import { type NextRequest, NextResponse } from "next/server";
import { jagaRute } from "@/lib/api-guard";
import { getNotifications, getReminderStatusMap } from "@/lib/api";
import { KIND_LABELS, type NotificationKind, type NotificationSeverity } from "@/lib/notifications";

/**
 * GET /api/notifications?kind=&severity=&projectId=
 *
 * Notifikasi tidak disimpan sebagai baris — semuanya diturunkan dari keadaan
 * proyek saat request datang. Jadi tidak ada POST/DELETE di sini: cara
 * "menghapus" notifikasi adalah membereskan penyebabnya (perbarui progres,
 * geser tenggat, atau selesaikan proyeknya).
 *
 * Status "sudah dibaca" juga bukan urusan endpoint ini selama autentikasi
 * belum ada; sekarang masih per peramban (lihat lib/notification-reads.ts).
 */

const SEVERITIES: NotificationSeverity[] = ["tinggi", "sedang", "info"];

export async function GET(request: NextRequest) {
  const izin = await jagaRute("lihat-notifikasi");
  if (!izin.ok) return izin.response;

  const params = request.nextUrl.searchParams;
  const invalid: string[] = [];

  const kind = params.get("kind")?.trim() ?? "";
  if (kind !== "" && !(Object.keys(KIND_LABELS) as string[]).includes(kind)) invalid.push("kind");

  const severity = params.get("severity")?.trim() ?? "";
  if (severity !== "" && !(SEVERITIES as string[]).includes(severity)) invalid.push("severity");

  const projectRaw = params.get("projectId")?.trim() ?? "";
  if (projectRaw !== "" && !/^\d+$/.test(projectRaw)) invalid.push("projectId");

  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Nilai filter tidak dikenal: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  const feed = await getNotifications();
  const status = await getReminderStatusMap();

  const items = feed.items
    .filter((n) => kind === "" || n.kind === kind)
    .filter((n) => severity === "" || n.severity === severity)
    .filter((n) => projectRaw === "" || n.projectId === Number(projectRaw))
    // Status pengingat ikut supaya klien tahu mana yang sudah ditindaklanjuti.
    .map((n) => ({
      ...n,
      kindLabel: KIND_LABELS[n.kind as NotificationKind],
      reminded: (status[n.projectId]?.sentCount ?? 0) > 0,
      scheduledAt: status[n.projectId]?.nextAt ?? null,
    }));

  return NextResponse.json({
    items,
    count: items.length,
    /** Jumlah seluruh notifikasi sebelum disaring. */
    total: feed.total,
    counts: feed.counts,
    filter: { kind: kind || null, severity: severity || null, projectId: projectRaw || null },
    /** Notifikasi dihitung ulang tiap request, tidak disimpan. */
    derived: true,
  });
}
