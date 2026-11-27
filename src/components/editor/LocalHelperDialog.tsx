import { Download, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function LocalHelperDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Monitor className="h-5 w-5 text-primary" />Auxiliar no computador</DialogTitle>
        <DialogDescription>A sessão do YouTube fica no seu computador. Somente o áudio é adicionado ao projeto.</DialogDescription></DialogHeader>
      <Button asChild><a href="/motionmro-helper.cmd" download><Download />Instalar e iniciar · Windows</a></Button>
      <Button variant="outline" asChild><a href="/motionmro-helper-linux.sh" download><Download />Iniciar · Linux / macOS</a></Button>
      <p className="text-sm text-muted-foreground">Após iniciar, mantenha a janela do auxiliar aberta e escolha “Meu navegador” no editor.</p>
      <p className="text-xs text-muted-foreground">Chrome e Edge podem impedir a leitura da sessão. Nesse caso, escolha Firefox ou selecione um arquivo de sessão novo na janela local. Não envie cookies no chat.</p>
    </DialogContent>
  </Dialog>;
}