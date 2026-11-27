# Roadmap MotionMRO
- [x] Enquadramento automático em prévia/exportação; validação visual e uma tentativa de correção no Motion e Overlay
- [x] Direção visual com SVG e ilustrações para todos os modelos; testes em formatos vertical, quadrado e horizontal
- [x] Pedido original completo em Meus projetos, cópia e reutilização
- [x] Nome excluído do pedido enviado à IA; telas verificadas em 375, 887 e 1440px
- [x] Fase 1–3: dashboard, Motion IA com agentes, editor com prévia e exportação HTML
- [x] Fase 4: Video Overlay IA (envio, transcrição, overlays)
- [x] Exportação MP4 no servidor próprio (FFmpeg / HyperFrames)
- [ ] Imagens geradas por IA nas cenas

## Editor de vídeo por camadas
- [x] Remover a narração automática e as configurações de voz da criação e da Administração
- [x] Abrir editor após a prévia de Motion e Overlay, com vídeo e camadas de áudio separadas
- [x] Adicionar arquivos, gravar áudio e baixar música por link no servidor com yt-dlp
- [x] Separar voz da música no servidor com UVR, mantendo a faixa original recuperável
- [x] Selecionar, mover, cortar, dividir, aparar, excluir e ajustar volume, graves e agudos
- [x] Renderizar no servidor todas as camadas e edições com FFmpeg ou HyperFrames
- [x] Testar regras do editor, fila de áudio, páginas e formatos responsivos

## Renderização em segundo plano
- [x] Fila persistente no servidor com progresso e recuperação após reinício
- [x] Envio de Motion IA e Overlay, acompanhamento e download do MP4
- [x] Testes de fila e recuperação; Motion IA real em ambos motores e Overlay FFmpeg com navegador fechado, retorno e download H.264/AAC
