# MotionMRO — servidor de renderização e áudio

Renderiza **Motion IA**, **Video Overlay IA** e o **Vídeo editor** em MP4 com **FFmpeg** ou **HyperFrames**, quadro a quadro, em um navegador invisível no servidor. Não captura a tela do usuário. Também baixa áudio de links do YouTube com **yt-dlp** e separa voz/instrumental com modelos do **Ultimate Vocal Remover (UVR)** pelo comando `audio-separator`.

## Instalar (Windows, Linux ou VPS)
1. Instale **Node.js 22+** e **FFmpeg** (`ffmpeg -version` e `ffprobe -version` devem funcionar).
2. Nesta pasta: `npm install` e depois `npm start`.
3. O servidor abre em `http://localhost:4400` (mude com `PORT=5000 npm start`). Por padrão, só aceita conexões locais.
4. No MotionMRO, vá em **Administração → Servidor de renderização** e cole o endereço. **Testar** deve mostrar **Servidor v3 conectado**.

### Música do YouTube (opcional)
Instale o [yt-dlp](https://github.com/yt-dlp/yt-dlp) e confirme `yt-dlp --version`. Exemplo com Python:

```bash
python -m pip install -U yt-dlp
```

Use somente músicas próprias, autorizadas ou com licença compatível. O servidor aceita apenas links HTTP/HTTPS de `youtube.com`, `music.youtube.com` e `youtu.be`, sem playlist, com limite de 300 MB. O áudio é convertido para WAV e guardado em `data/media/<id>/original.wav`.

Se o YouTube responder **Sign in to confirm you're not a bot**, exporte cookies da sua própria sessão com uma extensão compatível e aponte `YTDLP_COOKIES=/caminho/seguro/cookies.txt` antes de iniciar o servidor. Não cole cookies nem tokens no MotionMRO; o arquivo fica somente no servidor. Respeite os termos do YouTube e as licenças do conteúdo.

### Remover voz com UVR (opcional)
O repositório UVR indicado no projeto é principalmente uma interface gráfica; para automação no servidor, este programa usa o `audio-separator`, que executa modelos treinados para o UVR. Instale Python 3.10+ e um dos pacotes abaixo:

```bash
# CPU
python -m pip install "audio-separator[cpu]"

# NVIDIA/CUDA: siga a orientação do audio-separator para sua versão de CUDA
python -m pip install "audio-separator[gpu]"
```

Confirme `audio-separator --help`. O modelo padrão é `UVR-MDX-NET-Inst_HQ_4.onnx`; na primeira separação ele pode ser baixado e o processo pode levar vários minutos. Configure `UVR_MODEL` para outro modelo compatível ou `AUDIO_SEPARATOR_COMMAND` se o executável tiver outro nome/caminho. O instrumental fica em `data/media/<id>/instrumental.wav`; o original nunca é sobrescrito e pode ser reativado no editor.

## Atualizar uma instalação existente
Substitua os arquivos desta pasta, inclusive **server.mjs, jobs.mjs e audio.mjs**, execute `npm install` e reinicie. Preserve `data`. A v3 mantém a fila anterior e adiciona os endpoints de mídia e a mixagem do editor.

## Editor de áudio por camadas
- O projeto e seus clipes locais ficam no IndexedDB do navegador. Músicas remotas guardam apenas a referência ao arquivo no servidor.
- Seleção move clipes; as bordas aparam; Corte divide no ponto clicado. Volume, graves e agudos existem por clipe e por camada.
- Gravações usam o microfone do navegador e só são enviadas quando você renderiza.
- Antes do render, o servidor mixa o som original do vídeo (se ativo) e todos os clipes em `mix.wav`, com `atrim`, `adelay`, `volume`, `bass`, `treble` e limiter. FFmpeg e HyperFrames recebem o mesmo mix.
- Uma camada silenciada não entra no mix. Silenciar **Vídeo principal** remove o som original sem apagar a imagem.

## Segundo plano e arquivos salvos
- Antes de fechar o navegador, aguarde **Envio confirmado**. A barra de envio mede bytes transmitidos, separada da barra de renderização.
- Depois da confirmação, a fila pertence ao servidor: minimizar, sair ou fechar o navegador não interrompe o trabalho.
- Mantenha o servidor ligado. Se estiver no computador, ele não pode dormir, hibernar ou desligar. Para independência do computador, use uma VPS.
- O app consulta o progresso ao voltar. O MP4 fica em `data/<id>/final.mp4` e **Salvar / baixar MP4** baixa o arquivo.
- **Remover** apaga os arquivos do job. Jobs ativos não podem ser removidos. Falhas podem ser repetidas sem reenviar os arquivos aceitos.
- A fila sobrevive ao reinício: trabalhos interrompidos recomeçam. PNGs intermediários são apagados após sucesso; entradas e clipes são preservados para recuperação.
- Progresso: 5–75% quadros HTML; 75–99% codificação FFmpeg pelo tempo codificado. HyperFrames usa 75–85% nas camadas e o progresso real do CLI em 85–99%. 100% só aparece com o MP4 salvo.

## Capacidade e VPS
Configure `RENDER_CONCURRENCY=1` (padrão, máximo 4), `DATA_DIR`, `MAX_UPLOAD_MB=512`, `PORT` e `HOST`. Mais workers exigem mais CPU, RAM e disco; UVR pode exigir bastante RAM e fica mais rápido com GPU. Não existe capacidade ilimitada. Manifestos são limitados a 4096×4096, 60 FPS, 1 hora, 300 camadas visuais e 200 clipes de áudio.

Numa VPS, use `HOST=0.0.0.0`, volume persistente e HTTPS com Nginx/Caddy. **Não exponha publicamente sem controle de acesso**: o servidor executa HTML, comandos locais e downloads. Proteja com VPN ou proxy autenticado, limite origens, upload, memória e CPU. IDs aleatórios permitem consultar aquele job/mídia e não devem ser compartilhados. Não há endpoint listando todos os jobs ou músicas.

Use systemd/PM2 ou serviço do Windows. HyperFrames 0.9.100 é baixado via npx no primeiro uso. Opcionalmente configure `PUPPETEER_EXECUTABLE_PATH` e `HYPERFRAMES_BROWSER_PATH`.

## API v3
- `GET /`: versão e capacidades.
- `POST /jobs/<uuid>`: multipart `manifest`, `video` opcional, `sfx` opcional e `audio_N` para clipes locais; retorna 202 após salvar. IDs repetidos são idempotentes.
- `GET /jobs/<uuid>`: status/progresso. `GET /jobs/<uuid>/download`: MP4. `POST /jobs/<uuid>/retry`: repete falha. `DELETE /jobs/<uuid>`: remove finalizado.
- `POST /media/youtube`: JSON `{ "url": "https://youtube.com/..." }`; baixa e retorna ID, nome e duração.
- `POST /media/<uuid>/separate`: executa UVR e preserva original/instrumental.
- `GET /media/<uuid>`: metadados. `GET /media/<uuid>/audio?stem=original|instrumental`: WAV da faixa.

Testes: `npm test` ou `node --test jobs.test.mjs audio.test.mjs`. O teste de áudio usa FFmpeg real com mídia sintética; não baixa YouTube nem modelo UVR.
