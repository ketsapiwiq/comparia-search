# Comparia Search

Application de recherche de conversations IA avec SvelteKit et FlexSearch.

## Installation

```bash
cd comparia-search
npm install
```

Pour télécharger les données de conversations :

```bash
make data
```

*Note : La commande `make data` nécessite la variable d'environnement `HF_TOKEN` avec votre token HuggingFace.*

## Démarrage

```bash
npm run dev
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