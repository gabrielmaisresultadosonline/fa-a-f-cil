# Roadmap MotionMRO
## Instalação VPS em comando único
- [ ] Corrigir acesso público ao login, banco e arquivos usando o IP da VPS e Nginx
- [ ] Executar build de produção e manter app, backend e renderização ativos com systemd
- [ ] Entregar uma linha de instalação/atualização, administrador seguro e documentação para motionmro.com.br depois
- [ ] Validar scripts e testes; instalação real depende de acesso a uma VPS Ubuntu 24.04

## Impacto do Overlay
- [x] Centralizar novas composições e regenerações, alternando escurecimento e fundo sólido de tela inteira
- [x] Reforçar transições de texto e fundo sem alterar áudio, câmera, editor ou exportação
- [x] Verificar planejamento, regeneração e preservação dos projetos existentes: 24 testes passaram; geração OpenAI real continua pendente do token do estúdio
## Ambiente independente local
- [x] Preparar instalação isolada de PostgreSQL, autenticação e arquivos privados em localhost
- [x] Criar inicialização do app e renderização com credenciais locais, sem alterar o ambiente Cloud
- [x] Validar sintaxe dos instaladores, seis testes de credenciais e esquema/regras em PostgreSQL 17 descartável
- [ ] Executar instalação completa e login pela UI local — depende de Docker e da máquina do usuário; não disponível neste sandbox

## Renovação visual pública
- [x] Refinar vendas, cadastro e login com composição tecnológica e luzes, sem alterar acesso ou regras
- [x] Verificar navegação, formulários e apresentação em celular, tablet e computador

## Área de clientes e vendas
- [x] Testar primeiro em localhost: login admin/cliente, resgate de teste, projetos privados e render FFmpeg com download pela UI
- [x] Ativar armazenamento em nuvem e contas com nome, e-mail e WhatsApp
- [x] Separar administração protegida e dashboard de clientes
- [x] Aplicar planos, créditos e teste único por IP com orçamento total de 90 segundos
- [x] Implementar InfinitePay com pedidos persistentes, confirmação por API e acompanhamento limitado a dez minutos no servidor Node
- [x] Centralizar clientes, gerações e custos na administração
- [x] Isolar projetos por cliente e excluir MP4s após dois dias; preservar dados antigos por importação explícita do admin
- [x] Criar página de vendas, cadastro e login
- [x] Preparar instalador do servidor de renderização para Ubuntu 24.04; sintaxe verificada, não instalado nesta máquina
- [x] Validar acesso, orçamento de teste, reembolso idempotente, reservas concorrentes e isolamento em contas reais
- [ ] Validar pagamento InfinitePay real — depende de publicação pública e compra autorizada; nenhum pagamento realizado
- [ ] Validar geração OpenAI real por cliente — depende do token do estúdio na administração
- [ ] Instalação e teste em Ubuntu/VPS — depende de acesso à máquina; contas e aplicativo continuam hospedados no Lovable Cloud
- [ ] Hospedagem totalmente independente em uma VPS — exige migração própria de autenticação, dados e segredos; não está no instalador de vídeos
- [ ] Imagens geradas por IA — depende de habilitar e configurar geração de imagens na conta OpenAI (pendência anterior)
- [x] Enquadramento automático em prévia/exportação; validação visual e uma tentativa de correção no Motion e Overlay
- [x] Direção visual com SVG e ilustrações para todos os modelos; testes em formatos vertical, quadrado e horizontal
- [x] Pedido original completo em Meus projetos, cópia e reutilização
- [x] Nome excluído do pedido enviado à IA; telas verificadas em 375, 887 e 1440px
- [x] Fase 1–3: dashboard, Motion IA com agentes, editor com prévia e exportação HTML
- [x] Fase 4: Video Overlay IA (envio, transcrição, overlays)
- [x] Exportação MP4 no servidor próprio (FFmpeg / HyperFrames)

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
