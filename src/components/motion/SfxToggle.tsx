import { Volume2, VolumeX } from "lucide-react";
export function SfxToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} data-on={on}
      className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm data-[on=true]:border-primary data-[on=true]:text-primary">
      {on ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}{on ? "Efeitos sonoros ativados" : "Efeitos sonoros desativados"}
    </button>
  );
}
