import { config } from "../config.js";
import type { JobPosting, MatchedJob } from "../types.js";
import { normalizeText } from "../filters/normalize.js";

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasTerm = (text: string, term: string): boolean => {
  const normalizedTerm = normalizeText(term).trim();
  if (!normalizedTerm) return false;

  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedTerm)}([^a-z0-9]|$)`, "i");
  return pattern.test(text);
};

const containsAny = (text: string, terms: string[]): string[] => {
  const seen = new Set<string>();

  return terms.filter((term) => {
    const normalizedTerm = normalizeText(term).trim();
    if (seen.has(normalizedTerm) || !hasTerm(text, term)) return false;

    seen.add(normalizedTerm);
    return true;
  });
};

const candidateTechTerms = [
  ...config.requiredTechTerms,
  "next.js",
  "nextjs"
];

export const preselectJobCandidate = (job: JobPosting): MatchedJob | undefined => {
  const searchableText = normalizeText(
    [
      job.title,
      job.company,
      job.location,
      job.description,
      job.tags.join(" ")
    ].join(" ")
  );

  const excluded = containsAny(searchableText, config.exclusionTerms);
  if (excluded.length > 0) return undefined;

  const techMatches = containsAny(searchableText, candidateTechTerms);
  if (techMatches.length === 0) return undefined;

  const seniorityMatches = containsAny(searchableText, config.seniorityTerms);
  const remoteMatches = containsAny(searchableText, config.remoteTerms);
  const contractMatches = containsAny(searchableText, config.contractTerms);
  const regionMatches = containsAny(searchableText, config.regionSignals);
  const englishMatches = [
    ...containsAny(searchableText, config.acceptableEnglishTerms),
    ...containsAny(searchableText, config.blockedEnglishTerms)
  ];

  const reasons = [
    `Senales tecnicas: ${techMatches.slice(0, 3).join(", ")}`
  ];

  if (seniorityMatches.length > 0) reasons.push(`Seniority detectado: ${seniorityMatches.slice(0, 2).join(", ")}`);
  if (remoteMatches.length > 0) reasons.push(`Remoto detectado: ${remoteMatches.slice(0, 2).join(", ")}`);
  if (contractMatches.length > 0) reasons.push(`Contrato detectado: ${contractMatches.slice(0, 2).join(", ")}`);
  if (regionMatches.length > 0) reasons.push(`Region detectada: ${regionMatches.slice(0, 2).join(", ")}`);
  if (englishMatches.length > 0) reasons.push(`Ingles detectado: ${englishMatches.slice(0, 2).join(", ")}`);

  return {
    ...job,
    score:
      techMatches.length * 2 +
      seniorityMatches.length +
      remoteMatches.length +
      contractMatches.length +
      regionMatches.length,
    reasons
  };
};

export const preselectJobCandidates = (jobs: JobPosting[]): MatchedJob[] =>
  jobs
    .map(preselectJobCandidate)
    .filter((job): job is MatchedJob => Boolean(job));
