import { describe, expect, it } from "vitest";
import { matchJob } from "../src/filters/matchJob.js";
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

describe("matchJob", () => {
  it("acepta ofertas React Native senior para LATAM/espanol", () => {
    const result = matchJob(baseJob);

    expect(result).toBeDefined();
    expect(result?.reasons.join(" ")).toContain("Tecnologia");
  });

  it("rechaza ofertas junior aunque mencionen React", () => {
    const result = matchJob({
      ...baseJob,
      title: "Junior React Developer",
      description: "React remoto LATAM"
    });

    expect(result).toBeUndefined();
  });

  it("no descarta palabras en espanol que contienen intern como internas", () => {
    const result = matchJob({
      ...baseJob,
      title: "Senior Full-Stack React LATAM",
      description:
        "React senior remoto LATAM en espanol. Participaras en integraciones internas y APIs REST."
    });

    expect(result).toBeDefined();
  });

  it("rechaza ofertas sin senal de espanol o LATAM por defecto", () => {
    const result = matchJob({
      ...baseJob,
      location: "Remote US",
      description: "Senior React Native developer for US timezone."
    });

    expect(result).toBeUndefined();
  });

  it("acepta ofertas contractor para Europa", () => {
    const result = matchJob({
      ...baseJob,
      title: "Senior React Developer Contractor",
      location: "Remote Europe",
      description: "Spanish-speaking senior React contractor role for Europe timezone."
    });

    expect(result).toBeDefined();
    expect(result?.reasons.join(" ")).toContain("Region");
    expect(result?.reasons.join(" ")).toContain("Contrato");
  });

  it("acepta ofertas de Europa si piden ingles B2 aunque no mencionen espanol", () => {
    const result = matchJob({
      ...baseJob,
      title: "Senior React Developer",
      location: "Remote Europe",
      description: "Senior React developer contractor role. English B2 required.",
      tags: ["React"]
    });

    expect(result).toBeDefined();
    expect(result?.reasons.join(" ")).toContain("Ingles aceptable");
  });

  it("rechaza ofertas de Europa si piden ingles C1", () => {
    const result = matchJob({
      ...baseJob,
      title: "Senior React Developer",
      location: "Remote Europe",
      description: "Senior React developer contractor role. English C1 required. Spanish is a plus.",
      tags: ["React"]
    });

    expect(result).toBeUndefined();
  });

  it("rechaza ofertas de Europa sin espanol ni ingles B1/B2", () => {
    const result = matchJob({
      ...baseJob,
      title: "Senior React Developer",
      location: "Remote Europe",
      description: "Senior React developer contractor role for European timezone.",
      tags: ["React"]
    });

    expect(result).toBeUndefined();
  });

  it("rechaza ofertas sin senal de remoto freelance o contractor", () => {
    const result = matchJob({
      ...baseJob,
      location: "Madrid, Espana",
      description: "Buscamos senior React para equipo en espanol en Europa."
    });

    expect(result).toBeUndefined();
  });
});

describe("renderTextDigest", () => {
  it("incluye datos importantes de la oferta", () => {
    const digest = renderTextDigest([{ ...baseJob, score: 10, reasons: ["Tecnologia: react"] } as MatchedJob]);

    expect(digest).toContain("Senior React Native Developer");
    expect(digest).toContain("https://example.com/job");
  });
});
