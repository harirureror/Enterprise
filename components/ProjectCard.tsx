import Link from "next/link";
import type { Project } from "@/lib/types";
import { getUser } from "@/lib/mock-data";
import { formatDate, priorityClass, statusClass, typeClass } from "@/lib/ui";
import Badge from "./Badge";

export default function ProjectCard({ project }: { project: Project }) {
  const owner = getUser(project.ownerId);
  const urgent = project.priority === "Tinggi";
  const highlight = urgent ? "border-high/30" : "border-border";

  return (
    <article className={`rounded-xl border ${highlight} bg-surface p-5 shadow-card`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold leading-snug">
            <Link href={`/proyek/${project.id}`} className="hover:underline">
              {project.name}
            </Link>
          </h3>
          {project.clientOrg && (
            <p className="mt-0.5 truncate text-xs text-muted">{project.clientOrg}</p>
          )}
          <p className="mt-1 text-sm text-muted line-clamp-2">{project.description}</p>
        </div>
        <Badge className={priorityClass[project.priority]}>
          {urgent ? "Prioritas Tinggi" : project.priority}
        </Badge>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge className={statusClass[project.status]}>{project.status}</Badge>
        <Badge className={typeClass[project.type]}>{project.type}</Badge>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>Progres</span>
          <span className="tabular-nums">{project.progressPct}%</span>
        </div>
        <div
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-border/70"
          role="progressbar"
          aria-valuenow={project.progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Progres ${project.name}`}
        >
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${project.progressPct}%` }}
          />
        </div>
      </div>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted">
        <div className="flex gap-1">
          <dt>PIC:</dt>
          <dd className="text-foreground">{owner?.name ?? "—"}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Tenggat:</dt>
          <dd className="text-foreground">{formatDate(project.deadline)}</dd>
        </div>
      </dl>
    </article>
  );
}
