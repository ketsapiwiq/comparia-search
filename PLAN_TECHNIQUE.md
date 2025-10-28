# Plan technique - Application de recherche Comparia

## 🎯 Objectif

Créer une application SvelteKit permettant la recherche full-text instantanée dans des fichiers de conversations (3.78 GB JSONL / 1.61 GB Parquet).

## ✅ Décisions techniques recommandées

### 1. Stack principal

- **Framework** : SvelteKit avec Svelte 5 (runes)
- **Runtime** : Node.js (adapter-node pour déploiement local)
- **Styling** : TailwindCSS
- **TypeScript** : Typage strict pour tout le projet

### 2. Solution d'indexation recommandée : **DuckDB-WASM**

#### Pourquoi DuckDB ?

| Critère           | DuckDB                  | FlexSearch              |
| ----------------- | ----------------------- | ----------------------- |
| Format source     | Parquet (1.61 GB) ✅    | JSONL (3.78 GB)         |
| Taille sur disque | ~2 GB (données + index) | ~5 GB (données + index) |
| Temps indexation  | 30-60s ✅               | 2-5 min                 |
| Temps recherche   | <100ms                  | <50ms ✅                |
| Mémoire runtime   | 200-400 MB ✅           | 2-3 GB                  |
| SQL queries       | Oui ✅                  | Non                     |
| Complexité        | Moyenne                 | Faible                  |

**Verdict** : DuckDB offre le meilleur compromis performance/mémoire pour ce volume de données.

### 3. Architecture en 3 couches

```
┌─────────────────────────────────────┐
│  Frontend (Svelte Components)       │
│  - Interface utilisateur             │
│  - Gestion état local               │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  API Layer (SvelteKit Routes)       │
│  - Validation requêtes              │
│  - Cache LRU                        │
│  - Rate limiting                    │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  Data Layer (DuckDB + Search)       │
│  - Index FTS                        │
│  - Requêtes optimisées              │
│  - Gestion mémoire                  │
└─────────────────────────────────────┘
```

## 📋 Plan d'implémentation détaillé

### Phase 1 : Configuration du projet (Jours 1-2)

**Étape 1.1 : Initialiser SvelteKit**

```bash
npm create svelte@latest comparia-search
# Options : Skeleton, TypeScript, ESLint, Prettier, Tailwind
cd comparia-search
npm install
```

**Étape 1.2 : Installer les dépendances**

```bash
# Core
npm install @duckdb/duckdb-wasm

# UI & Utils
npm install lru-cache
npm install -D @types/node

# Adapter pour déploiement local
npm install -D @sveltejs/adapter-node
```

**Étape 1.3 : Structure de fichiers**

```
src/
├── lib/
│   ├── components/          # Composants Svelte
│   ├── server/              # Code serveur uniquement
│   │   ├── db.ts           # Initialisation DuckDB
│   │   ├── search.ts       # Logique de recherche
│   │   └── cache.ts        # Gestion du cache
│   ├── types/
│   │   └── index.ts        # Types TypeScript
│   └── utils/
│       └── debounce.ts
├── routes/
│   ├── +page.svelte        # Page d'accueil
│   ├── api/
│   │   └── search/
│   │       └── +server.ts  # Endpoint recherche
│   └── conversation/
│       └── [id]/
│           └── +page.svelte
└── hooks.server.ts          # Initialisation au démarrage
```

### Phase 2 : Backend - Indexation (Jours 3-4)

**Étape 2.1 : Configuration DuckDB**

```typescript
// src/lib/server/db.ts
import * as duckdb from "@duckdb/duckdb-wasm";

let db: duckdb.AsyncDuckDB;
let conn: duckdb.AsyncDuckDBConnection;

export async function initDatabase() {
  // Initialiser DuckDB
  const bundle = await duckdb.selectBundle({
    mvp: {
      /* config */
    },
    eh: {
      /* config */
    },
  });

  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule);

  conn = await db.connect();

  // Charger le fichier Parquet
  await conn.query(`
    CREATE TABLE conversations AS 
    SELECT * FROM read_parquet('static/data/conversations.parquet');
  `);

  // Créer l'index full-text
  await conn.query(`
    INSTALL fts;
    LOAD fts;
    
    PRAGMA create_fts_index(
      'conversations',
      'id',
      'conversation_a',
      'conversation_b',
      'short_summary',
      'keywords'
    );
  `);

  console.log("✅ Database indexed and ready");
}

export function getConnection() {
  if (!conn) throw new Error("Database not initialized");
  return conn;
}
```

