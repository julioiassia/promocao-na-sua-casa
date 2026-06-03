# PromoLocal 🛒

App de crowdsourcing de preços em supermercados locais.

---

## Como rodar no seu notebook

### Pré-requisitos

- [Node.js 18+](https://nodejs.org) instalado
- Chave da API da Anthropic (para a IA extrair preços das fotos)

### Passo a passo

```bash
# 1. Entre na pasta do backend
cd backend

# 2. Instale as dependências
npm install

# 3. Configure as variáveis de ambiente
cp .env.example .env
# Abra o arquivo .env e coloque sua ANTHROPIC_API_KEY

# 4. Rode o servidor
npm run dev
# O servidor vai subir em http://localhost:3001
```

---

## Testando a API

### Verificar se está rodando
```
GET http://localhost:3001/mercados
```

### Enviar uma foto (teste com curl)
```bash
curl -X POST http://localhost:3001/upload \
  -F "foto=@/caminho/para/foto.jpg" \
  -F "mercado_id=1" \
  -F "lat=-23.5505" \
  -F "lng=-46.6333" \
  -F "usuario_id=user123"
```

### Buscar produto
```
GET http://localhost:3001/buscar?produto=arroz&lat=-23.5505&lng=-46.6333
```

---

## Estrutura do projeto

```
promo-app/
├── docs/
│   └── ARQUITETURA.md      ← visão geral, modelo de dados, roadmap
├── backend/
│   ├── server.js           ← API principal (upload, validações, IA, busca)
│   ├── package.json
│   └── .env.example        ← copiar para .env e preencher
└── frontend/               ← a construir na Fase 2
```

---

## Validações antifraude implementadas

| # | Camada | Status |
|---|--------|--------|
| 1 | Timestamp do servidor | ✅ |
| 2 | EXIF da foto (máx. 2h) | ✅ |
| 3 | GPS (raio 200m do mercado) | ✅ |
| 4 | Hash da imagem (sem duplicatas) | ✅ |
| 5 | Validação comunitária (3 votos) | ✅ |
| 6 | Penalidade por fraude | 🔜 fase 2 |

---

## Próximos passos sugeridos

1. Testar o upload com fotos reais de gôndola
2. Substituir o banco em memória por PostgreSQL
3. Criar interface web simples para testar visualmente
4. Começar o app mobile em React Native
