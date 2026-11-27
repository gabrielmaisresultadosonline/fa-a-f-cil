import { useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, Trash2, Upload, Youtube } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { canUploadCookies, youtubeAdminRequest, type YoutubeCookieStatus } from '@/lib/youtubeAdmin';

export function YoutubeCookieSettings({ server }: { server: string }) {
  const [status, setStatus] = useState<YoutubeCookieStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [secure, setSecure] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  async function load() {
    setBusy(true);
    try { setStatus(await youtubeAdminRequest(server)); setError(''); }
    catch (e) { setStatus(null); setError(e instanceof Error ? e.message : 'Servidor indisponível.'); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    setSecure(canUploadCookies(window.location.href, server));
    setStatus(null); setError('');
  }, [server]);
  async function upload(file: File) {
    if (!secure) { toast.error('Envio de cookies exige HTTPS ou localhost.'); return; }
    setBusy(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('O arquivo deve ter até 1 MB.');
      const form = new FormData(); form.append('cookies', file);
      setStatus(await youtubeAdminRequest(server, { method: 'POST', body: form })); setError('');
      toast.success('Cookies protegidos salvos. Ative o uso abaixo quando quiser.');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  }
  async function change(enabled: boolean) {
    setBusy(true);
    try { setStatus(await youtubeAdminRequest(server, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled }) })); }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Não foi possível alterar.'); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-border pt-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><h3 className="flex items-center gap-2 text-lg font-semibold"><Youtube className="h-5 w-5 text-primary" />Cookies do YouTube</h3><p className="mt-2 text-sm text-muted-foreground">Arquivo privado no servidor. O conteúdo não é exibido nem incluído no código.</p></div>
      <Button variant="outline" size="sm" disabled={busy} onClick={() => void load()}>{busy ? <Loader2 className="animate-spin" /> : <RefreshCw />}Consultar status</Button></div>
    <p className="text-sm text-muted-foreground" role="status">{status ? status.configured ? status.enabled ? 'Cookies configurados e ativos.' : 'Cookies configurados, uso desativado.' : 'Nenhum arquivo configurado pelo administrador.' : 'Consulte o status do servidor antes de alterar.'}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap items-center gap-3">
      <input ref={input} type="file" accept=".txt" aria-label="Arquivo cookies.txt do YouTube" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }} />
      <Button variant="outline" disabled={busy || !secure} onClick={() => input.current?.click()}><Upload />Enviar ou substituir cookies.txt</Button>
      <label className="flex items-center gap-3 text-sm">Ativar no servidor<Switch aria-label="Ativar cookies do YouTube" checked={status?.enabled || false} disabled={busy || !status?.configured} onCheckedChange={(value) => void change(value)} /></label>
      <Button variant="ghost" size="icon" aria-label="Remover cookies do YouTube" title="Remover cookies do YouTube" disabled={busy || !status?.configured} onClick={async () => {
        if (!confirm('Remover o arquivo de sessão do YouTube do servidor?')) return;
        setBusy(true); try { setStatus(await youtubeAdminRequest(server, { method: 'DELETE' })); toast.success('Cookies removidos.'); } catch { toast.error('Não foi possível remover.'); } finally { setBusy(false); }
      }}><Trash2 /></Button>
    </div>
    {!secure && <div className="space-y-3 rounded-md border border-border bg-muted/40 p-4 text-sm">
      <p className="font-medium">Pelo IP sem HTTPS, importe o arquivo diretamente na VPS.</p>
      <p className="text-muted-foreground">Assim a sessão não atravessa a internet sem proteção. Copie seu cookies.txt para a VPS e execute no terminal:</p>
      <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-xs">sudo bash /home/motionmro/app/deploy/import-youtube-cookies.sh /root/cookies.txt</pre>
      <p className="text-muted-foreground">Depois clique em <b>Consultar status</b>. O arquivo já entra ativo, e você pode desativar ou remover por esta tela. Com o domínio HTTPS configurado, o envio pelo navegador volta a ficar disponível.</p>
    </div>}
    <p className="text-xs text-muted-foreground">Use uma conta dedicada e conteúdo autorizado. Cookies podem expirar; o YouTube pode restringir a conta ou o IP mesmo com cookies. Renove arquivos compartilhados no chat.</p>
  </section>;
}