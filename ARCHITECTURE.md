# Architecture - Application de Recherche Instantanée SvelteKit

## 📋 Vue d'ensemble du projet

Application SvelteKit permettant la recherche full-text instantanée dans des fichiers de conversations (JSONL 3.78GB / Parquet 1.61GB).

### Données

- **conversations.jsonl** : 3.78 GB
- **conversations.parquet** : 1.61 GB
- **conversations_samples.jsonl** : 12.6 MB (~1000 entrées pour développement)

### Structure de données observée

```json
{
  "id": 842893,
  "timestamp": 1757949255032,
  "model_a_name": "qwq-32b",
  "model_b_name": "qwen3-32b",
  "conversation_a": [...],
  "conversation_b": [...],
  "metadata": {
    "duration": 40.9080662727,
    "generation_id": "chatcmpl-..."
  },
  "conv_turns": 1,
  "keywords": ["MISA", "RISC-V", ...],
  "categories": ["Natural Science & Formal Science & Technology"],
  "languages": ["en", "fr"],
  "short_summary": "...",
  ...
}
```

## 🏗️ Architecture technique

### Stack technologique

#### Frontend

- **SvelteKit** : Framework principal
- **Svelte 5** : Composants réactifs avec runes
- **TailwindCSS** : Styling
- **svelte-virtual-list** : Virtualisation pour affichage performant

#### Backend (Server-side)

- **SvelteKit API Routes** : Endpoints serveur
- **Node.js** : Runtime serveur

#### Indexation & Recherche

Plusieurs options possibles selon les performances :

**Option 1 : DuckDB-WASM (Recommandé pour Parquet)**

- Lecture native de Parquet
- SQL pour requêtes complexes
- Full-text search intégré
- Très performant pour gros volumes

**Option 2 : FlexSearch + streaming JSONL**

- Indexation ultra-rapide
- Recherche fuzzy
- Bas en mémoire
- Bon pour JSONL

**Option 3 : MiniSearch**

- Léger et simple
- Bon pour prototypage
- Limite : chargement en mémoire

### Architecture des composants

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Svelte)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐ │
│  │  SearchBar  │  │ ResultsList  │  │ ConversationView│ │
│  │  Component  │  │  Component   │  │   Component     │ │
│  └──────┬──────┘  └──────▲───────┘  └────────▲────────┘ │
│         │                │                    │          │
│         │                │                    │          │
└─────────┼────────────────┼────────────────────┼──────────┘
          │                │                    │
          │ Query          │ Results            │ Details
          ▼                │                    │
┌─────────────────────────────────────────────────────────┐
│              SvelteKit API Routes (+server.ts)          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  GET /api/search?q=...&page=...&limit=...          │ │
│  │  GET /api/conversation/:id                         │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                              │
│                          ▼                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │         Search Engine Service                      │ │
│  │  - Indexation au démarrage                         │ │
│  │  - Cache des résultats                             │ │
│  │  - Recherche full-text                             │ │
│  └────────────────────────────────────────────────────┘ │
│                          │                              │
│                          ▼                              │
│  ┌────────────────────────────────────────────────────┐ │
│  │        Data Access Layer                           │ │
│  │  - Lecture Parquet/JSONL                           │ │
│  │  - Streaming si nécessaire                         │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│              Fichiers de données                         │
│  - conversations.parquet (1.61 GB)                      │
│  - conversations.jsonl (3.78 GB)                        │
│  - conversations_samples.jsonl (12.6 MB)                │
└─────────────────────────────────────────────────────────┘
```

## 🔍 Stratégies de recherche

### Stratégie recommandée : DuckDB avec indexation FTS

**Avantages :**

- Lecture directe de Parquet (plus compact : 1.61 GB vs 3.78 GB)
- Extension Full-Text Search intégrée
- Requêtes SQL expressives
- Excellent pour volumes importants
- Pas besoin de tout charger en mémoire

**Implémentation :**

```javascript
// Initialisation au démarrage du serveur
import * as duckdb from "@duckdb/duckdb-wasm";

