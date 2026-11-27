# MotionMRO

Plataforma de criação de Motion IA, Video Overlay, edição por camadas e renderização de vídeos com FFmpeg ou HyperFrames.

## Instalar tudo em uma VPS Ubuntu 24.04 ou 26.04 LTS

Execute esta única linha no terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/gabrielmaisresultadosonline/fa-a-f-cil/main/deploy/vps-install.sh -o /tmp/motionmro-install.sh && sudo bash /tmp/motionmro-install.sh
```

O instalador configura o IP público, aplicativo em produção, PostgreSQL, login, arquivos privados, Nginx, fila de renderização, FFmpeg, HyperFrames, yt-dlp/UVR, firewall e serviços permanentes. Ao final, ele solicita o e-mail e a senha do administrador.

Abra `http://IP-DA-VPS` e entre em `/admin`. O endereço de renderização já é configurado; salve o token OpenAI antes de gerar vídeos. Nesta fase de testes, cadastros não exigem confirmação de e-mail e compras reais permanecem desligadas.

Depois de instalado, atualize a VPS com o código mais novo do GitHub em um comando:

```bash
sudo bash /home/motionmro/app/deploy/update-vps.sh
```

Consulte [deploy/README.md](deploy/README.md) para requisitos, atualização, logs, limitações e a futura configuração de `motionmro.com.br` com HTTPS.

## Desenvolvimento local

Para um ambiente independente de desenvolvimento, siga [deploy/LOCALHOST.md](deploy/LOCALHOST.md). O preview do Lovable continua separado da instalação local e da VPS.

## Código e sincronização

O repositório público contém o código completo do aplicativo e dos serviços de instalação/renderização. Credenciais, tokens, senhas e dados de clientes não fazem parte do repositório.
