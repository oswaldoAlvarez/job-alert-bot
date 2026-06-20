import { describe, expect, it } from "vitest";
import { preselectJobCandidate } from "../src/agent/preselectJobs.js";
import { shouldSendAiMatchedJob } from "../src/services/aiMatcher.js";
import { renderTextDigest } from "../src/services/digest.js";
import type { JobPosting, MatchedJob } from "../src/types.js";

const baseJob: JobPosting = {
  id: "1",
  source: "Test",
  title: "Senior React Native Developer",
  company: "Acme",
  location: "Remoto LATAM",
  url: "https://example.com/job",
  description: "Buscamos dev senior con experiencia en React Native y equipos en espanol. Full remote LATAM.",
  tags: ["React Native"]
};

describe("preselectJobCandidate", () => {
  it("preselecciona ofertas React Native senior", () => {
    const result = preselectJobCandidate(baseJob);

    expect(result).toBeDefined();
    expect(result?.reasons.join(" ")).toContain("Senales tecnicas");
  });

  it("rechaza ofertas junior antes de gastar IA", () => {
    const result = preselectJobCandidate({
      ...baseJob,
      title: "Junior React Developer",
      description: "React remoto LATAM"
    });

    expect(result).toBeUndefined();
  });

  it("deja pasar ofertas fullstack con React para que la IA decida", () => {
    const result = preselectJobCandidate({
      ...baseJob,
      title: "Senior Full-Stack React LATAM",
      description:
        "React senior remoto LATAM en espanol. Participaras en integraciones internas, frontend y APIs REST."
    });

    expect(result).toBeDefined();
  });

  it("preselecciona ofertas con Next.js si parecen del stack objetivo", () => {
    const result = preselectJobCandidate({
      ...baseJob,
      title: "Senior Frontend Engineer React y Next.js",
      description: "React, Next.js y TypeScript. Remoto LATAM en espanol."
    });

    expect(result).toBeDefined();
  });

  it("rechaza ofertas de Brasil o portugues antes de gastar IA", () => {
    const result = preselectJobCandidate({
      ...baseJob,
      title: "Senior React Developer",
      location: "Remote Brazil",
      description: "React remoto para Brasil. Portuguese speaking required."
    });

    expect(result).toBeUndefined();
  });

  it("deja pasar ofertas de Europa aunque falte detalle de idioma para que la IA decida", () => {
    const result = preselectJobCandidate({
      ...baseJob,
      title: "Senior React Developer",
      location: "Remote Europe",
      description: "Senior React developer contractor role for European timezone.",
      tags: ["React"]
    });

    expect(result).toBeDefined();
  });
});

describe("renderTextDigest", () => {
  it("incluye datos importantes de la oferta", () => {
    const digest = renderTextDigest([{ ...baseJob, score: 10, reasons: ["Senales tecnicas: react"] } as MatchedJob]);

    expect(digest).toContain("Senior React Native Developer");
    expect(digest).toContain("https://example.com/job");
  });

  it("incluye evaluacion IA cuando existe", () => {
    const digest = renderTextDigest([
      {
        ...baseJob,
        score: 86,
        reasons: ["Senales tecnicas: react native"],
        aiEvaluation: {
          compatibilityScore: 86,
          recommendation: "aplicar",
          summary: "Buen match mobile/frontend.",
          matchReasons: ["React Native", "Fintech"],
          concerns: ["Confirmar salario"],
          frontendFit: "alto",
          backendWeight: "bajo",
          englishLevel: "B2 requerido",
          englishRequirement: "b2",
          salaryRange: "USD 4,000 - 6,000",
          remoteFit: "Full remote LATAM",
          remoteScope: "region_restricted",
          roleFocus: "mobile",
          spanishFit: "spanish_offer"
        }
      } as MatchedJob
    ]);

    expect(digest).toContain("Compatibilidad IA: 86/100");
    expect(digest).toContain("Buen match mobile/frontend.");
    expect(digest).toContain("Peso Backend: bajo");
    expect(digest).toContain("Rango salarial IA: USD 4,000 - 6,000");
  });
});

