import type { JobProfile, MatchedJob } from "../types.js";

const formatDate = (date?: Date): string => {
  if (!date) return "Fecha no disponible";
  return new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
};

export const renderTextDigest = (jobs: MatchedJob[], profile?: JobProfile): string => {
  const isTechProfile = !profile || profile.sourceMode === "tech";

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
        job.aiEvaluation
          ? [
              `Compatibilidad IA: ${job.aiEvaluation.compatibilityScore}/100 (${job.aiEvaluation.recommendation})`,
              `Resumen IA: ${job.aiEvaluation.summary}`,
              isTechProfile
                ? `Fit Frontend: ${job.aiEvaluation.frontendFit}`
                : `Fit con el perfil: ${job.aiEvaluation.frontendFit}`,
              isTechProfile
                ? `Peso Backend: ${job.aiEvaluation.backendWeight}`
                : `Peso fuera del foco: ${job.aiEvaluation.backendWeight}`,
              `Foco del rol: ${job.aiEvaluation.roleFocus}`,
              `Ingles: ${job.aiEvaluation.englishLevel} (${job.aiEvaluation.englishRequirement})`,
              job.aiEvaluation.salaryRange && job.aiEvaluation.salaryRange !== "No indicado"
                ? `Rango salarial IA: ${job.aiEvaluation.salaryRange}`
                : undefined,
              `Remoto/Region: ${job.aiEvaluation.remoteFit}`,
              `Alcance remoto: ${job.aiEvaluation.remoteScope}`,
              `Senal espanol: ${job.aiEvaluation.spanishFit}`,
              job.aiEvaluation.matchReasons.length > 0
                ? `Por que matchea: ${job.aiEvaluation.matchReasons.join(" | ")}`
                : undefined,
              job.aiEvaluation.concerns.length > 0
                ? `Dudas/Riesgos: ${job.aiEvaluation.concerns.join(" | ")}`
                : undefined
            ]
              .filter(Boolean)
              .join("\n")
          : undefined,
        `Link: ${job.url}`
      ]
        .filter(Boolean)
        .join("\n")
    )
  ].join("\n\n");
};

export const renderHtmlDigest = (jobs: MatchedJob[], profile?: JobProfile): string => {
  const isTechProfile = !profile || profile.sourceMode === "tech";

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
          ${
            job.aiEvaluation
              ? `
                <p><strong>Compatibilidad IA:</strong> ${job.aiEvaluation.compatibilityScore}/100 (${job.aiEvaluation.recommendation})</p>
                <p><strong>Resumen IA:</strong> ${job.aiEvaluation.summary}</p>
                <p><strong>${isTechProfile ? "Fit Frontend" : "Fit con el perfil"}:</strong> ${job.aiEvaluation.frontendFit}</p>
                <p><strong>${isTechProfile ? "Peso Backend" : "Peso fuera del foco"}:</strong> ${job.aiEvaluation.backendWeight}</p>
                <p><strong>Foco del rol:</strong> ${job.aiEvaluation.roleFocus}</p>
                <p><strong>Ingles:</strong> ${job.aiEvaluation.englishLevel} (${job.aiEvaluation.englishRequirement})</p>
                ${
                  job.aiEvaluation.salaryRange && job.aiEvaluation.salaryRange !== "No indicado"
                    ? `<p><strong>Rango salarial IA:</strong> ${job.aiEvaluation.salaryRange}</p>`
                    : ""
                }
                <p><strong>Remoto/Region:</strong> ${job.aiEvaluation.remoteFit}</p>
                <p><strong>Alcance remoto:</strong> ${job.aiEvaluation.remoteScope}</p>
                <p><strong>Senal espanol:</strong> ${job.aiEvaluation.spanishFit}</p>
                ${
                  job.aiEvaluation.matchReasons.length > 0
                    ? `<p><strong>Por que matchea:</strong> ${job.aiEvaluation.matchReasons.join(" | ")}</p>`
                    : ""
                }
                ${
                  job.aiEvaluation.concerns.length > 0
                    ? `<p><strong>Dudas/Riesgos:</strong> ${job.aiEvaluation.concerns.join(" | ")}</p>`
                    : ""
                }
              `
              : ""
          }
        </li>
      `
    )
    .join("");

  return `
    <h2>Ofertas encontradas: ${jobs.length}</h2>
    <ol>${items}</ol>
  `;
};
