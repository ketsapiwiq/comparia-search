import { Pool } from 'pg';
import { embeddingService } from './embeddings.js';

export interface VectorDocument {
	id: string;
	title: string;
	url: string;
	content: string;
	embedding?: number[];
}

export interface VectorSearchResult {
	id: string;
	title: string;
	url: string;
	content: string;
	similarity: number;
}

export class VectorDatabase {
	private pool: Pool;
	private initialized = false;

	constructor() {
		this.pool = new Pool({
			host: process.env.POSTGRES_HOST || 'localhost',
			port: parseInt(process.env.POSTGRES_PORT || '5432'),
			user: process.env.POSTGRES_USER || 'postgres',
			password: process.env.POSTGRES_PASSWORD || 'postgres',
			database: process.env.POSTGRES_DB || 'comparia'
		});
	}

	private async ensureInitialized() {
		if (this.initialized) return;

		try {
			const client = await this.pool.connect();

			// Test connection and ensure table exists
			await client.query(`
				CREATE TABLE IF NOT EXISTS documents (
					id TEXT PRIMARY KEY,
					title TEXT NOT NULL,
					url TEXT NOT NULL,
					content TEXT NOT NULL,
					embedding vector(1024),
					search_vector tsvector,
					created_at TIMESTAMP DEFAULT NOW()
				);
			`);

			// Create indexes for better performance
			await client.query(`
				CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
				USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
			`);

			await client.query(`
				CREATE INDEX IF NOT EXISTS documents_search_vector_idx ON documents 
				USING gin (search_vector);
			`);

			client.release();
			this.initialized = true;
		} catch (error) {
			console.error('Failed to initialize vector database:', error);
			throw error;
		}
	}

	async addDocument(doc: Omit<VectorDocument, 'embedding'>): Promise<void> {
		await this.ensureInitialized();

		try {
			// Generate embedding for the document
			const embedding = await embeddingService.generateEmbedding(`${doc.title} ${doc.content}`);

			const client = await this.pool.connect();
			await client.query(
				`
				INSERT INTO documents (id, title, url, content, embedding, search_vector)
				VALUES ($1, $2, $3, $4, $5::vector, to_tsvector('french', $2 || ' ' || $4))
				ON CONFLICT (id) DO UPDATE SET
					title = EXCLUDED.title,
					url = EXCLUDED.url,
					content = EXCLUDED.content,
					embedding = EXCLUDED.embedding,
					search_vector = EXCLUDED.search_vector;
			`,
				[doc.id, doc.title, doc.url, doc.content, `[${embedding.join(',')}]`]
			);
			client.release();
		} catch (error) {
			console.error('Failed to add document:', error);
			throw error;
		}
	}

	async addDocuments(docs: Omit<VectorDocument, 'embedding'>[]): Promise<void> {
		await this.ensureInitialized();

		// Process documents in batches to avoid overwhelming the embedding service
		const batchSize = 5;
		for (let i = 0; i < docs.length; i += batchSize) {
			const batch = docs.slice(i, i + batchSize);
			await Promise.all(batch.map((doc) => this.addDocument(doc)));
		}
	}

	async vectorSearch(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
		await this.ensureInitialized();

		try {
			// Generate embedding for the query
			const queryEmbedding = await embeddingService.generateEmbedding(query);

			const client = await this.pool.connect();
			const { rows } = await client.query(
				`
				SELECT id, title, url, content, 
					   1 - (embedding <=> $1::vector) as similarity
				FROM documents
				WHERE embedding IS NOT NULL
				ORDER BY embedding <=> $1::vector
				LIMIT $2;
			`,
				[`[${queryEmbedding.join(',')}]`, limit]
			);
			client.release();

			return rows;
		} catch (error) {
			console.error('Vector search failed:', error);
			throw error;
		}
	}

	async fullTextSearch(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
		await this.ensureInitialized();

		try {
			const client = await this.pool.connect();
			const { rows } = await client.query(
				`
				SELECT id, title, url, content, 
					   ts_rank(search_vector, plainto_tsquery('french', $1)) as similarity
				FROM documents
				WHERE search_vector @@ plainto_tsquery('french', $1)
				ORDER BY similarity DESC
				LIMIT $2;
			`,
				[query, limit]
			);
			client.release();

			return rows;
		} catch (error) {
			console.error('Full-text search failed:', error);
			throw error;
		}
	}

	async hybridSearch(query: string, limit: number = 10): Promise<VectorSearchResult[]> {
		await this.ensureInitialized();

		try {
			// Generate embedding for the query
			const queryEmbedding = await embeddingService.generateEmbedding(query);

			const client = await this.pool.connect();
			const { rows } = await client.query(
				`
				SELECT id, title, url, content,
					   (0.5 * (1 - (embedding <=> $1::vector)) + 
						0.5 * ts_rank(search_vector, plainto_tsquery('french', $2))) as similarity
				FROM documents
				WHERE embedding IS NOT NULL 
				  AND search_vector @@ plainto_tsquery('french', $2)
				ORDER BY similarity DESC
				LIMIT $3;
			`,
				[`[${queryEmbedding.join(',')}]`, query, limit]
			);
			client.release();

			return rows;
		} catch (error) {
			console.error('Hybrid search failed:', error);
			throw error;
		}
	}

	async getDocument(id: string): Promise<VectorDocument | null> {
		await this.ensureInitialized();

		try {
			const client = await this.pool.connect();
			const { rows } = await client.query(
				`
				SELECT id, title, url, content, embedding
				FROM documents
				WHERE id = $1;
			`,
				[id]
			);
			client.release();

			return rows[0] || null;
		} catch (error) {
			console.error('Failed to get document:', error);
			throw error;
		}
	}

	async deleteDocument(id: string): Promise<void> {
		await this.ensureInitialized();

		try {
			const client = await this.pool.connect();
			await client.query('DELETE FROM documents WHERE id = $1;', [id]);
			client.release();
		} catch (error) {
			console.error('Failed to delete document:', error);
			throw error;
		}
	}

	async getStats(): Promise<{ totalDocuments: number; documentsWithEmbeddings: number }> {
		await this.ensureInitialized();

		try {
			const client = await this.pool.connect();
			const { rows } = await client.query(`
				SELECT 
					COUNT(*) as total_documents,
					COUNT(embedding) as documents_with_embeddings
				FROM documents;
			`);
			client.release();

			return {
				totalDocuments: parseInt(rows[0].total_documents),
				documentsWithEmbeddings: parseInt(rows[0].documents_with_embeddings)
			};
		} catch (error) {
			console.error('Failed to get stats:', error);
			throw error;
		}
	}
}

export const vectorDatabase = new VectorDatabase();
