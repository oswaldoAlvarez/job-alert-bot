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
          englishLevel: "B2",
          remoteFit: "LATAM remoto"
        }
      } as MatchedJob
    ]);

    expect(digest).toContain("Compatibilidad IA: 86/100");
    expect(digest).toContain("Buen match mobile/frontend.");
    expect(digest).toContain("Peso Backend: bajo");
  });
});

describe("shouldSendAiMatchedJob", () => {
  it("descarta ofertas con poco fit frontend y alto peso backend", () => {
    const shouldSend = shouldSendAiMatchedJob({
      ...baseJob,
      score: 80,
      reasons: ["Senales tecnicas: react"],
      aiEvaluation: {
        compatibilityScore: 80,
        recommendation: "revisar",
        summary: "Oferta fullstack con foco backend.",
        matchReasons: ["Menciona React"],
        concerns: ["Backend dominante"],
        frontendFit: "bajo",
        backendWeight: "alto",
        englishLevel: "No indicado",
        remoteFit: "Remoto"
      }
    } as MatchedJob);

    expect(shouldSend).toBe(false);
  });
});
