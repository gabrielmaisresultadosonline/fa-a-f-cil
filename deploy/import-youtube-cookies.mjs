// Importa um cookies.txt do YouTube direto no servidor de renderização, sem UI e sem HTTPS.
// Útil na VPS acessada pelo IP e em emergências locais; o mesmo arquivo vale para todos os usuários.
// Uso: node deploy/import-youtube-cookies.mjs <caminho-do-cookies.txt>
// Na VPS: runuser -u motionmro -- node /home/motionmro/app/deploy/import-youtube-cookies.mjs /root/cookies.txt
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { YoutubeSettings } from '../render-server/youtube-settings.mjs';

const [file] = process.argv.slice(2);
if (!file) { console.error('Uso: node deploy/import-youtube-cookies.mjs <caminho-do-cookies.txt>'); process.exit(1); }

const dataDir = process.env.MRO_DATA_DIR || join(homedir(), '.local', 'share', 'motionmro', 'renders');
const settings = new YoutubeSettings(dataDir);

let bytes;
try { bytes = await readFile(resolve(file)); }
catch { console.error(`Não foi possível ler o arquivo: ${file}`); process.exit(1); }

try {
  await settings.save(bytes);
  const status = await settings.setEnabled(true);
  console.log(`Cookies do YouTube importados e ativados. Todos os downloads do servidor usarão esta sessão.`);
  console.log(`Status: configurado=${status.configured} ativo=${status.enabled}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao importar os cookies.');
  process.exit(1);
}
