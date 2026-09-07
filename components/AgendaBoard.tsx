"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import AgendaBars from "@/components/AgendaBars";
import AgendaCalendar, { type Bar, type Kotak } from "@/components/AgendaCalendar";
import AgendaForm from "@/components/AgendaForm";
import AgendaPopover from "@/components/AgendaPopover";
import AgendaScale from "@/components/AgendaScale";
import Badge from "@/components/Badge";
import type { AgendaView } from "@/lib/api";
import {
  geserAgenda,
  hapusAgenda,
  hapusAgendaBanyak,
  perbaruiAgenda,
  simpanAgenda,
  ubahRentangAgenda,
} from "@/lib/agenda-actions";
import {
  type AgendaDraft,
  type AgendaErrors,
  agendaToDraft,
  emptyAgendaDraft,
} from "@/lib/agenda-form";
import {
  type SisiBar,
  type SkalaAgenda,
  type SkalaPreset,
  agendaClashes,
  geserKhusus,
  rangeBars,
  rentangKhusus,
  rentangSkala,
  resizeTarget,
  ticksRentang,
} from "@/lib/agenda";
import { fromDay, toDay } from "@/lib/timeline";
import { canEditAgenda } from "@/lib/permissions";
import { AGENDA_KINDS, type AgendaKind, type Project, type User } from "@/lib/types";
import { formatDate } from "@/lib/ui";

/* Papan agenda.

   Dua tampilan yang menjawab dua pertanyaan berbeda:

   - Kalender menjawab "apa yang terjadi kapan" — petak pekan seperti kalender
     pada umumnya, dengan periode dari sepekan sampai setahun.
   - Papan Tim menjawab "siapa sedang di mana" — satu baris per anggota, dan
     sengaja sepekan saja, karena hanya di situ bar per orang masih lega.

   Form tidak lagi menempel di bawah halaman: ia muncul sebagai popover pada
   agenda atau slot tanggal yang diklik. */

const kindClass: Record<AgendaKind, string> = {
  Lapangan: "bg-accent/15 text-accent ring-1 ring-accent/30",
  Kantor: "bg-stage/15 text-stage ring-1 ring-stage/30",
  Perjalanan: "bg-med/15 text-med ring-1 ring-med/30",
  Cuti: "text-muted ring-1 ring-border",
};

export type Viewer = { id: number; accessLevel: User["accessLevel"] };

type Popover =
  | { jenis: "agenda"; bar: Bar; kotak: Kotak }
  | { jenis: "slot"; tanggal: string; kotak: Kotak };

