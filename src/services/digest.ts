import type { MatchedJob } from "../types.js";

const formatDate = (date?: Date): string => {
  if (!date) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
};

export const renderTextDigest = (jobs: MatchedJob[]): string => {
  if (jobs.length === 0) {
    return "Hoy no se encontraron ofertas nuevas que cumplan los filtros.";
  }

  return [
    `Ofertas encontradas: ${jobs.length}`,
    "",
    ...jobs.map((job, index) =>
      [
        `${index + 1}. ${job.title}`,
        `Empresa: ${job.company}`,
        `Fuente: ${job.source}`,
        `Ubicacion: ${job.location ?? "No indicada"}`,
        `Publicado: ${formatDate(job.publishedAt)}`,
        job.salary ? `Salario: ${job.salary}` : undefined,
        `Motivo: ${job.reasons.join(" | ")}`,
        `Link: ${job.url}`
      ]
        .filter(Boolean)
        .join("\n")
    )
  ].join("\n\n");
};

export const renderHtmlDigest = (jobs: MatchedJob[]): string => {
  if (jobs.length === 0) {
    return "<p>Hoy no se encontraron ofertas nuevas que cumplan los filtros.</p>";
  }

  const items = jobs
    .map(
      (job) => `
        <li>
          <h3><a href="${job.url}">${job.title}</a></h3>
          <p><strong>Empresa:</strong> ${job.company}</p>
          <p><strong>Fuente:</strong> ${job.source}</p>
          <p><strong>Ubicacion:</strong> ${job.location ?? "No indicada"}</p>
          <p><strong>Publicado:</strong> ${formatDate(job.publishedAt)}</p>
          ${job.salary ? `<p><strong>Salario:</strong> ${job.salary}</p>` : ""}
          <p><strong>Motivo:</strong> ${job.reasons.join(" | ")}</p>
        </li>
      `
    )
    .join("");

  return `
    <h2>Ofertas encontradas: ${jobs.length}</h2>
    <ol>${items}</ol>
  `;
};