// Créer une vue FTS
await db.query(`
  CREATE TABLE conversations AS 
  SELECT * FROM read_parquet('conversations.parquet');
  
  PRAGMA create_fts_index(
    'conversations', 
    'id', 
    'conversation_a', 'conversation_b', 
    'short_summary', 'keywords'
  );
`);

// Recherche
const results = await db.query(
  `
  SELECT *, fts_main_conversations.match_bm25(id, ?) as score
  FROM conversations
  WHERE fts_main_conversations.match_bm25(id, ?) IS NOT NULL
  ORDER BY score DESC
  LIMIT ? OFFSET ?
`,
  [query, query, limit, offset]
);
```

### Alternative : FlexSearch pour JSONL

Si vous préférez travailler avec JSONL ou avez besoin de plus de contrôle :

```javascript
import FlexSearch from "flexsearch";
import { createReadStream } from "fs";
import readline from "readline";

const index = new FlexSearch.Document({
  document: {
    id: "id",
    index: ["conversation_a", "conversation_b", "short_summary", "keywords"],
  },
  tokenize: "forward",
  optimize: true,
  resolution: 9,
});

// Indexation en streaming
async function indexData() {
  const stream = createReadStream("conversations.jsonl");
  const rl = readline.createInterface({ input: stream });

  for await (const line of rl) {
    const doc = JSON.parse(line);
    index.add(doc);
  }
}

// Recherche
const results = index.search(query, { limit: 50 });
```

## 📁 Structure du projet

```
comparia-search/
├── src/
│   ├── lib/
│   │   ├── components/
│   │   │   ├── SearchBar.svelte
│   │   │   ├── ResultCard.svelte
│   │   │   ├── ResultsList.svelte
│   │   │   ├── ConversationView.svelte
│   │   │   └── Pagination.svelte
│   │   ├── server/
│   │   │   ├── search-engine.ts      # Moteur de recherche
│   │   │   ├── data-loader.ts        # Lecture Parquet/JSONL
│   │   │   └── cache.ts              # Système de cache
│   │   ├── types/
│   │   │   └── conversation.ts       # Types TypeScript
│   │   └── utils/
│   │       ├── debounce.ts
│   │       └── highlight.ts          # Highlight des résultats
│   ├── routes/
│   │   ├── +page.svelte              # Page principale
│   │   ├── api/
│   │   │   ├── search/
│   │   │   │   └── +server.ts        # Endpoint recherche
│   │   │   └── conversation/
│   │   │       └── [id]/
│   │   │           └── +server.ts    # Détail conversation
│   │   └── conversation/
│   │       └── [id]/
│   │           └── +page.svelte      # Page détail
│   └── app.html
├── static/
│   └── data/
│       ├── conversations.parquet
│       ├── conversations.jsonl
│       └── conversations_samples.jsonl
├── package.json
├── svelte.config.js
├── vite.config.ts
└── tsconfig.json
```

## 🚀 Optimisations de performance

### 1. Indexation au démarrage

```typescript
// src/hooks.server.ts
import { initSearchEngine } from "$lib/server/search-engine";

let searchReady = false;

export async function handle({ event, resolve }) {
  if (!searchReady) {
    await initSearchEngine();
    searchReady = true;
  }
  return resolve(event);
}
```

### 2. Cache des résultats

```typescript
// Cache LRU pour requêtes fréquentes
import LRU from "lru-cache";

const cache = new LRU({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
});

export async function search(query: string) {
  const cacheKey = `search:${query}`;
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
  }

  const results = await performSearch(query);
  cache.set(cacheKey, results);
  return results;
}
```

### 3. Debouncing côté client

```svelte
<script lang="ts">
  import { debounce } from '$lib/utils/debounce';

  let searchQuery = $state('');
  let results = $state([]);

  const debouncedSearch = debounce(async (query: string) => {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    results = await response.json();
  }, 300);

  $effect(() => {
    if (searchQuery.length > 2) {
      debouncedSearch(searchQuery);
    }
  });
