import { renderFetch } from './renderAuth';
export interface YoutubeCookieStatus { configured: boolean; enabled: boolean; updatedAt: number | null }
export async function youtubeAdminRequest(server: string, init?: RequestInit): Promise<YoutubeCookieStatus> {
  const response = await renderFetch(`${server.replace(/\/+$/, '')}/admin/youtube`, init);
  const data = await response.json().catch(() => ({})) as YoutubeCookieStatus & { erro?: string };
  if (!response.ok) throw new Error(data.erro || 'Não foi possível acessar os cookies. Atualize o servidor de renderização.');
  return data;
}
export function canUploadCookies(pageUrl: string, serverUrl: string): boolean {
  try {
    const page = new URL(pageUrl), server = new URL(serverUrl);
    const secure = (url: URL) => url.protocol === 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    return secure(page) && secure(server);
  } catch { return false; }
}