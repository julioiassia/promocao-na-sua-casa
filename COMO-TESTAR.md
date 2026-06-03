# 📱 Como testar o APP PROMOÇÃO NA SUA CASA

Você não precisa entender nada de programação. Siga os passos abaixo.

---

## ✅ TESTE RÁPIDO (sem instalar nada)

> Use este modo para ver como o app vai ficar **antes de configurar tudo**.

### Passo 1 — Abra o painel admin

1. Vá na pasta `promo-app`
2. Clique duas vezes no arquivo **`admin.html`**
3. Ele vai abrir no seu navegador (Chrome, Edge, etc.)

### Passo 2 — Cadastre uma promoção

1. Clique em **"Clique aqui para escolher uma foto"**
2. Escolha qualquer foto de produto ou embalagem que você tiver no computador
3. Clique em **"Analisar foto com IA"**
4. O sistema vai mostrar o que detectou (em modo de teste, aparecerão exemplos)
5. Confira os produtos e preços
6. Clique em **"Publicar promoções"**

### Passo 3 — Veja como o usuário vai enxergar

1. Abra o arquivo **`usuario.html`** (também na pasta `promo-app`)
2. As promoções que você cadastrou aparecem automaticamente!
3. Clique em qualquer promoção para ver os detalhes
4. Use a barra de busca para procurar um produto

---

## 🚀 TESTE COMPLETO (com IA de verdade)

> Para a IA analisar as fotos de verdade, você precisa configurar o servidor.

### O que você vai precisar

- [ ] **Node.js** instalado no computador
  - Baixe em: https://nodejs.org → clique em "LTS" → instale normalmente
- [ ] **Chave da Anthropic** (ANTHROPIC_API_KEY)
  - Acesse: https://console.anthropic.com → API Keys → Create Key

### Passo 1 — Configure a chave da IA

1. Abra a pasta `promo-app/backend`
2. Abra o arquivo **`.env`** (se não existir, copie o `.env.example` e renomeie)
3. Substitua `sua_chave_aqui` pela sua chave:
   ```
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxx
   ```
4. Salve o arquivo

### Passo 2 — Inicie o servidor

1. Vá na pasta `promo-app`
2. Clique duas vezes no arquivo **`iniciar.bat`**
3. Uma janela preta vai abrir — isso é normal, é o servidor rodando
4. **Não feche essa janela enquanto estiver testando**

### Passo 3 — Teste com fotos reais

1. Abra o **`admin.html`** no navegador
2. Envie uma foto de gôndola de supermercado ou etiqueta de preço
3. A IA vai ler a foto e extrair os produtos e preços automaticamente
4. Revise, ajuste se precisar, e publique

---

## 📋 O que cada arquivo faz

| Arquivo | Para quê serve |
|---------|---------------|
| `admin.html` | **Você** — cadastra promoções |
| `usuario.html` | **Seus clientes** — veem as ofertas |
| `iniciar.bat` | Inicia o servidor (clique duplo) |
| `backend/server.js` | O "motor" do app |
| `backend/.env` | Suas configurações secretas |

---

## ❓ Problemas comuns

**"A foto foi analisada mas os dados estão errados"**
→ Corrija os campos diretamente na tela antes de publicar.

**"O servidor não inicia"**
→ Verifique se o Node.js está instalado: abra o Prompt de Comando e digite `node --version`.

**"As promoções não aparecem no usuario.html"**
→ Certifique-se de que ambos os arquivos estão abertos no **mesmo navegador**.
