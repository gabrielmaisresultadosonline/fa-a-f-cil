/** Salva um arquivo gerado no navegador (MP4 da fila ou do editor). */
export function download(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
}