describe("shouldSendAiMatchedJob", () => {
  const goodEvaluation = {
    compatibilityScore: 92,
    recommendation: "aplicar" as const,
    summary: "Buen fit frontend remoto en espanol.",
    matchReasons: ["React", "Frontend alto"],
    concerns: [],
    frontendFit: "alto" as const,
    backendWeight: "bajo" as const,
    englishLevel: "B2 requerido",
    englishRequirement: "b2" as const,
    salaryRange: "No indicado",
    remoteFit: "Full remote LATAM",
    remoteScope: "region_restricted" as const,
    roleFocus: "frontend" as const,
    spanishFit: "spanish_offer" as const
  };

  it("envia solo ofertas aplicar con score alto y guardrails cumplidos", () => {
    const shouldSend = shouldSendAiMatchedJob({
      ...baseJob,
      score: 92,
      reasons: ["Senales tecnicas: react"],
      aiEvaluation: goodEvaluation
    } as MatchedJob);

    expect(shouldSend).toBe(true);
  });

  it("descarta ofertas con poco fit frontend y alto peso backend", () => {
    const shouldSend = shouldSendAiMatchedJob({
      ...baseJob,
      score: 80,
      reasons: ["Senales tecnicas: react"],
      aiEvaluation: {
        ...goodEvaluation,
        compatibilityScore: 95,
        recommendation: "aplicar",
        summary: "Oferta fullstack con foco backend.",
        matchReasons: ["Menciona React"],
        concerns: ["Backend dominante"],
        frontendFit: "bajo",
        backendWeight: "alto"
      }
    } as MatchedJob);

    expect(shouldSend).toBe(false);
  });

  it("descarta ofertas con ingles C1 o superior requerido", () => {
    const shouldSend = shouldSendAiMatchedJob({
      ...baseJob,
      score: 95,
      reasons: ["Senales tecnicas: react"],
      aiEvaluation: {
        ...goodEvaluation,
        compatibilityScore: 95,
        englishLevel: "C1 requerido",
        englishRequirement: "c1"
      }
    } as MatchedJob);

    expect(shouldSend).toBe(false);
  });

  it("descarta ofertas remotas restringidas a un pais especifico", () => {
    const shouldSend = shouldSendAiMatchedJob({
      ...baseJob,
      score: 95,
      reasons: ["Senales tecnicas: react"],
      aiEvaluation: {
        ...goodEvaluation,
        compatibilityScore: 95,
        remoteFit: "Remote Spain only",
        remoteScope: "country_restricted"
      }
    } as MatchedJob);

    expect(shouldSend).toBe(false);
  });

  it("descarta ofertas sin senal de espanol", () => {
    const shouldSend = shouldSendAiMatchedJob({
      ...baseJob,
      score: 95,
      reasons: ["Senales tecnicas: react"],
      aiEvaluation: {
        ...goodEvaluation,
        compatibilityScore: 95,
        spanishFit: "not_specified"
      }
    } as MatchedJob);

    expect(shouldSend).toBe(false);
  });

  it("acepta fullstack frontend con backend medio y score 80", () => {
    const shouldSend = shouldSendAiMatchedJob({
      ...baseJob,
      score: 80,
      reasons: ["Senales tecnicas: react"],
      aiEvaluation: {
        ...goodEvaluation,
        compatibilityScore: 80,
        summary: "Fullstack frontend con React, Next.js y algo de Node secundario.",
        matchReasons: ["React fuerte", "Backend secundario"],
        frontendFit: "medio",
        backendWeight: "medio",
        roleFocus: "fullstack_frontend"
      }
    } as MatchedJob);

    expect(shouldSend).toBe(true);
  });
});
