import { describe, expect, it } from "vitest";
import { preselectJobCandidate } from "../src/agent/preselectJobs.js";
import { momNursingProfile, sisterBakeryProfile } from "../src/config.js";
import { shouldSendAiMatchedJob } from "../src/services/aiMatcher.js";
import { renderTextDigest } from "../src/services/digest.js";
import { extractVisiblePageDate } from "../src/services/freshness.js";
import { filterNursingCriticalExclusions, isAgeCompatibleForYuly } from "../src/services/nursingFilters.js";
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
    expect(result?.reasons.join(" ")).toContain("Senales objetivo");
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

  it("preselecciona enfermeria domiciliaria y cuidado de pacientes para el perfil de Yuly", () => {
    const result = preselectJobCandidate(
      {
        ...baseJob,
        title: "Enfermera domiciliaria para adulto mayor",
        location: "Caracas, Distrito Capital",
        description:
          "Se solicita licenciada en enfermeria para cuidado de heridas, administracion de tratamiento, bano en cama y alimentacion por sonda."
      },
      momNursingProfile
    );

    expect(result).toBeDefined();
  });

  it("rechaza ventas medicas para el perfil de Yuly", () => {
    const result = preselectJobCandidate(
      {
        ...baseJob,
        title: "Representante de ventas medicas",
        location: "Caracas",
        description: "Ventas de insumos medicos y atencion comercial a clientes."
      },
      momNursingProfile
    );

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

  it("acepta ofertas presenciales de enfermeria para el perfil de Yuly", () => {
    const shouldSend = shouldSendAiMatchedJob(
      {
        ...baseJob,
        score: 80,
        reasons: ["Senales objetivo: enfermera"],
        aiEvaluation: {
          ...goodEvaluation,
          compatibilityScore: 78,
          recommendation: "aplicar",
          summary: "Oferta presencial de enfermeria domiciliaria en Caracas.",
          matchReasons: ["Caracas", "Cuidado de pacientes"],
          frontendFit: "medio",
          backendWeight: "bajo",
          englishRequirement: "not_specified",
          remoteFit: "Presencial en Caracas",
          remoteScope: "onsite",
          roleFocus: "other",
          spanishFit: "spanish_offer"
        }
      } as MatchedJob,
      momNursingProfile
    );

    expect(shouldSend).toBe(true);
  });

  it("acepta ofertas revisar de enfermeria para el perfil de Yuly", () => {
    const shouldSend = shouldSendAiMatchedJob(
      {
        ...baseJob,
        score: 20,
        reasons: ["Senales objetivo: enfermera"],
        aiEvaluation: {
          ...goodEvaluation,
          compatibilityScore: 20,
          recommendation: "revisar",
          summary: "Oferta relacionada con enfermeria en Caracas.",
          matchReasons: ["Enfermeria", "Caracas"],
          concerns: ["Confirmar horario"],
          frontendFit: "bajo",
          backendWeight: "alto",
          englishRequirement: "unknown",
          remoteFit: "Presencial en Caracas",
          remoteScope: "onsite",
          roleFocus: "other",
          spanishFit: "not_specified"
        }
      } as MatchedJob,
      momNursingProfile
    );

    expect(shouldSend).toBe(true);
  });

  it("acepta ofertas revisar de pasteleria para el perfil de Yuliana", () => {
    const shouldSend = shouldSendAiMatchedJob(
      {
        ...baseJob,
        score: 20,
        reasons: ["Senales objetivo: pasteleria"],
        aiEvaluation: {
          ...goodEvaluation,
          compatibilityScore: 20,
          recommendation: "revisar",
          summary: "Oferta relacionada con pasteleria en Caracas.",
          matchReasons: ["Pasteleria", "Caracas"],
          concerns: ["Confirmar horario"],
          frontendFit: "bajo",
          backendWeight: "alto",
          englishRequirement: "unknown",
          remoteFit: "Presencial en Caracas",
          remoteScope: "onsite",
          roleFocus: "other",
          spanishFit: "not_specified"
        }
      } as MatchedJob,
      sisterBakeryProfile
    );

    expect(shouldSend).toBe(true);
  });

  it("no bloquea ofertas de pasteleria de Yuliana por clasificacion IA estricta", () => {
    const shouldSend = shouldSendAiMatchedJob(
      {
        ...baseJob,
        title: "Pastelero/a - con experiencia",
        score: 20,
        reasons: ["Senales objetivo: pasteleria"],
        aiEvaluation: {
          ...goodEvaluation,
          compatibilityScore: 0,
          recommendation: "descartar",
          summary: "Oferta de pasteleria en Caracas que conviene revisar manualmente.",
          matchReasons: ["Pasteleria", "Caracas"],
          concerns: ["Confirmar requisitos de experiencia"],
          frontendFit: "bajo",
          backendWeight: "alto",
          englishRequirement: "unknown",
          remoteFit: "Presencial en Caracas",
          remoteScope: "onsite",
          roleFocus: "backend",
          spanishFit: "not_specified"
        }
      } as MatchedJob,
      sisterBakeryProfile
    );

    expect(shouldSend).toBe(true);
  });
});

describe("extractVisiblePageDate", () => {
  it("detecta fechas visibles en ingles", () => {
    const date = extractVisiblePageDate("<main><p>February 18, 2026</p></main>");

    expect(date?.toISOString().slice(0, 10)).toBe("2026-02-18");
  });

  it("detecta fechas visibles en espanol", () => {
    const date = extractVisiblePageDate("<main><p>18 de febrero de 2026</p></main>");

    expect(date?.toISOString().slice(0, 10)).toBe("2026-02-18");
  });
});

describe("momNursingProfile", () => {
  it("esta configurado como fuente directa sin IA", () => {
    expect(momNursingProfile.id).toBe("mom-nursing-caracas");
    expect(momNursingProfile.sourceMode).toBe("serpapi_only");
    expect(momNursingProfile.maxJobsPerEmail).toBeGreaterThan(0);
  });
});

describe("filterNursingCriticalExclusions", () => {
  it("descarta ofertas con edad maxima menor a 59", () => {
    const { jobs } = filterNursingCriticalExclusions([
      {
        ...baseJob,
        title: "Enfermera domiciliaria",
        description: "Edad entre 25 a 45 años. Cuidado de pacientes en Caracas.",
        score: 1,
        reasons: []
      } as MatchedJob
    ]);

    expect(jobs).toHaveLength(0);
    expect(isAgeCompatibleForYuly("Edad mayor de 25 años")).toBe(true);
    expect(isAgeCompatibleForYuly("Edad hasta 45 años")).toBe(false);
  });

  it("descarta emergencias ambulancia y terapia intensiva", () => {
    const { jobs } = filterNursingCriticalExclusions([
      {
        ...baseJob,
        title: "Enfermero ambulancia",
        description: "Atencion de emergencias, trauma, triaje y traslados criticos.",
        score: 1,
        reasons: []
      } as MatchedJob
    ]);

    expect(jobs).toHaveLength(0);
  });

  it("descarta ventas comerciales", () => {
    const { jobs } = filterNursingCriticalExclusions([
      {
        ...baseJob,
        title: "Enfermera ventas equipos medicos",
        description: "Asesor comercial y ventas de equipos medicos.",
        score: 1,
        reasons: []
      } as MatchedJob
    ]);

    expect(jobs).toHaveLength(0);
  });
});
