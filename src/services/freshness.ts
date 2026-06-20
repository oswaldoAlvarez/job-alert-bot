import { isRecent, stripHtml } from "../filters/normalize.js";
import type { JobProfile, MatchedJob } from "../types.js";

const monthNames: Record<string, number> = {
  january: 0,
  jan: 0,
  febrero: 1,
  february: 1,
  feb: 1,
  marzo: 2,
  march: 2,
  mar: 2,
  abril: 3,
  april: 3,
  apr: 3,
  mayo: 4,
  may: 4,
  junio: 5,
  june: 5,
  jun: 5,
  julio: 6,
  july: 6,
  jul: 6,
  agosto: 7,
  august: 7,
  aug: 7,
  septiembre: 8,
  setiembre: 8,
  september: 8,
  sep: 8,
  sept: 8,
  octubre: 9,
  october: 9,
  oct: 9,
  noviembre: 10,
  november: 10,
  nov: 10,
  diciembre: 11,
  december: 11,
  dec: 11,
  dic: 11
};

const googleJobsSources = ["Google Jobs", "LinkedIn via Google Jobs"];

const shouldVerifyPageDate = (job: MatchedJob): boolean =>
  googleJobsSources.some((source) => job.source.includes(source));

export const extractVisiblePageDate = (html: string): Date | undefined => {
  const text = stripHtml(html).slice(0, 12000);
  const patterns = [
    /\b([A-Za-zñÑáéíóúÁÉÍÓÚ]+)\s+(\d{1,2}),\s*(20\d{2})\b/g,
    /\b(\d{1,2})\s+(?:de\s+)?([A-Za-zñÑáéíóúÁÉÍÓÚ]+)\s+(?:de\s+)?(20\d{2})\b/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const monthFirst = Number.isNaN(Number(match[1]));
      const monthName = (monthFirst ? match[1] : match[2]).toLowerCase();
      const day = Number(monthFirst ? match[2] : match[1]);
      const year = Number(match[3]);
      const month = monthNames[monthName];

      if (month === undefined || !Number.isFinite(day) || day < 1 || day > 31) continue;

      const parsed = new Date(Date.UTC(year, month, day));
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
  }

  return undefined;
};

const fetchPageDate = async (url: string): Promise<Date | undefined> => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "job-alert-bot/0.1"
    },
    signal: AbortSignal.timeout(8000)
  });

  if (!response.ok) return undefined;

  return extractVisiblePageDate(await response.text());
};

export const filterFreshJobsByLandingPage = async (
  jobs: MatchedJob[],
  profile: JobProfile
): Promise<{ jobs: MatchedJob[]; staleCount: number }> => {
  const filtered: MatchedJob[] = [];
  let staleCount = 0;

  for (const job of jobs) {
    if (!shouldVerifyPageDate(job)) {
      filtered.push(job);
      continue;
    }

    try {
      const pageDate = await fetchPageDate(job.url);
      if (pageDate && !isRecent(pageDate, profile.lookbackDays)) {
        staleCount += 1;
        console.log(
          `Oferta descartada por fecha real antigua: ${job.title} (${new Intl.DateTimeFormat("es", {
            dateStyle: "medium"
          }).format(pageDate)})`
        );
        continue;
      }

      if (!pageDate) {
        staleCount += 1;
        console.log(`Oferta descartada porque no se pudo verificar fecha real: ${job.title}`);
        continue;
      }

      filtered.push({ ...job, publishedAt: pageDate });
    } catch (error) {
      console.warn(`No se pudo verificar fecha real de "${job.title}": ${error}`);
      staleCount += 1;
    }
  }

  return { jobs: filtered, staleCount };
};