</script>
```

### 4. Virtualisation des résultats

```svelte
<script>
  import VirtualList from 'svelte-virtual-list';

  let items = $state([]);
</script>

<VirtualList items={items} let:item>
  <ResultCard conversation={item} />
</VirtualList>
```

### 5. Pagination côté serveur

```typescript
// api/search/+server.ts
export async function GET({ url }) {
  const query = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = (page - 1) * limit;

  const results = await searchEngine.search(query, { limit, offset });

  return json({
    results: results.data,
    total: results.total,
    page,
    totalPages: Math.ceil(results.total / limit),
  });
}
```

## 🎨 Interface utilisateur

### Composants principaux

**SearchBar.svelte**

- Input avec debouncing
- Suggestions autocomplete
- Indicateur de chargement

**ResultsList.svelte**

- Liste virtualisée des résultats
- Carte par conversation
- Highlight des termes recherchés

**ResultCard.svelte**

- Aperçu de la conversation
- Métadonnées (modèles, date, langue)
- Score de pertinence
- Lien vers détails

**ConversationView.svelte**

- Affichage complet de la conversation
- Messages formatés
- Métadonnées étendues

## 📊 Métriques de performance attendues

Avec DuckDB + Parquet :

- **Temps d'indexation initial** : ~30-60 secondes (une seule fois au démarrage)
- **Temps de recherche** : <100ms pour requêtes simples
- **Mémoire utilisée** : ~500MB-1GB pendant l'indexation, ~200-400MB en fonctionnement
- **Taille sur disque** : 1.61 GB (Parquet) + index FTS (~300-500MB)

Avec FlexSearch + JSONL :

- **Temps d'indexation initial** : ~2-5 minutes
- **Temps de recherche** : <50ms
- **Mémoire utilisée** : ~2-3GB (index en mémoire)
- **Taille sur disque** : 3.78 GB + index sérialisé (~1GB)

## 🔄 Workflow de développement

### Phase 1 : Prototype avec échantillon

1. Tester avec `conversations_samples.jsonl` (12.6 MB)
2. Valider l'architecture et l'UX
3. Mesurer les performances

### Phase 2 : Passage à l'échelle

1. Basculer sur `conversations.parquet` (1.61 GB)
2. Optimiser l'indexation
3. Tester les performances réelles

### Phase 3 : Production

1. Configuration pour environnement local
2. Scripts de démarrage
3. Documentation utilisateur

## 📦 Dépendances principales

```json
{
  "dependencies": {
    "@sveltejs/kit": "^2.0.0",
    "svelte": "^5.0.0",
    "@duckdb/duckdb-wasm": "^1.28.0",
    "flexsearch": "^0.7.43",
    "lru-cache": "^10.0.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-node": "^4.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0"
  }
}
```

## 🎯 Fonctionnalités core

### MVP (Minimum Viable Product)

- ✅ Recherche full-text instantanée
- ✅ Affichage des résultats paginés
- ✅ Vue détaillée d'une conversation
- ✅ Highlight des termes recherchés

### Améliorations possibles

- 🔄 Filtres avancés (modèle, langue, catégorie, date)
- 🔄 Export des résultats (JSON, CSV)
- 🔄 Statistiques de recherche
- 🔄 Historique des recherches
- 🔄 Mode sombre
- 🔄 Recherche par similarité sémantique

## 🚦 Points d'attention

### Gestion mémoire

- Fichiers volumineux : utiliser streaming ou base de données
- Ne pas charger tout en RAM
- Libérer les ressources après usage

### Performance

- Indexation au démarrage du serveur (hook)
- Cache agressif des résultats
- Debouncing des requêtes utilisateur

### Scalabilité

- Architecture permet migration vers PostgreSQL + pg_trgm si besoin
- Ou vers Elasticsearch/MeiliSearch pour production distribuée

## 📝 Prochaines étapes

1. Valider l'approche technique (DuckDB vs FlexSearch)
2. Créer le projet SvelteKit de base
3. Implémenter le prototype avec l'échantillon
4. Tester et optimiser
5. Passer aux fichiers complets
