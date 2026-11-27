import { createId } from './uuid';

export const LOCAL_HELPER_ORIGIN = 'http://127.0.0.1:47831';
export function isLocalAudioMessage(event: MessageEvent, popup: Window, requestId: string): boolean {
  const data = event.data as Record<string, unknown> | null;
  return event.origin === LOCAL_HELPER_ORIGIN && event.source === popup && !!data &&
    data['type'] === 'motionmro-local-audio' && data['requestId'] === requestId &&
    typeof data['name'] === 'string' && data['buffer'] instanceof ArrayBuffer &&
    data['buffer'].byteLength > 0 && data['buffer'].byteLength <= 300 * 1024 * 1024;
}
/** All cookie access happens in the companion's own local window, never in the app or VPS. */
export function downloadFromMyBrowser(url: string): Promise<File> {
  const requestId = createId();
  const params = new URLSearchParams({ origin: window.location.origin, requestId, url });
  const popup = window.open(`${LOCAL_HELPER_ORIGIN}/connect?${params}`, '_blank', 'popup,width=600,height=740');
  if (!popup) return Promise.reject(new Error('Permita a abertura da janela do auxiliar neste site.'));
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timeout); clearInterval(closed); window.removeEventListener('message', receive); };
    const receive = (event: MessageEvent) => {
      if (!isLocalAudioMessage(event, popup, requestId)) return;
      const data = event.data as { name: string; buffer: ArrayBuffer };
      cleanup();
      resolve(new File([data.buffer], `${data.name.slice(0, 180)}.wav`, { type: 'audio/wav' }));
    };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('O auxiliar não respondeu. Inicie o auxiliar no computador e tente novamente.')); }, 10 * 60_000);
    const closed = setInterval(() => { if (popup.closed) { cleanup(); reject(new Error('Download local cancelado.')); } }, 500);
    window.addEventListener('message', receive);
  });
}