**Étape 2.2 : Service de recherche**

```typescript
// src/lib/server/search.ts
import { getConnection } from "./db";

export interface SearchOptions {
  limit?: number;
  offset?: number;
}

export async function searchConversations(
  query: string,
  options: SearchOptions = {}
) {
  const { limit = 20, offset = 0 } = options;
  const conn = getConnection();

  const result = await conn.query(
    `
    SELECT 
      id,
      model_a_name,
      model_b_name,
      short_summary,
      keywords,
      categories,
      languages,
      timestamp,
      fts_main_conversations.match_bm25(id, $1) as score
    FROM conversations
    WHERE fts_main_conversations.match_bm25(id, $1) IS NOT NULL
    ORDER BY score DESC
    LIMIT $2 OFFSET $3
  `,
    [query, limit, offset]
  );

  // Compter le total
  const countResult = await conn.query(
    `
    SELECT COUNT(*) as total
    FROM conversations
    WHERE fts_main_conversations.match_bm25(id, $1) IS NOT NULL
  `,
    [query]
  );

  return {
    results: result.toArray(),
    total: countResult.toArray()[0].total,
    page: Math.floor(offset / limit) + 1,
    totalPages: Math.ceil(countResult.toArray()[0].total / limit),
  };
}

export async function getConversationById(id: number) {
  const conn = getConnection();

  const result = await conn.query(
    `
    SELECT * FROM conversations WHERE id = $1
  `,
    [id]
  );

  return result.toArray()[0];
}
```

**Étape 2.3 : Cache LRU**

```typescript
// src/lib/server/cache.ts
import { LRUCache } from "lru-cache";

const cache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 5, // 5 minutes
  updateAgeOnGet: true,
});

export function getCached<T>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, value);
}

export function clearCache(): void {
  cache.clear();
}
```

### Phase 3 : API Routes (Jour 5)

**Étape 3.1 : Endpoint de recherche**

```typescript
// src/routes/api/search/+server.ts
import { json } from "@sveltejs/kit";
import { searchConversations } from "$lib/server/search";
import { getCached, setCached } from "$lib/server/cache";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get("q") || "";
  const page = parseInt(url.searchParams.get("page") || "1");
  const limit = parseInt(url.searchParams.get("limit") || "20");

  if (!query || query.length < 2) {
    return json({ error: "Query too short" }, { status: 400 });
  }

  const cacheKey = `search:${query}:${page}:${limit}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return json(cached);
  }

  const offset = (page - 1) * limit;
  const results = await searchConversations(query, { limit, offset });

  setCached(cacheKey, results);

  return json(results);
};
```

**Étape 3.2 : Endpoint conversation**

```typescript
// src/routes/api/conversation/[id]/+server.ts
import { json } from "@sveltejs/kit";
import { getConversationById } from "$lib/server/search";
import { getCached, setCached } from "$lib/server/cache";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const id = parseInt(params.id);

  if (!id) {
    return json({ error: "Invalid ID" }, { status: 400 });
  }

  const cacheKey = `conversation:${id}`;
  const cached = getCached(cacheKey);

  if (cached) {
    return json(cached);
  }

  const conversation = await getConversationById(id);

  if (!conversation) {
    return json({ error: "Not found" }, { status: 404 });
  }

  setCached(cacheKey, conversation);

  return json(conversation);
};
```

### Phase 4 : Frontend (Jours 6-7)

**Étape 4.1 : Page principale**

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import SearchBar from '$lib/components/SearchBar.svelte';
  import ResultsList from '$lib/components/ResultsList.svelte';

  let searchQuery = $state('');
  let results = $state([]);
  let loading = $state(false);
  let error = $state('');
  let currentPage = $state(1);
  let totalPages = $state(1);

  async function performSearch(query: string, page = 1) {
    if (query.length < 2) return;

    loading = true;
    error = '';

    try {
      const response = await fetch(
        `/api/search?q=${encodeURIComponent(query)}&page=${page}`
      );

      if (!response.ok) {
        throw new Error('Search failed');
      }

      const data = await response.json();
      results = data.results;
      currentPage = data.page;
      totalPages = data.totalPages;
    } catch (err) {
      error = 'Une erreur est survenue lors de la recherche';
      console.error(err);
    } finally {
      loading = false;
    }
  }
</script>

<main class="container mx-auto px-4 py-8">
  <h1 class="text-4xl font-bold mb-8">Recherche de conversations</h1>

  <SearchBar
    bind:query={searchQuery}
    onSearch={performSearch}
  />

  {#if loading}
    <div class="text-center py-8">Recherche en cours...</div>
  {:else if error}
    <div class="text-red-600 py-4">{error}</div>
  {:else}
    <ResultsList
      {results}
      {currentPage}
      {totalPages}
      onPageChange={(page) => performSearch(searchQuery, page)}
    />
  {/if}
</main>
```

