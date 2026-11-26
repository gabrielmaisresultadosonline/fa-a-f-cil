# MotionMRO — servidor de renderização

Renderiza os projetos do **Video Overlay IA** em MP4 com **FFmpeg** ou **HyperFrames**, quadro a quadro.

## Instalar (Windows, Linux ou VPS)
1. Instale **Node.js 22+** e **FFmpeg** (precisa estar no PATH: `ffmpeg -version`).
2. Nesta pasta: `npm install` e depois `npm start`.
3. O servidor abre em `http://localhost:4400` (mude com `PORT=5000 npm start`).
4. No MotionMRO, vá em **Administração → Servidor de renderização** e cole o endereço.

Numa VPS, coloque o servidor atrás de HTTPS (ex.: Nginx/Caddy) e use o endereço `https://...`.
HyperFrames é baixado automaticamente via `npx hyperframes` no primeiro uso.
