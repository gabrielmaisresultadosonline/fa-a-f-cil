# Instalação MotionMRO — Ubuntu 24.04 ou 26.04 LTS

## Comando único para a VPS

Em uma VPS Ubuntu **24.04 ou 26.04 LTS**, com acesso root/sudo e IP público, execute esta única linha:

```bash
curl -fsSL https://raw.githubusercontent.com/gabrielmaisresultadosonline/fa-a-f-cil/main/deploy/vps-install.sh -o /tmp/motionmro-install.sh && sudo bash /tmp/motionmro-install.sh
```

O instalador detecta o IP, baixa o código público do GitHub e instala o aplicativo, PostgreSQL, autenticação, arquivos privados, Nginx, FFmpeg, HyperFrames, yt-dlp, UVR e a fila de renderização. Ele cria serviços permanentes que voltam após uma reinicialização.

No final, informe o e-mail e uma senha de pelo menos oito caracteres para o administrador. A senha não fica no código nem aparece na lista de processos. O servidor de renderização é configurado automaticamente.

### Acesso após instalar

- Aplicativo: `http://IP-DA-VPS`
- Administração: `http://IP-DA-VPS/admin`
- Renderização: `http://IP-DA-VPS:4400` — já salvo nas configurações.
- Cadastros nesta fase: sem confirmação de e-mail, conforme a etapa de testes pelo IP.
- OpenAI: entre no admin e salve o token do estúdio antes de gerar vídeos.

O firewall libera somente SSH, a porta 80 do aplicativo e a porta 4400 da renderização. PostgreSQL, autenticação interna, armazenamento, aplicação Node e a fila interna ficam em portas locais. Uma regra específica na cadeia `DOCKER-USER` bloqueia também as portas Docker 54320–54329, que poderiam ignorar o UFW. O navegador acessa login e arquivos pelo mesmo endereço do app por meio do Nginx.

### Requisitos recomendados

- Ubuntu 24.04 ou 26.04 LTS, arquitetura AMD64 ou ARM64.
- 4 GB ou mais de RAM, 2 vCPUs, pelo menos 8 GB livres para instalar e 20 GB livres recomendados para vídeos e modelos de áudio.
- Porta SSH disponível e liberação do provedor para as portas 80 e 4400.

A separação de voz pode exigir mais memória. O primeiro download das imagens e modelos demora mais; execuções seguintes preservam banco, projetos, chaves e arquivos. O instalador limpa somente caches recriáveis do apt/pip e interrompe com uma orientação clara se houver menos de 8 GB livres.

## Atualizar ou reparar

Depois de instalado, atualize a VPS com o código mais novo do GitHub em um único comando:

```bash
sudo bash /home/motionmro/app/deploy/update-vps.sh
```

Ele baixa a versão mais nova, mostra os arquivos que mudaram, instala dependências, aplica migrações novas do banco, refaz o build de produção, reinicia o aplicativo e a fila de renderização e confere se os dois responderam. Bancos, projetos, chaves e arquivos de clientes não são tocados.

Para reparar a instalação inteira, execute novamente a linha de instalação. Não apague `/home/motionmro/.local/share/motionmro`: essa pasta contém a configuração, a chave de proteção e os arquivos locais.

Logs:

```bash
sudo journalctl -u motionmro-app -f
sudo journalctl -u motionmro-render -f
sudo journalctl -u motionmro-db -f
```

## Domínio posterior: motionmro.com.br

Nesta etapa o app usa somente o IP e HTTP. Quando `motionmro.com.br` estiver apontando para a VPS, configuraremos o domínio e HTTPS, atualizaremos os retornos de autenticação e só então validaremos compras reais pela InfinitePay. Não altere DNS nem habilite vendas antes dessa etapa.

## Limitações desta verificação

- Os scripts e regras são testados no projeto; a execução completa ainda precisa ser conferida em uma VPS Ubuntu real. A remoção de voz usa um Python 3.12 próprio, baixado pelo instalador, mesmo no Ubuntu 26.04.
- Geração OpenAI depende do token e dos modelos disponíveis na conta do estúdio.
- Pagamentos reais ficam desligados até HTTPS, domínio e uma compra autorizada de validação.
- Recuperação de senha por e-mail real exigirá SMTP na etapa seguinte; cadastro e login sem confirmação funcionam sem SMTP.
- YouTube pode bloquear downloads automatizados, e modelos UVR são baixados na primeira utilização.

## Outros instaladores

- [LOCALHOST.md](LOCALHOST.md): ambiente separado para desenvolvimento local, com confirmação por caixa postal de testes.
- `install-ubuntu.sh`: instalador anterior **somente do servidor de vídeos**, ainda ligado ao backend Cloud; não use para a VPS independente.
- `install-vps-ubuntu.sh`: versão anterior para execução a partir de uma pasta já clonada; o comando único acima é o recomendado.

## Redefinir acesso do administrador

```bash
sudo bash /home/motionmro/app/deploy/reset-admin.sh
```
Pede e-mail e nova senha; cria a conta se não existir, confirma o e-mail e dá permissão de administrador.
