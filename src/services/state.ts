import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { MatchedJob } from "../types.js";

const stateFile = new URL("../../data/seen-jobs.json", import.meta.url);

const readSeenIds = async (): Promise<Set<string>> => {
  try {
    const raw = await readFile(stateFile, "utf8");
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
};

export const keepUnseenJobs = async (jobs: MatchedJob[]): Promise<MatchedJob[]> => {
  const seenIds = await readSeenIds();
  return jobs.filter((job) => !seenIds.has(job.id));
};

export const markJobsAsSeen = async (jobs: MatchedJob[]): Promise<void> => {
  const seenIds = await readSeenIds();

  for (const job of jobs) {
    seenIds.add(job.id);
  }

  await mkdir(dirname(stateFile.pathname), { recursive: true });
  await writeFile(stateFile, JSON.stringify([...seenIds].slice(-1000), null, 2));
};
