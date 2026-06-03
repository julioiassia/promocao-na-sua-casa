# PromoLocal — Arquitetura do Projeto

## Visão Geral

App de crowdsourcing de preços e promoções em supermercados locais.
Foco em pequenos mercados e atacarejos de bairro que não estão nas grandes plataformas.

---

## Problema que resolve

Plataformas como ClickSuper e Menor Preço Brasil dependem de integração com redes grandes.
Pequenos mercados locais ficam de fora. O PromoLocal resolve isso via coleta manual + IA.

---

## Fluxo Principal

```
Usuário fotografa gôndola
        ↓
App valida: GPS + EXIF + Hash
        ↓
IA extrai: produto + preço + código de barras
        ↓
Status: "aguardando verificação"
        ↓
3 usuários confirmam → publicado + pontos liberados
3 usuários negam    → removido + pontos descontados
```

---

## Sistema Antifraude (6 camadas)

| Camada | Mecanismo | O que bloqueia |
|--------|-----------|---------------|
| 1 | Timestamp do servidor | Manipulação de data no celular |
| 2 | EXIF da foto | Fotos antigas reenviadas |
| 3 | GPS obrigatório (raio 200m) | Envio remoto / fora do local |
| 4 | Hash da imagem | Reenvio da mesma foto |
| 5 | Validação da comunidade (3 votos) | Preços errados ou inexistentes |
| 6 | Penalidade por fraude | Incentivo à honestidade |

---

## Stack Tecnológica Sugerida

### Backend
- **Node.js + Express** (API REST)
- **PostgreSQL** (banco de dados)
- **Redis** (cache de sessões e rate limiting)
- **AWS S3 ou Cloudflare R2** (armazenamento de fotos)

### IA / OCR
- **Claude API (Anthropic)** — extração de produto + preço via visão
- Fallback: **Google Vision API** para OCR puro

### Frontend Web (painel admin)
- **React + Vite**
- **Tailwind CSS**

### App Mobile
- **React Native** (iOS + Android com um só código)
- ou **Flutter** se preferir performance nativa

### Infraestrutura
- **Docker** para containerização local
- **Railway ou Render** para deploy simples no início

---

## Modelo de Dados (simplificado)

```sql
-- Mercados cadastrados
mercados (id, nome, endereco, lat, lng, criado_em)

-- Produtos com preço registrado
registros (
  id, mercado_id, produto_nome, preco,
  foto_url, foto_hash, foto_exif_timestamp,
  lat_envio, lng_envio,
  status,  -- pendente | aprovado | rejeitado
  pontos_confirmacao, pontos_rejeicao,
  criado_em, valido_ate
)

-- Usuários coletores
usuarios (id, nome, email, pontos, banido_ate)

-- Votos de validação
votos (id, registro_id, usuario_id, tipo, criado_em)
```

---

## Módulos a Desenvolver

### Fase 1 — MVP
- [ ] Módulo de upload de foto (com validações antifraude)
- [ ] Processamento de imagem com IA (extração de preço)
- [ ] API de consulta: "qual o menor preço do produto X perto de mim?"
- [ ] Sistema de pontos e validação comunitária

### Fase 2
- [ ] App mobile (React Native)
- [ ] Painel admin para moderação
- [ ] Notificações push ("Arroz em promoção no mercado a 500m de você")

### Fase 3
- [ ] Histórico de preços e gráfico de tendência
- [ ] Lista de compras com roteamento otimizado por mercado
- [ ] API para parceiros (outros apps consumirem os dados)

---

## Custo Estimado (fase MVP)

| Item | Custo/mês |
|------|-----------|
| Servidor (Railway Starter) | ~R$ 25 |
| Banco PostgreSQL | ~R$ 0 (free tier) |
| Armazenamento fotos (100/dia) | ~R$ 5 |
| Claude API (OCR, 100 fotos/dia) | ~R$ 10–25 |
| **Total MVP** | **~R$ 40–55/mês** |

---

## Próximos Passos Imediatos

1. Rodar o backend localmente (`/backend`)
2. Testar o módulo de upload com validações
3. Integrar com Claude API para extração de preço
4. Criar tela mobile mockup para validar UX
