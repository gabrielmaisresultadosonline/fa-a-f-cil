# MotionMRO — instalação independente para testes locais

Este iniciador cria **um PostgreSQL local novo**, com os serviços de login e arquivos privados que o aplicativo já utiliza. Não exige uma conta externa nem conecta o banco ao Lovable Cloud. A biblioteca de acesso existente continua sendo usada, agora contra serviços na sua máquina; não é um PostgreSQL isolado sem autenticação.

**O preview do Lovable continua separado.** Rodar apenas `bun run dev` não ativa o banco local. Use os comandos abaixo no projeto exportado, na sua máquina.

## Requisitos

- Bun instalado, Node.js 22 ou superior para renderização.
- Docker Engine em execução (Linux) ou Docker Desktop (Windows/macOS), com permissão para o usuário executar `docker info`.
- Recomendado: 8 GB de RAM e espaço para as imagens e vídeos.
- Portas livres: 8080 (app), 4400 (vídeos), 54321 (serviços), 54322 (PostgreSQL), 54324 (e-mails).

No Ubuntu 24.04, instale Docker pelos pacotes oficiais da distribuição:

**Instalador completo (recomendado no Ubuntu):** execute a partir da sua conta normal na pasta exportada:

```bash
sudo bash deploy/install-local-ubuntu.sh
bash deploy/local.sh app
```

Ele pede autorização no terminal, prepara Docker, Bun, Node.js 22, FFmpeg, dependências do aplicativo e o banco local. Conceder acesso ao Docker dá privilégios equivalentes a administrador à sua conta. Não execute na VPS pública. O instalador ainda não foi executado em um Ubuntu real nesta sessão.

**Alternativa manual:**

```bash
sudo apt-get update
sudo apt-get install -y docker.io curl unzip
sudo systemctl enable --now docker
```

Configure a permissão de Docker conforme a documentação da sua instalação. Entrar no grupo `docker` equivale a conceder privilégios de administrador; não faça isso para usuários não confiáveis. Instale Bun pelas instruções oficiais em https://bun.sh e Node.js 22 ou superior. Não execute todo o aplicativo como root.

## Preparar e iniciar

Na pasta do projeto exportado:

```bash
bun install
bash deploy/local.sh install
bash deploy/local.sh app
```

Abra **http://localhost:8080**. O iniciador fornece as credenciais do banco local ao aplicativo e ao servidor; não edita o `.env` exportado nem os arquivos gerenciados do Cloud. A chave privada fica somente no processo do servidor, nunca em variáveis `VITE_*`.

A primeira instalação baixa as imagens Docker. Executar `install` novamente aplica apenas migrações pendentes, sem apagar as tabelas. PostgreSQL, login e arquivos persistem nos volumes Docker; a chave de proteção e os registros ficam em `~/.local/share/motionmro`, com acesso restrito. Não exclua a chave de proteção: ela permite ler o token OpenAI salvo nessa instalação.

**Cadastro:** crie uma conta normalmente. Confirme o e-mail na caixa postal de testes em **http://localhost:54324**; os e-mails locais não são enviados para sua caixa real. A recuperação de senha usa essa mesma caixa postal.

## Administração local

Depois de cadastrar e confirmar a conta desejada, habilite o administrador pelo terminal:

```bash
bash deploy/local.sh admin seu-email
```

Esse comando só altera a conta no banco local; exige acesso ao terminal e usa o papel protegido de administração. Não contém senha padrão, não concede administração a todos os cadastros e não promove ninguém no Cloud. Entre em **http://localhost:8080/admin** com sua senha cadastrada. Salve seu token OpenAI e escolha um modelo disponível na sua conta antes de gerar vídeos. As compras permanecem desligadas na instalação nova.

## Vídeos

Instale as dependências do servidor:

```bash
npm --prefix render-server ci
```

FFmpeg precisa estar instalado; yt-dlp/UVR são necessários para as funções de áudio correspondentes. Em outro terminal:

```bash
bash deploy/local.sh render
```

O servidor usa o mesmo login e o mesmo PostgreSQL local. Os arquivos renderizados ficam em `~/.local/share/motionmro/renders`. O endereço configurado inicialmente para renderização é **http://localhost:4400**. Não use `deploy/install-ubuntu.sh` para este teste: ele é o instalador anterior de renderização ligado ao Cloud.

## Testar e parar

Com a instalação ativa:

```bash
bash deploy/local.sh test
bash deploy/local.sh stop
```

O teste cria contas temporárias e confere projetos privados, teste de 90 segundos, reservas concorrentes e liberação idempotente de créditos **simulada**. Ele não faz compra real nem chama OpenAI. Parar preserva dados; encerre também os terminais do aplicativo e da renderização. Não use comandos de reset se quiser manter seus projetos.

## Segurança e próxima etapa: VPS

Esta configuração é **somente para desenvolvimento local**. Os serviços de desenvolvimento podem publicar portas Docker em outras interfaces: bloqueie acesso externo pelo firewall e não rode esse instalador em uma VPS exposta. As credenciais de desenvolvimento não são segredos adequados para produção.

Para uma VPS Ubuntu 24.04, use o comando único em [README.md](README.md). Ele cria uma instalação separada, executa o build de produção e configura Nginx, PostgreSQL, autenticação, arquivos, renderização, firewall e serviços permanentes. O domínio HTTPS e os e-mails reais ficam para a etapa seguinte; trocar somente o endereço do banco não substitui esses serviços.

Nenhuma conta, projeto, arquivo, compra ou token atual do Lovable Cloud é importado automaticamente. Uma eventual migração de dados exige exportação e restauração separadas, preservando a propriedade de cada conta.

## Estado de verificação

A configuração e os comandos oficiais foram conferidos; seis testes de isolamento das credenciais passaram. O esquema foi aplicado em PostgreSQL 17 real numa base descartável, com verificação do cadastro, teste de 90 segundos, reserva/reembolso idempotentes e isolamento de projetos. Os serviços de login e arquivos usados nesse teste de esquema foram representados por estruturas mínimas; isso não substitui testar o login pelo navegador no ambiente Docker completo.

O ambiente Docker completo ainda precisa ser executado na máquina local: este sandbox não tem Docker. A instalação de produção na VPS usa `deploy/vps-install.sh` e também precisa ser validada em uma máquina Ubuntu 24.04 real.
