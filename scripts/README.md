# Database Migration Scripts

This directory contains migration scripts to populate the PostgreSQL vector database with embeddings for existing conversations.

## Scripts

### 1. `migrate-from-flexsearch.mjs` (Recommended)

Extracts conversations directly from the existing FlexSearch database and populates the vector database.

**Usage:**

```bash
# Make sure PostgreSQL is running and Ollama is installed locally
docker-compose up -d postgres

# Make sure Ollama is running locally with the model
ollama pull mxbai-large

# Run the migration
node scripts/migrate-from-flexsearch.mjs
```

**Features:**

- Automatically extracts conversations from FlexSearch
- Processes conversations in batches to avoid overwhelming Ollama
- Includes progress tracking and error handling
- Retry mechanism for failed documents
- Graceful shutdown on interrupt

### 2. `migrate-embeddings.mjs`

Reads conversations from a JSONL file (if you have exported data) and populates the vector database.

**Usage:**

```bash
# Update DATA_FILE_PATH in the script to point to your data file
node scripts/migrate-embeddings.mjs
```

## Configuration

### Batch Size

Both scripts use batching to avoid overwhelming the Ollama service:

- `migrate-from-flexsearch.mjs`: 5 conversations per batch
- `migrate-embeddings.mjs`: 10 conversations per batch

### Delays

Built-in delays between batches to respect Ollama's rate limits:

- `migrate-from-flexsearch.mjs`: 3 seconds between batches
- `migrate-embeddings.mjs`: 2 seconds between batches

### Limits

- `migrate-from-flexsearch.mjs`: Limited to 1000 conversations to avoid system overload
- You can adjust `MAX_CONVERSATIONS` in the script if needed

## Prerequisites

1. **PostgreSQL with pgvector extension**:

   ```bash
   docker-compose up -d postgres
   ```

2. **Ollama with mxbai-large model**:

   ```bash
   # Install Ollama locally (if not already installed)
   curl -fsSL https://ollama.com/install.sh | sh

   # Start Ollama service
   ollama serve

   # Pull the required model
   ollama pull mxbai-large
   ```

3. **Environment variables** (optional, defaults are provided):
   - `POSTGRES_HOST` (default: localhost)
   - `POSTGRES_PORT` (default: 5432)
   - `POSTGRES_USER` (default: postgres)
   - `POSTGRES_PASSWORD` (default: postgres)
   - `POSTGRES_DB` (default: comparia)
   - `OLLAMA_HOST` (default: http://localhost:11434) - Make sure this matches your local Ollama installation

## Monitoring Progress

The scripts provide detailed progress information:

- Number of conversations processed
- Success/failure counts
- Processing rate (conversations per second)
- Estimated time remaining

## Error Handling

- Failed batches are retried document by document
- Individual document failures don't stop the migration
- Graceful shutdown on SIGINT/SIGTERM
- Detailed error logging

## Post-Migration

After migration completes, you can verify the results:

1. Check database statistics:

   ```bash
   # Connect to PostgreSQL
   docker exec -it postgres psql -U postgres -d comparia

   # Check document count
   SELECT COUNT(*) FROM documents;

   # Check embeddings count
   SELECT COUNT(*) FROM documents WHERE embedding IS NOT NULL;
   ```

2. Test the unified search:
   - Visit the web interface
   - Try different search types (unified, vector, hybrid)
   - Verify results are returned

## Troubleshooting

### Common Issues

1. **Ollama connection errors**:
   - Ensure Ollama is running locally: `ps aux | grep ollama`
   - Check if the model is pulled: `ollama list`
   - Verify OLLAMA_HOST environment variable (should be http://localhost:11434)
   - Make sure Ollama service is accessible: `curl http://localhost:11434/api/tags`

2. **PostgreSQL connection errors**:
   - Ensure PostgreSQL is running: `docker-compose ps`
   - Check database exists: `\l` in psql
   - Verify pgvector extension: `\dx` in psql

3. **Memory issues**:
   - Reduce batch size in the script
   - Increase delay between batches
   - Limit the number of conversations processed

### Manual Cleanup

If you need to reset the migration:

```sql
-- Connect to PostgreSQL
docker exec -it postgres psql -U postgres -d comparia

-- Delete all documents
DELETE FROM documents;

-- Reset the sequence
TRUNCATE documents RESTART IDENTITY;
```

## Performance Tips

1. **System Resources**: Ensure sufficient RAM and CPU for both PostgreSQL and Ollama
2. **Batch Tuning**: Adjust batch sizes based on your system capabilities
3. **Parallel Processing**: For large datasets, consider running multiple instances with different conversation ranges
4. **Monitoring**: Monitor system resources during migration

## Security Notes

- Migration scripts process conversation content that may contain sensitive information
- Ensure proper access controls on your PostgreSQL database
- Consider running migrations in a secure environment
- Review and sanitize conversation data if needed before migration
