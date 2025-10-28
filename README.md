# Comparia Search

Application de recherche de conversations IA avec SvelteKit et FlexSearch.

## Installation

```bash
cd comparia-search
yarn install
```

## Démarrage

```bash
yarn dev
```

L'application sera disponible sur http://localhost:5173

## Utilisation

1. L'application indexe automatiquement les conversations depuis `static/data/conversations.jsonl`
2. Utilisez la barre de recherche pour trouver des conversations
3. Les résultats incluent les résumés, mots-clés et modèles IA

## Structure

- `src/lib/server/` - Logique backend (recherche, indexation)
- `src/routes/` - Pages et API endpoints
- `static/data/` - Fichiers de données