# MotionMRO — servidor de renderização

Renderiza **Motion IA** e **Video Overlay IA** em MP4 com **FFmpeg** ou **HyperFrames**, quadro a quadro, em um navegador invisível no servidor. Não captura a tela do usuário.

## Instalar (Windows, Linux ou VPS)
1. Instale **Node.js 22+** e **FFmpeg** (precisa estar no PATH: `ffmpeg -version`).
2. Nesta pasta: `npm install` e depois `npm start`.
3. O servidor abre em `http://localhost:4400` (mude com `PORT=5000 npm start`). Por padrão, só aceita conexões locais.
4. No MotionMRO, vá em **Administração → Servidor de renderização** e cole o endereço.

## Atualizar uma instalação existente
Substitua os arquivos desta pasta, incluindo **server.mjs e jobs.mjs**, execute `npm install` e reinicie o programa. Preserve a pasta `data`. Em Administração, **Testar** deve mostrar **Servidor v2 conectado**. A versão antiga não suporta esta fila.

## Segundo plano e arquivos salvos
- Clique em **Renderizar vídeo**, **Renderizar agora** ou **Adicionar à fila**. Antes de fechar o navegador, aguarde **Envio confirmado**. A barra de envio mede bytes transmitidos, separada da barra de renderização.
- Depois da confirmação, a fila pertence ao servidor: minimizar, sair da página ou fechar o navegador não interrompe o trabalho.
- Mantenha o servidor ligado. Se estiver no seu computador, ele não pode dormir, hibernar ou desligar. Para renderização independente do seu computador, use uma VPS.
- Ao voltar ao mesmo navegador, o app consulta o progresso atual. O MP4 fica salvo em `data/<id>/final.mp4` e o botão **Salvar / baixar MP4** baixa o arquivo. Não há download automático nem necessidade de capturar a tela.
- **Remover** apaga também os arquivos no servidor. Jobs ativos não podem ser removidos. Falhas podem ser repetidas sem reenviar os arquivos já aceitos.
- A fila sobrevive ao reinício do servidor: trabalhos interrompidos são renderizados novamente desde o início. PNGs intermediários são apagados após sucesso; os arquivos de entrada são preservados para recuperação.
- Progresso: 5–75% corresponde aos quadros HTML concluídos; 75–99% à codificação FFmpeg pelo tempo efetivamente codificado. HyperFrames passa pelas camadas preparadas (75–85%) e pelo progresso real emitido pelo CLI (85–99%). Se uma etapa não emitir avanço, a barra permanece no último valor, sem inventar progresso. 100% só aparece com o MP4 final salvo.

## Capacidade e VPS
Configure `RENDER_CONCURRENCY=1` (padrão, máximo 4), `DATA_DIR` (pasta persistente), `MAX_UPLOAD_MB=512`, `PORT` e `HOST` por variáveis de ambiente. Mais workers exigem mais CPU, RAM e disco; não existe capacidade ilimitada. Manifestos são limitados a 4096×4096, 60 FPS, 1 hora e 300 camadas. Monitore o disco: MP4s ficam até remoção manual.

Numa VPS, use `HOST=0.0.0.0`, um volume persistente e HTTPS com Nginx/Caddy. **Não exponha publicamente sem controle de acesso**: este servidor privado executa HTML dos seus projetos e não é um serviço SaaS multiusuário. Proteja-o com uma rede privada/VPN ou acesso autenticado no proxy; limite origens, upload, memória e CPU. Os IDs aleatórios dos jobs permitem consultar/baixar aquele job e não devem ser compartilhados. Não há endpoint público listando todos os jobs. Configure o tempo/limite de upload do proxy; a resposta de envio chega antes da renderização.

Para manter o processo em execução, use systemd/PM2 (Linux/VPS) ou um serviço do Windows. Os dados sobrevivem a reinícios somente se `DATA_DIR` for preservado. HyperFrames 0.9.100 é baixado via npx no primeiro uso, que exige internet; a versão fica fixa para preservar o protocolo de progresso. Opcionalmente, configure `PUPPETEER_EXECUTABLE_PATH` e `HYPERFRAMES_BROWSER_PATH` para usar um Chrome instalado.

## API v2
`GET /` informa `backgroundQueue: true`. `POST /jobs/<uuid>` recebe multipart `manifest`, `video` opcional e `sfx` opcional, salva entradas e retorna 202. Repetir o mesmo ID é idempotente. `GET /jobs/<uuid>` informa status, etapa e progresso. `GET /jobs/<uuid>/download` transmite o MP4 salvo. `POST /jobs/<uuid>/retry` repete um job com erro. `DELETE /jobs/<uuid>` remove um job finalizado. O antigo POST `/render` foi substituído.

Testes: `node --test jobs.test.mjs`.
