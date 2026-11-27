# Instalação MotionMRO — Ubuntu 24.04

## Primeiro teste com banco local

Para PostgreSQL, login e arquivos independentes na sua máquina, siga [LOCALHOST.md](LOCALHOST.md). Execute `bash deploy/local.sh install` e depois `bash deploy/local.sh app`. Esse ambiente é novo, separado do Cloud e somente para desenvolvimento; não é uma instalação de produção na VPS.

## Instalador anterior: somente servidor de vídeos

Na pasta do projeto completo exportado:

```bash
sudo bash deploy/install-ubuntu.sh
```

O instalador configura Node 22, Chromium/Puppeteer, FFmpeg, HyperFrames, yt-dlp, audio-separator/UVR e um serviço que retoma os trabalhos após reiniciar. O processo de vídeo roda como usuário sem privilégios. O servidor fica restrito a localhost. O aplicativo, autenticação e armazenamento privado continuam no Lovable Cloud.

Informe a origem real do aplicativo quando solicitado. Para o primeiro teste local: `http://localhost:8080`. A origem controla os navegadores autorizados e os retornos das verificações de pagamento. Os parâmetros públicos de autenticação são lidos do `.env` exportado quando disponível. Nenhuma senha administrativa ou chave privada é incluída no instalador.

MP4s e arquivos de renderização são excluídos dois dias após a conclusão. Projetos permanecem no armazenamento privado do cliente. O acompanhamento de pedidos fica em disco por até dez minutos e não mantém a sessão do comprador; cada consulta exige uma autorização exclusiva daquele pedido. Sem os identificadores retornados pela InfinitePay, somente o webhook pode confirmar o pagamento.

## Para publicar o servidor de vídeos

Use um domínio HTTPS, encaminhe o tráfego para `127.0.0.1:4400`, ajuste `APP_ORIGIN` e `CORS_ORIGINS` em `/etc/motionmro/render.env`, reinicie o serviço e salve o domínio na Administração. Não abra a porta 4400 diretamente à internet. O aplicativo precisa estar publicado para que a InfinitePay consiga enviar o webhook.

## Limitações verificadas

- O instalador foi validado sintaticamente, não executado em uma VPS Ubuntu real nesta sessão.
- Hospedar toda a aplicação e seu backend de forma independente não está coberto por este instalador: requer uma migração própria do armazenamento, autenticação e segredos.
- Modelos UVR e download de músicas dependem dos recursos da máquina e das restrições do YouTube.
- Os valores e o modelo OpenAI configurados pelo administrador devem existir na conta do fornecedor.