**Étape 4.2 : Composant SearchBar**

```svelte
<!-- src/lib/components/SearchBar.svelte -->
<script lang="ts">
  import { debounce } from '$lib/utils/debounce';

  let { query = $bindable(''), onSearch }: any = $props();

  const debouncedSearch = debounce((q: string) => {
    onSearch(q);
  }, 300);

  $effect(() => {
    if (query.length >= 2) {
      debouncedSearch(query);
    }
  });
</script>

<div class="mb-6">
  <input
    type="search"
    bind:value={query}
    placeholder="Rechercher dans les conversations..."
    class="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
  />
</div>
```

### Phase 5 : Tests et optimisation (Jour 8)

**Tests à effectuer :**

1. ✅ Recherche avec l'échantillon (12.6 MB)
2. ✅ Mesure des performances (temps de réponse)
3. ✅ Test avec fichier complet (1.61 GB)
4. ✅ Vérification de l'utilisation mémoire
5. ✅ Test de la pagination
6. ✅ Test du cache

## 📊 Critères de succès

### Performance

- ⚡ Indexation initiale : < 60 secondes
- ⚡ Temps de recherche : < 100ms
- 💾 Mémoire utilisée : < 500 MB
- 📦 Taille totale : < 2.5 GB (données + index)

### Fonctionnalités

- ✅ Recherche full-text instantanée
- ✅ Pagination des résultats
- ✅ Affichage des détails
- ✅ Highlight des termes recherchés
- ✅ Responsive design

### Qualité du code

- ✅ TypeScript strict
- ✅ Tests unitaires (optionnel)
- ✅ Documentation
- ✅ Code commenté

## 🚀 Commandes de développement

```bash
# Installation
npm install

# Développement (avec hot reload)
npm run dev

# Build pour production
npm run build

# Prévisualiser la build
npm run preview

# Démarrer en production
node build/index.js
```

## 📝 Configuration recommandée

### svelte.config.js

```javascript
import adapter from "@sveltejs/adapter-node";

export default {
  kit: {
    adapter: adapter({
      out: "build",
      precompress: true,
    }),
  },
};
```

### vite.config.ts

```typescript
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
});
```

## 🎯 Prochaines étapes suggérées

### Phase 1 (MVP)

1. ✅ Valider l'architecture avec vous
2. 🔄 Créer le projet SvelteKit
3. 🔄 Implémenter le backend avec DuckDB
4. 🔄 Créer l'interface de recherche
5. 🔄 Tester avec l'échantillon

### Phase 2 (Production)

1. 🔄 Optimiser les performances
2. 🔄 Tester avec le fichier complet
3. 🔄 Ajouter des filtres avancés (optionnel)
4. 🔄 Améliorer l'UI/UX
5. 🔄 Documentation utilisateur

### Phase 3 (Améliorations)

- Export des résultats
- Statistiques de recherche
- Mode sombre
- Recherche par similarité sémantique (embeddings)

## ❓ Questions ouvertes

1. **Préférence de format** : Souhaitez-vous utiliser le fichier Parquet (recommandé) ou JSONL ?
2. **Features supplémentaires** : Y a-t-il des fonctionnalités spécifiques que vous souhaitez ajouter ?
3. **Déploiement** : L'application sera-t-elle uniquement locale ou envisagez-vous un déploiement réseau ?

---

**Êtes-vous d'accord avec ce plan technique ?** Si oui, nous pouvons passer en mode Code pour l'implémentation ! 🚀
