/** Upload to an owner-authorized, short-lived storage URL using real byte progress. */
export function uploadSignedBlob(url: string, blob: Blob, onProgress: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        onProgress(Math.min(100, Math.max(0, Math.round(event.loaded / event.total * 100))));
      }
    };
    xhr.onerror = () => reject(new Error("O envio do vídeo falhou. Confira sua conexão e tente novamente."));
    xhr.onabort = () => reject(new Error("Envio do vídeo cancelado."));
    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error("Não foi possível enviar o vídeo. Confira o tamanho do arquivo e tente novamente."));
        return;
      }
      onProgress(100);
      resolve();
    };
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", blob);
    onProgress(0);
    xhr.send(body);
  });
}