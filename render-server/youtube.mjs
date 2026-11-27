/** Shared options: download and metadata must use the same runtime and session. */
export function youtubeArguments(output, url, cookieFile) {
  const args = ["--ignore-config", "--no-playlist", "--js-runtimes", `node:${process.execPath}`,
    "--socket-timeout", "30", "--retries", "3", "--max-filesize", "300M",
    "--restrict-filenames", "--quiet", "--no-simulate", "--print", "after_move:%(title)s",
    "-f", "bestaudio/best", "-o", output];
  if (cookieFile) args.push("--cookies", cookieFile);
  args.push("--", url);
  return args;
}

/** Never send extractor diagnostics (which can include session data) to customers. */
export function youtubeError(error) {
  const message = String(error?.message || error);
  if (/cookies are no longer valid|rotated in the browser/i.test(message)) {
    return new Error("Os cookies do YouTube configurados no servidor expiraram. O administrador precisa exportar um cookies.txt novo (em janela anônima, fechando-a logo depois) e importar novamente.");
  }
  if (/confirm you.?re not a bot|sign in|cookies.*(expired|invalid)|login required/i.test(message)) {
    return new Error("O YouTube exigiu confirmação de acesso para este link. O administrador precisa configurar ou renovar os cookies do YouTube no servidor. Você também pode adicionar um arquivo de áudio autorizado pelo editor.");
  }
  if (/javascript runtime|js runtimes|challenge solving|ejs/i.test(message)) {
    return new Error("O download do YouTube precisa ser atualizado no servidor. Peça ao administrador para executar o atualizador do MotionMRO.");
  }
  if (/private video|video unavailable|not available|removed|copyright/i.test(message)) {
    return new Error("Este vídeo está privado, indisponível ou restrito pelo YouTube. Use outro link autorizado ou adicione o arquivo de áudio.");
  }
  return new Error("Não foi possível baixar este áudio do YouTube. Confira o link e tente novamente; se continuar, adicione um arquivo de áudio autorizado ou procure o administrador.");
}