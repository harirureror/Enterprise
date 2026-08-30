export default function StatCard({
  label,
  value,
  hint,
  accent = "text-foreground",
  danger = false,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accent?: string;
  /** Kartu peringatan: garis dan angka merah, plus noda sudut. */
  danger?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border bg-surface p-5 shadow-card ${
        danger ? "border-high/30" : "border-border"
      }`}
    >
      {danger && (
        <span
          aria-hidden
          className="absolute -top-4 -right-4 h-16 w-16 rounded-bl-full bg-high/10"
        />
      )}
      <p
        className={`text-label-caps font-bold uppercase ${danger ? "text-high" : "text-muted"}`}
      >
        {label}
      </p>
      <p className={`relative mt-3 text-headline-lg font-semibold tabular-nums ${accent}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
