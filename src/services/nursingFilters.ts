import { normalizeText } from "../filters/normalize.js";
import type { MatchedJob } from "../types.js";

const momAge = 59;

const blockedCriticalTerms = [
  "emergencia",
  "emergencias",
  "paramedico",
  "paramédico",
  "ambulancia",
  "ambulancias",
  "area critica",
  "área crítica",
  "areas criticas",
  "áreas críticas",
  "terapia intensiva",
  "unidad de cuidados intensivos",
  "uci",
  "trauma",
  "triaje",
  "triage",
  "rescate",
  "soporte vital",
  "traslado critico",
  "traslado crítico",
  "traslados criticos",
  "traslados críticos",
  "traslado asistido"
];

const blockedNonNursingTerms = [
  "ventas",
  "venta",
  "vendedor",
  "vendedora",
  "representante de ventas",
  "asesor comercial",
  "asesora comercial",
  "comercial",
  "marketing",
  "promotor",
  "promotora",
  "call center",
  "atencion al cliente",
  "atención al cliente",
  "recepcionista",
  "administrativo",
  "administrativa"
];

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasTerm = (text: string, term: string): boolean => {
  const normalizedTerm = normalizeText(term).trim();
  if (!normalizedTerm) return false;

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}([^a-z0-9]|$)`, "i");
  return pattern.test(text);
};

const hasAny = (text: string, terms: string[]): string | undefined =>
  terms.find((term) => hasTerm(text, term));

const maxAgeFromText = (text: string): number | undefined => {
  const patterns = [
    /(?:edad|anos|años).{0,30}(?:hasta|maxima|maximo|máxima|máximo).{0,10}(\d{2})/g,
    /(?:hasta|maxima|maximo|máxima|máximo).{0,10}(\d{2}).{0,20}(?:anos|años|edad)/g,
    /(?:edad|anos|años).{0,30}(?:entre|de)?\s*(\d{2})\s*(?:a|-|y)\s*(\d{2})/g,
    /(\d{2})\s*(?:a|-)\s*(\d{2})\s*(?:anos|años)/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const upper = Number(match[2] ?? match[1]);
      if (Number.isFinite(upper)) return upper;
    }
  }

  return undefined;
};

const rejectionReason = (job: MatchedJob): string | undefined => {
  const text = normalizeText([job.title, job.company, job.location, job.description, job.tags.join(" ")].join(" "));
  const blockedCritical = hasAny(text, blockedCriticalTerms);
  if (blockedCritical) return `area critica/emergencia detectada: ${blockedCritical}`;

  const blockedNonNursing = hasAny(text, blockedNonNursingTerms);
  if (blockedNonNursing) return `fuera de enfermeria asistencial: ${blockedNonNursing}`;

  const maxAge = maxAgeFromText(text);
  if (maxAge !== undefined && maxAge < momAge) return `edad maxima incompatible (${maxAge})`;

  return undefined;
};

export const filterNursingCriticalExclusions = (
  jobs: MatchedJob[]
): { jobs: MatchedJob[]; rejectedCount: number } => {
  const filtered: MatchedJob[] = [];
  let rejectedCount = 0;

  for (const job of jobs) {
    const reason = rejectionReason(job);
    if (reason) {
      rejectedCount += 1;
      console.log(`Oferta de enfermeria descartada por filtro critico: ${job.title} (${reason})`);
      continue;
    }

    filtered.push(job);
  }

  return { jobs: filtered, rejectedCount };
};

export const isAgeCompatibleForYuly = (text: string): boolean => {
  const maxAge = maxAgeFromText(normalizeText(text));
  return maxAge === undefined || maxAge >= momAge;
};
