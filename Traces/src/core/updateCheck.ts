// SPDX-License-Identifier: AGPL-3.0-or-later

export const VERSION_URL = 'https://felipsarroca.github.io/util-apps/Traces/version.json';
export const UPDATE_PAGE_URL = 'https://felipsarroca.github.io/util-apps/Traces/#actualitzar';

export interface UpdateInfo {
  version: string;
  notes: string[];
  url: string;
}

/** Retorna >0 si a és més nova que b, 0 si són iguals i <0 si és més antiga. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function getCurrentVersion(): string {
  try {
    return chrome.runtime.getManifest().version;
  } catch {
    return '0.0.0';
  }
}

/** Consulta el fitxer públic version.json (no envia cap dada: és una simple lectura). */
export async function checkForUpdate(currentVersion: string): Promise<UpdateInfo | null> {
  try {
    const resp = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) return null;
    const data = await resp.json();
    if (typeof data?.version !== 'string') return null;
    if (compareVersions(data.version, currentVersion) <= 0) return null;
    return {
      version: data.version,
      notes: Array.isArray(data.notes) ? data.notes.slice(0, 4).map(String) : [],
      url: typeof data.url === 'string' ? data.url : UPDATE_PAGE_URL,
    };
  } catch {
    return null;
  }
}
