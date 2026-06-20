import { config } from "../config.js";
import type { JobPosting, MatchedJob } from "../types.js";
import { normalizeText } from "./normalize.js";

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

export const matchJob = (job: JobPosting): MatchedJob | undefined => {
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

  const techMatches = containsAny(searchableText, config.requiredTechTerms);
  if (techMatches.length === 0) return undefined;

  const seniorityMatches = containsAny(searchableText, config.seniorityTerms);
  if (seniorityMatches.length === 0) return undefined;

  const spanishMatches = containsAny(searchableText, config.spanishSignals);
  const regionMatches = containsAny(searchableText, config.regionSignals);
  if (config.requireRegionSignal && regionMatches.length === 0) return undefined;

  const europeMatches = containsAny(searchableText, config.europeSignals);
  const acceptableEnglishMatches = containsAny(searchableText, config.acceptableEnglishTerms);
  const blockedEnglishMatches = containsAny(searchableText, config.blockedEnglishTerms);
  const isEuropeWithAcceptableEnglish =
    europeMatches.length > 0 && acceptableEnglishMatches.length > 0 && blockedEnglishMatches.length === 0;

  if (config.requireSpanishSignal && spanishMatches.length === 0 && !isEuropeWithAcceptableEnglish) {
    return undefined;
  }

  if (config.requireEuropeSpanishOrB2English && europeMatches.length > 0) {
    if (blockedEnglishMatches.length > 0) return undefined;

    if (spanishMatches.length === 0 && acceptableEnglishMatches.length === 0) {
      return undefined;
    }
  }

  const remoteMatches = containsAny(searchableText, config.remoteTerms);
  const contractMatches = containsAny(searchableText, config.contractTerms);
  if (config.requireRemoteOrContractSignal && remoteMatches.length === 0 && contractMatches.length === 0) {
    return undefined;
  }

  const reasons = [
    `Tecnologia: ${techMatches.slice(0, 2).join(", ")}`,
    `Seniority: ${seniorityMatches.slice(0, 2).join(", ")}`
  ];

  if (spanishMatches.length > 0) {
    reasons.push(`Senal ES/LATAM: ${spanishMatches.slice(0, 2).join(", ")}`);
  }

  if (regionMatches.length > 0) {
    reasons.push(`Region: ${regionMatches.slice(0, 2).join(", ")}`);
  }

  if (acceptableEnglishMatches.length > 0) {
    reasons.push(`Ingles aceptable: ${acceptableEnglishMatches.slice(0, 2).join(", ")}`);
  }

  if (remoteMatches.length > 0) {
    reasons.push(`Modalidad: ${remoteMatches.slice(0, 2).join(", ")}`);
  }

  if (contractMatches.length > 0) {
    reasons.push(`Contrato: ${contractMatches.slice(0, 2).join(", ")}`);
  }

  return {
    ...job,
    score:
      techMatches.length * 3 +
      seniorityMatches.length * 2 +
      spanishMatches.length +
      regionMatches.length * 2 +
      acceptableEnglishMatches.length +
      remoteMatches.length +
      contractMatches.length,
    reasons
  };
};
