# Vallar Originals Sales Panel - Unificado

Projeto Next.js pronto para Vercel com:
- Banco PostgreSQL via Neon
- Auth com Discord
- Registro de vendas
- Limite diário de 3 vendas com Repair Kit por ID
- Webhook opcional do Discord no backend

## Passos
1. npm install
2. copie .env.example para .env.local
3. preencha as variáveis
4. execute schema.sql no banco
5. npm run dev

## Deploy na Vercel
- Conecte um banco Neon
- Configure as variáveis de ambiente
- Configure a Redirect URI no Discord Developer Portal