export default function AgendaBoard({
  entries,
  users,
  projects,
  viewer,
  today,
}: {
  entries: AgendaView[];
  users: User[];
  projects: Project[];
  viewer: Viewer;
  /** Tanggal acuan dari server, supaya pekan awalnya tidak beda gara-gara zona waktu. */
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [tampilan, setTampilan] = useState<"kalender" | "papan">("kalender");
  const [skala, setSkala] = useState<SkalaAgenda>("bulan");
  const [geser, setGeser] = useState(0);
  // Rentang khusus dipegang apa adanya, bukan sebagai jumlah geseran: dua kolom
  // tanggal bebas tidak punya "satuan" untuk digeser.
  const [khusus, setKhusus] = useState(() => ({
    start: today,
    end: fromDay(toDay(today) + 13),
  }));
  /** Papan Tim punya navigasi pekannya sendiri; ia memang hanya mingguan. */
  const [pekanGeser, setPekanGeser] = useState(0);

  const [popover, setPopover] = useState<Popover | null>(null);
  const [draft, setDraft] = useState<AgendaDraft | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [errors, setErrors] = useState<AgendaErrors>({});
  const [gagal, setGagal] = useState<string | null>(null);
  const [terpilih, setTerpilih] = useState<Set<number>>(new Set());
  /** Diumumkan lewat aria-live; tanpa ini seretan tidak terdengar sama sekali. */
  const [kabar, setKabar] = useState("");

  const rentang = useMemo(
    () =>
      skala === "khusus"
        ? rentangKhusus(khusus.start, khusus.end)
        : rentangSkala(skala, today, geser),
    [skala, today, geser, khusus]
  );
  const pekan = useMemo(() => rentangSkala("minggu", today, pekanGeser), [today, pekanGeser]);

  const bentrok = useMemo(() => agendaClashes(entries), [entries]);
  const idBentrok = useMemo(() => new Set(bentrok.flatMap((b) => [b.a, b.b])), [bentrok]);
  const barisPapan = useMemo(() => rangeBars(entries, users, pekan), [entries, users, pekan]);
  const tickPapan = useMemo(() => ticksRentang(pekan), [pekan]);

  const bisaIsiSiapaPun = users.some((u) => canEditAgenda(viewer, { userId: u.id }));
  const jumlahTerpilih = terpilih.size;
  const memuatHariIni = today >= rentang.start && today <= rentang.end;

  /* --- Periode -------------------------------------------------------------- */

  function pilihSkala(s: SkalaPreset) {
    setSkala(s);
    setGeser(0);
  }

  function pilihKhusus(start: string, end: string) {
    setSkala("khusus");
    setKhusus({ start, end });
  }

  function geserPeriode(arah: number) {
    if (skala === "khusus") {
      const r = geserKhusus(rentang, arah);
      setKhusus({ start: r.start, end: r.end });
      return;
    }
    setGeser((g) => g + arah);
  }

  function keHariIni() {
    if (skala === "khusus") {
      // Panjang rentangnya dipertahankan; yang berubah hanya titik mulainya.
      setKhusus({ start: today, end: fromDay(toDay(today) + rentang.totalDays - 1) });
      return;
    }
    setGeser(0);
  }

  /* --- Popover -------------------------------------------------------------- */

  function tutupPopover() {
    setPopover(null);
    setDraft(null);
    setEditId(null);
    setErrors({});
    setGagal(null);
  }

  function bukaAgenda(bar: Bar, kotak: Kotak) {
    setGagal(null);
    setErrors({});
    // Bar berisi satu entri langsung ke formnya; yang gabungan menampilkan
    // daftar isinya dulu supaya jelas entri mana yang disentuh.
    if (bar.entries.length === 1) {
      setEditId(bar.entries[0].id);
      setDraft(agendaToDraft(bar.entries[0]));
    } else {
      setDraft(null);
      setEditId(null);
    }
    setPopover({ jenis: "agenda", bar, kotak });
  }

  function bukaSlot(tanggal: string, kotak: Kotak) {
    if (!bisaIsiSiapaPun) return;
    // Anggota bawaan: diri sendiri kalau boleh, kalau tidak yang pertama boleh.
    const sendiri = users.find(
      (u) => u.id === viewer.id && canEditAgenda(viewer, { userId: u.id })
    );
    const pemilik = sendiri ?? users.find((u) => canEditAgenda(viewer, { userId: u.id }));
    if (!pemilik) return;

    setGagal(null);
    setErrors({});
    setEditId(null);
    setDraft({ ...emptyAgendaDraft(pemilik.id), startDate: tanggal, endDate: tanggal });
    setPopover({ jenis: "slot", tanggal, kotak });
  }

  function bukaEntri(entry: AgendaView) {
    setEditId(entry.id);
    setErrors({});
    setGagal(null);
    setDraft(agendaToDraft(entry));
  }

  function set(field: keyof AgendaDraft, value: string) {
    setDraft((lama) => (lama === null ? lama : { ...lama, [field]: value }));
    setErrors((lama) => ({ ...lama, [field]: undefined }));
  }

  /* --- Aksi ----------------------------------------------------------------- */

  function jalankan(
    aksi: () => Promise<{ ok: true } | { ok: false; error: string; errors: AgendaErrors }>,
    sesudah?: () => void,
    umumkan?: string
  ) {
    setGagal(null);
    startTransition(async () => {
      const hasil = await aksi();
      if (!hasil.ok) {
        setGagal(hasil.error);
        setErrors(hasil.errors);
        setKabar(hasil.error);
        return;
      }
      sesudah?.();
      if (umumkan) setKabar(umumkan);
      router.refresh();
    });
  }

  function simpan() {
    if (draft === null) return;
    jalankan(
      () => (editId === null ? simpanAgenda(draft) : perbaruiAgenda(editId, draft)),
      tutupPopover
    );
  }

  function hapus(id: number) {
    jalankan(() => hapusAgenda(id), () => {
      tutupPopover();
      setTerpilih((lama) => {
        const baru = new Set(lama);
        baru.delete(id);
        return baru;
      });
    });
  }

  function pindahBar(bar: Bar, deltaHari: number, userIdBaru: number | null = null) {
    const ids = bar.entries.map((e) => e.id);
    const nama = userIdBaru === null ? null : users.find((u) => u.id === userIdBaru)?.name;

    jalankan(
      () => geserAgenda(ids, deltaHari, userIdBaru),
      undefined,
      `${bar.kind} ${bar.entries.length} agenda ${
        deltaHari === 0
          ? ""
          : `bergeser ${Math.abs(deltaHari)} hari ${deltaHari > 0 ? "maju" : "mundur"}`
      }${nama ? ` ke ${nama}` : ""}.`
    );
  }

  function ubahDurasiBar(bar: Bar, sisi: SisiBar, deltaHari: number) {
    const target = resizeTarget(bar, sisi, deltaHari);
    const ujung = sisi === "kanan" ? bar.entries[bar.entries.length - 1] : bar.entries[0];
    // Seretan yang terjepit habis tidak mengubah apa pun — jangan kirim ke server.
    if (target.startDate === ujung.startDate && target.endDate === ujung.endDate) return;

    jalankan(
      () => ubahRentangAgenda(target.id, target.startDate, target.endDate),
      undefined,
      `${bar.kind} kini ${formatDate(target.startDate)} sampai ${formatDate(target.endDate)}.`
    );
  }

  function alihPilih(bar: Bar) {
    const ids = bar.entries.map((e) => e.id);
    setTerpilih((lama) => {
      const baru = new Set(lama);
      // Bar adalah satu kesatuan: kalau seluruhnya sudah terpilih, lepaskan
      // seluruhnya; kalau belum, ambil seluruhnya.
      const semua = ids.every((id) => baru.has(id));
      for (const id of ids) {
        if (semua) baru.delete(id);
        else baru.add(id);
      }
      return baru;
    });
  }

  function hapusTerpilih() {
    const ids = [...terpilih];
    jalankan(
      () => hapusAgendaBanyak(ids),
      () => setTerpilih(new Set()),
      `${ids.length} agenda dihapus.`
    );
  }

  /* --- Tampilan ------------------------------------------------------------- */

  const tombolTampilan = (nilai: "kalender" | "papan", label: string) => (
    <button
      type="button"
      aria-pressed={tampilan === nilai}
      onClick={() => {
        setTampilan(nilai);
        tutupPopover();
      }}
      className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
        tampilan === nilai
          ? "bg-foreground font-medium text-background"
          : "border border-border text-muted hover:bg-surface"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-3">
          <div role="group" aria-label="Bentuk tampilan" className="flex flex-wrap gap-1.5">
            {tombolTampilan("kalender", "Kalender")}
            {tombolTampilan("papan", "Papan Tim")}
          </div>

          {tampilan === "kalender" ? (
            <AgendaScale
              skala={skala}
              rentang={rentang}
              khusus={khusus}
              bergeser={skala === "khusus" ? !memuatHariIni : geser !== 0}
              onSkala={pilihSkala}
              onKhusus={pilihKhusus}
              onGeser={geserPeriode}
              onSekarang={keHariIni}
            />
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPekanGeser((g) => g - 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface"
              >
                ← Pekan lalu
              </button>
              <span className="text-sm font-medium">
                {formatDate(pekan.start)} – {formatDate(pekan.end)}
              </span>
              <button
                type="button"
                onClick={() => setPekanGeser((g) => g + 1)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:bg-surface"
              >
                Pekan depan →
              </button>
              {pekanGeser !== 0 && (
                <button
                  type="button"
                  onClick={() => setPekanGeser(0)}
                  className="rounded-lg px-2 py-1.5 text-sm text-muted underline hover:text-foreground"
                >
                  Kembali ke pekan ini
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>Jenis:</span>
          {AGENDA_KINDS.map((k) => (
            <Badge key={k} className={kindClass[k]}>
              {k}
            </Badge>
          ))}
        </div>
      </div>

      {bisaIsiSiapaPun && (
        <p className="mt-2 text-xs text-muted">
          {tampilan === "kalender"
            ? "Klik tanggal kosong untuk mengisi agenda, atau klik agendanya untuk mengubah. Seret untuk memindahkan tanggal; tarik ujungnya untuk mengubah durasi."
            : "Seret bar untuk menggeser tanggalnya atau memindahkannya ke anggota lain. Papan Tim sengaja hanya sepekan — untuk rentang lebih panjang, pakai Kalender."}
        </p>
      )}

      {gagal && popover === null && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-high/30 bg-high/10 p-2.5 text-sm text-high"
        >
          {gagal}
        </p>
      )}

      <p aria-live="polite" className="sr-only">
        {kabar}
      </p>

      {jumlahTerpilih > 0 && (
        <div className="sticky top-2 z-30 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/40 bg-surface p-3 shadow-card">
          <span className="text-sm font-medium">{jumlahTerpilih} agenda terpilih</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={hapusTerpilih}
              className="rounded-lg bg-high px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {pending ? "Menghapus…" : `Hapus ${jumlahTerpilih} agenda`}
            </button>
            <button
              type="button"
              onClick={() => setTerpilih(new Set())}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {tampilan === "kalender" ? (
        <AgendaCalendar
          entries={entries}
          rentang={rentang}
          viewer={viewer}
          terpilih={terpilih}
          idBentrok={idBentrok}
          pending={pending}
          onBar={bukaAgenda}
          onSlot={bukaSlot}
          onGeser={(bar, d) => pindahBar(bar, d)}
          onUbahRentang={ubahDurasiBar}
          onToggle={alihPilih}
        />
      ) : (
        <AgendaBars
          rows={barisPapan}
          rentang={pekan}
          ticks={tickPapan}
          viewer={viewer}
          idBentrok={idBentrok}
          terpilih={terpilih}
          pending={pending}
          onBuka={bukaAgenda}
          onToggle={alihPilih}
          onGeser={pindahBar}
          onUbahRentang={ubahDurasiBar}
          onIsi={(userId, kotak) => {
            const awal = today >= pekan.start && today <= pekan.end ? today : pekan.start;
            const pemilik = users.find((u) => u.id === userId);
            if (!pemilik) return;
            setGagal(null);
            setErrors({});
            setEditId(null);
            setDraft({ ...emptyAgendaDraft(userId), startDate: awal, endDate: awal });
            setPopover({ jenis: "slot", tanggal: awal, kotak });
          }}
        />
      )}

      {!bisaIsiSiapaPun && (
        <p className="mt-4 text-sm text-muted">Akses Anda hanya untuk melihat agenda tim.</p>
      )}

      {popover !== null && (
        <AgendaPopover
          jangkar={popover.kotak}
          judul={
            popover.jenis === "slot"
              ? `Agenda baru — ${formatDate(popover.tanggal)}`
              : draft !== null
                ? "Ubah Agenda"
                : `${popover.bar.kind} · ${popover.bar.entries.length} agenda`
          }
          onTutup={tutupPopover}
        >
          {gagal && (
            <p
              role="alert"
              className="mb-3 rounded-lg border border-high/30 bg-high/10 p-2 text-sm text-high"
            >
              {gagal}
            </p>
          )}

          {draft !== null ? (
            <AgendaForm
              rapat
              draft={draft}
              errors={errors}
              editId={editId}
              users={users}
              projects={projects}
              viewer={viewer}
              pending={pending}
              set={set}
              simpan={simpan}
              hapus={hapus}
              tutup={tutupPopover}
            />
          ) : (
            popover.jenis === "agenda" && (
              <div>
                <p className="text-sm text-muted">
                  {popover.bar.entries.length} agenda yang tanggalnya bersambung. Menyeretnya
                  memindahkan semuanya; untuk satu entri saja, ubah dari sini.
                </p>
                <ul className="mt-3 grid gap-2">
                  {popover.bar.entries.map((e) => (
                    <li key={e.id} className="rounded-lg bg-background px-3 py-2 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="tabular-nums">
                          {formatDate(e.startDate)} – {formatDate(e.endDate)}
                        </span>
                        {canEditAgenda(viewer, e) && (
                          <button
                            type="button"
                            onClick={() => bukaEntri(e)}
                            className="rounded-lg border border-border px-2 py-1 text-xs text-muted hover:bg-surface"
                          >
                            Ubah
                          </button>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted">{e.note || "Tanpa catatan"}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )
          )}
        </AgendaPopover>
      )}
    </div>
  );
}
