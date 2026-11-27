# Instalação MotionMRO em um comando

## Resultado
- Uma única linha no terminal instala ou atualiza o MotionMRO em Ubuntu 24.04 LTS, detecta o IP público e entrega o app em `http://IP`.
- Instalar juntos aplicativo, PostgreSQL/autenticação/arquivos, FFmpeg, HyperFrames, yt-dlp/UVR e fila de renderização.
- Criar o administrador com e-mail e senha solicitados no terminal, sem gravar senha no código ou mostrá-la na lista de processos.
- Manter serviços ativos após reiniciar, firewall configurado e somente as portas necessárias expostas.
- Deixar `motionmro.com.br` documentado como etapa posterior com HTTPS; não alterar DNS agora.

## Correções necessárias no instalador atual
- Substituir o servidor de desenvolvimento por build e execução de produção na VPS, sem mudar o funcionamento do preview Lovable.
- Fazer o navegador acessar login, banco e arquivos pelo mesmo endereço do app; hoje o instalador apontaria esses recursos para o localhost do computador do visitante.
- Configurar Nginx para o app na porta 80 e para os endpoints privados do backend; manter PostgreSQL e ferramentas internas fora do firewall público.
- Ajustar endereço de cadastro/recuperação para o IP e permitir a fase inicial de testes sem confirmação de e-mail, com opção de SMTP posterior.
- Tornar a instalação repetível, preservando banco, projetos, chaves e arquivos existentes.

## Documentação e verificação
- Atualizar README de instalação com a linha única, requisitos, administração, logs, atualização e futura ativação do domínio.
- Adicionar testes para separação entre endereço público e credenciais internas, configuração de autenticação e inicialização de produção.
- Validar sintaxe dos scripts e testes disponíveis. A execução real em uma VPS Ubuntu continuará dependendo do acesso à máquina; pagamentos reais e OpenAI continuarão exigindo suas credenciais.

## Detalhes técnicos
- Build Nitro com `NITRO_PRESET=node-server`; serviço systemd executa `.output/server/index.mjs`.
- Nginx encaminha `/auth/v1`, `/rest/v1`, `/storage/v1` e `/realtime/v1` ao backend local; a chave privilegiada permanece apenas nos processos de servidor.
- O render continua autenticado por sessão e proprietário, em `http://IP:4400`; banco, Studio e caixa de e-mail local não recebem liberação pública.
