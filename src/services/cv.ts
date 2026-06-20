import { stripHtml } from "../filters/normalize.js";

export const fetchCvText = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    headers: {
      "user-agent": "job-alert-bot/0.1"
    }
  });

  if (!response.ok) {
    throw new Error(`No se pudo leer el CV (${response.status})`);
  }

  const html = await response.text();
  return stripHtml(html).slice(0, 12000);
};
