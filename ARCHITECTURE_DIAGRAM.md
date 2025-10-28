# Diagrammes d'architecture

## Flux de données et architecture globale

```mermaid
graph TB
    subgraph Client["Client - Navigateur"]
        UI[Interface Svelte]
        SB[SearchBar Component]
        RL[ResultsList Component]
        CV[ConversationView Component]
    end

    subgraph Server["SvelteKit Server"]
        API[API Routes]
        SE[Search Engine Service]
        DL[Data Loader]
        CACHE[Cache LRU]
    end

    subgraph Storage["Stockage Local"]
        PARQUET[conversations.parquet<br/>1.61 GB]
        JSONL[conversations.jsonl<br/>3.78 GB]
        SAMPLE[conversations_samples.jsonl<br/>12.6 MB]
    end

    subgraph Index["Index de recherche"]
        DUCKDB[DuckDB + FTS Index]
        FLEX[FlexSearch Index<br/>alternative]
    end

    UI --> SB
    UI --> RL
    UI --> CV

    SB -->|query| API
    RL -->|page, limit| API
    CV -->|conversation id| API

    API --> CACHE
    CACHE -->|miss| SE
    CACHE -->|hit| API

    SE --> DL
    SE --> DUCKDB
    SE --> FLEX

    DL --> PARQUET
    DL --> JSONL
    DL --> SAMPLE

    DUCKDB --> PARQUET
    FLEX --> JSONL

    API -->|results| RL
    API -->|conversation| CV

    style Client fill:#e1f5ff
    style Server fill:#fff4e1
    style Storage fill:#f0f0f0
    style Index fill:#e8f5e9
```

## Flux de recherche détaillé

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant UI as Interface Svelte
    participant API as API Route
    participant Cache as Cache LRU
    participant SE as Search Engine
    participant DB as DuckDB/FlexSearch
    participant Data as Fichier Parquet/JSONL

    U->>UI: Tape une requête
    Note over UI: Debounce 300ms
    UI->>API: GET /api/search?q=query&page=1
    API->>Cache: Vérifie cache
    alt Cache hit
        Cache-->>API: Résultats en cache
        API-->>UI: JSON Response
    else Cache miss
        Cache-->>API: Pas en cache
        API->>SE: search(query, options)
        SE->>DB: Requête full-text
        DB->>Data: Lecture si nécessaire
        Data-->>DB: Données
        DB-->>SE: Résultats + scores
        SE-->>API: Résultats formatés
        API->>Cache: Mise en cache
        API-->>UI: JSON Response
    end
    UI->>UI: Affiche résultats
    U->>UI: Clique sur résultat
    UI->>API: GET /api/conversation/842893
    API->>Cache: Vérifie cache
    alt Cache hit
        Cache-->>API: Conversation en cache
    else Cache miss
        API->>SE: getConversation(id)
        SE->>DB: SELECT by ID
        DB-->>SE: Conversation complète
        SE-->>API: Conversation formatée
        API->>Cache: Mise en cache
    end
    API-->>UI: JSON Response
    UI->>UI: Affiche conversation
```

## Architecture des composants Svelte

```mermaid
graph TD
    subgraph "Page principale +page.svelte"
        PAGE[Page Component]
        STATE[State Management<br/>searchQuery, results, loading]
    end

    subgraph "Composants enfants"
        SB[SearchBar.svelte<br/>- Input debounced<br/>- Loading indicator]
        RL[ResultsList.svelte<br/>- Virtual list<br/>- Pagination]
        RC[ResultCard.svelte<br/>- Preview<br/>- Metadata<br/>- Highlight]
        PAG[Pagination.svelte<br/>- Page controls]
    end

    subgraph "Page détail /conversation/[id]"
        DET[+page.svelte]
        CV[ConversationView.svelte<br/>- Full conversation<br/>- Metadata panel]
    end

    PAGE --> STATE
    STATE --> SB
    STATE --> RL
    RL --> RC
    RL --> PAG

    DET --> CV

    style PAGE fill:#90caf9
    style SB fill:#a5d6a7
    style RL fill:#a5d6a7
    style RC fill:#c5e1a5
    style CV fill:#a5d6a7
```

## Stratégie d'indexation - Option DuckDB

```mermaid
flowchart LR
    subgraph Init["Initialisation serveur"]
        START[Démarrage<br/>SvelteKit]
        HOOK[hooks.server.ts]
        INIT[initSearchEngine]
    end

    subgraph Load["Chargement données"]
        READ[Lecture Parquet]
        TABLE[Création table<br/>DuckDB]
        FTS[Création index<br/>Full-Text Search]
    end

    subgraph Ready["Prêt"]
        SERVE[Serveur prêt<br/>Recherche disponible]
    end

    START --> HOOK
    HOOK --> INIT
    INIT --> READ
    READ --> TABLE
    TABLE --> FTS
    FTS --> SERVE

    style Init fill:#ffccbc
    style Load fill:#fff9c4
    style Ready fill:#c8e6c9
```

## Performance et optimisations

```mermaid
graph TB
    subgraph "Optimisations Frontend"
        DEB[Debouncing<br/>300ms]
        VIRT[Virtual List<br/>svelte-virtual-list]
        LAZY[Lazy loading<br/>images/metadata]
    end

    subgraph "Optimisations Backend"
        CACHE[Cache LRU<br/>500 entrées, 5min TTL]
        INDEX[Index pré-calculé<br/>au démarrage]
        PAG[Pagination<br/>LIMIT/OFFSET]
    end

    subgraph "Optimisations Données"
        PARQ[Format Parquet<br/>Compact: 1.61 GB vs 3.78 GB]
        STREAM[Streaming<br/>si JSONL]
        COMP[Compression]
    end

    DEB -.->|Réduit requêtes| CACHE
    VIRT -.->|Réduit DOM| PAG
    INDEX -.->|Recherche rapide| PARQ

    style DEB fill:#e1bee7
    style CACHE fill:#e1bee7
    style PARQ fill:#e1bee7
```

## Comparaison des solutions d'indexation

```mermaid
graph LR
    subgraph "Option 1: DuckDB"
        D1[Format: Parquet]
        D2[Taille: 1.61 GB]
        D3[Indexation: 30-60s]
        D4[Recherche: 100ms]
        D5[Mémoire: 200-400 MB]
    end

    subgraph "Option 2: FlexSearch"
        F1[Format: JSONL]
        F2[Taille: 3.78 GB]
        F3[Indexation: 2-5 min]
        F4[Recherche: 50ms]
        F5[Mémoire: 2-3 GB]
    end

    subgraph "Recommandation"
        REC[DuckDB<br/>Meilleur ratio<br/>performance/mémoire]
    end

    D1 & D2 & D3 & D4 & D5 --> REC

    style REC fill:#4caf50,color:#fff
```
