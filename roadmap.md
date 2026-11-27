# Roadmap MotionMRO
## Domínio e HTTPS na VPS
- [ ] Apontar motionmro.com.br e www para 189.24.24.252; nameservers públicos atuais são a.auto.dns.br e b.auto.dns.br, diferentes dos informados
- [ ] Executar deploy/configure-domain.sh após o DNS propagar; script preparado, mas não testado numa VPS real
## Tela do editor e renderização
- [x] Remover do editor o seletor "Meu navegador/Servidor", o botão e o diálogo do auxiliar; download sempre pelo servidor
- [x] Remover os seletores de motor (FFmpeg/HyperFrames) e a página de gravação no navegador; renderização sempre FFmpeg no servidor
- [x] Esconder a etiqueta do motor na fila e no status de renderização

## Download de música do YouTube
- [ ] Importar cookies pelo terminal enquanto o acesso for por IP/HTTP; wrapper seguro preparado, sem liberar sessões em HTTP aberto; importação fictícia criptografada e 34 testes passaram
- [ ] Adicionar envio, ativação e remoção de cookies no admin com verificação de administrador e armazenamento privado criptografado; nunca incluir cookies no código
- [x] Auxiliar no computador do usuário removido do produto a pedido: download sempre pelo servidor com cookies do admin; sessão local nunca publicada
- [ ] Conferir formato do arquivo enviado sem expor dados; orientar renovação da sessão compartilhada no chat
- [x] Ativar Node/EJS, atualizar yt-dlp nos três instaladores e no atualizador, proteger cookies e testar download/conversão: 27 testes passaram; aviso de runtime ausente no teste real do link informado
- [ ] Confirmar download real na VPS com cookies ativos + provedor de tokens PO (rodar update-vps.sh e test-youtube.sh e ler o resultado)
## Compatibilidade com acesso pelo IP
- [x] Substituir randomUUID direto no navegador por UUID seguro compatível com HTTP; 30 testes passaram e Chromium confirmou 1.000 UUIDs únicos e validação de cena sem randomUUID em origem HTTP não segura; criação autenticada na VPS aguarda atualização pelo usuário
## Instalação VPS em comando único
- [x] Corrigir acesso público ao login, banco e arquivos usando o IP da VPS e Nginx
- [x] Executar build de produção e manter app, backend e renderização ativos com systemd
- [x] Entregar uma linha de instalação/atualização, administrador seguro e documentação para motionmro.com.br depois
- [x] Validar sintaxe, regras de firewall e separação das credenciais com testes automatizados
- [ ] Concluir a instalação na VPS Ubuntu 26.04.1 do usuário — disco total informado: 50 GB; UVR parou por espaço, então caches foram removidos e temporários direcionados ao disco do app; aguardando nova execução
- [x] Criar update-vps.sh: um comando que baixa o código novo, mostra o que mudou, aplica migrações novas, refaz o build e reinicia app e render; 6 testes passaram

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
