import { config } from "../config.js";
import type { JobPosting, JobProfile, MatchedJob } from "../types.js";
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

export const preselectJobCandidate = (job: JobPosting, profile?: JobProfile): MatchedJob | undefined => {
  const requiredTerms = profile?.requiredTerms ?? config.requiredTechTerms;
  const optionalTerms = profile?.optionalTerms ?? [];
  const exclusionTerms = profile?.exclusionTerms ?? config.exclusionTerms;
  const blockedTerms = profile?.blockedTerms ?? config.blockedRegionTerms;
  const positiveSignals = profile?.positiveSignals ?? [
    ...config.seniorityTerms,
    ...config.remoteTerms,
    ...config.contractTerms,
    ...config.regionSignals
  ];
  const searchableText = normalizeText(
    [
      job.title,
      job.company,
      job.location,
      job.description,
      job.tags.join(" ")
    ].join(" ")
  );

  const excluded = containsAny(searchableText, exclusionTerms);
  if (excluded.length > 0) return undefined;

  const blocked = containsAny(searchableText, blockedTerms);
  if (blocked.length > 0) return undefined;

  const requiredMatches = containsAny(searchableText, requiredTerms);
  const optionalMatches = containsAny(searchableText, optionalTerms);
  if (requiredMatches.length === 0 && optionalMatches.length === 0) return undefined;

  const seniorityMatches = containsAny(searchableText, config.seniorityTerms);
  const remoteMatches = containsAny(searchableText, config.remoteTerms);
  const contractMatches = containsAny(searchableText, config.contractTerms);
  const regionMatches = containsAny(searchableText, config.regionSignals);
  const positiveMatches = containsAny(searchableText, positiveSignals);
  const englishMatches = [
    ...containsAny(searchableText, config.acceptableEnglishTerms),
    ...containsAny(searchableText, config.blockedEnglishTerms)
  ];

  const reasons = [
    `Senales objetivo: ${[...requiredMatches, ...optionalMatches].slice(0, 3).join(", ")}`
  ];

  if (seniorityMatches.length > 0) reasons.push(`Seniority detectado: ${seniorityMatches.slice(0, 2).join(", ")}`);
  if (remoteMatches.length > 0) reasons.push(`Remoto detectado: ${remoteMatches.slice(0, 2).join(", ")}`);
  if (contractMatches.length > 0) reasons.push(`Contrato detectado: ${contractMatches.slice(0, 2).join(", ")}`);
  if (regionMatches.length > 0) reasons.push(`Region detectada: ${regionMatches.slice(0, 2).join(", ")}`);
  if (positiveMatches.length > 0) reasons.push(`Senales positivas: ${positiveMatches.slice(0, 2).join(", ")}`);
  if (englishMatches.length > 0) reasons.push(`Ingles detectado: ${englishMatches.slice(0, 2).join(", ")}`);

  return {
    ...job,
    score:
      requiredMatches.length * 2 +
      optionalMatches.length +
      seniorityMatches.length +
      remoteMatches.length +
      contractMatches.length +
      regionMatches.length +
      positiveMatches.length,
    reasons
  };
};

export const preselectJobCandidates = (jobs: JobPosting[], profile?: JobProfile): MatchedJob[] =>
  jobs
    .map((job) => preselectJobCandidate(job, profile))
    .filter((job): job is MatchedJob => Boolean(job));
