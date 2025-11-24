import { searchConversations } from './search.js';
import { vectorDatabase, type VectorSearchResult } from './vector-db.js';
import type { SearchResult } from '$lib/types/index.js';

export interface UnifiedSearchResult {
	flexsearch: SearchResult[];
	vector: VectorSearchResult[];
	hybrid: VectorSearchResult[];
}

export interface SearchOptions {
	limit?: number;
	includeFlexsearch?: boolean;
	includeVector?: boolean;
	includeHybrid?: boolean;
}

export class UnifiedSearchService {
	private defaultOptions: SearchOptions = {
		limit: 10,
		includeFlexsearch: true,
		includeVector: true,
		includeHybrid: true
	};

	async search(query: string, options: SearchOptions = {}): Promise<UnifiedSearchResult> {
		const opts = { ...this.defaultOptions, ...options };
		const results: UnifiedSearchResult = {
			flexsearch: [],
			vector: [],
			hybrid: []
		};

		// Execute searches in parallel for better performance
		const searchPromises: Promise<void>[] = [];

		if (opts.includeFlexsearch) {
			searchPromises.push(
				this.executeFlexsearchSearch(query, opts.limit || 10).then((flexsearchResults) => {
					results.flexsearch = flexsearchResults;
				})
			);
		}

		if (opts.includeVector) {
			searchPromises.push(
				this.executeVectorSearch(query, opts.limit || 10).then((vectorResults) => {
					results.vector = vectorResults;
				})
			);
		}

		if (opts.includeHybrid) {
			searchPromises.push(
				this.executeHybridSearch(query, opts.limit || 10).then((hybridResults) => {
					results.hybrid = hybridResults;
				})
			);
		}

		await Promise.allSettled(searchPromises);

		return results;
	}

	private async executeFlexsearchSearch(query: string, limit: number): Promise<SearchResult[]> {
		try {
			const response = await searchConversations(query, { limit });
			return response.results;
		} catch (error) {
			console.error('FlexSearch failed:', error);
			return [];
		}
	}

	private async executeVectorSearch(query: string, limit: number): Promise<VectorSearchResult[]> {
		try {
			return await vectorDatabase.vectorSearch(query, limit);
		} catch (error) {
			console.error('Vector search failed:', error);
			return [];
		}
	}

	private async executeHybridSearch(query: string, limit: number): Promise<VectorSearchResult[]> {
		try {
			return await vectorDatabase.hybridSearch(query, limit);
		} catch (error) {
			console.error('Hybrid search failed:', error);
			return [];
		}
	}

	// Method to get only the best results across all search types
	async getBestResults(
		query: string,
		limit: number = 10
	): Promise<Array<SearchResult | VectorSearchResult>> {
		const results = await this.search(query, { limit });

		// Combine and score results from all search types
		const combinedResults: Array<{
			result: SearchResult | VectorSearchResult;
			score: number;
			source: string;
		}> = [];

		// Add FlexSearch results with normalized scores
		results.flexsearch.forEach((result, index) => {
			combinedResults.push({
				result,
				score: 1.0 - index / results.flexsearch.length, // Simple ranking score
				source: 'flexsearch'
			});
		});

		// Add vector search results with their similarity scores
		results.vector.forEach((result) => {
			combinedResults.push({
				result,
				score: result.similarity,
				source: 'vector'
			});
		});

		// Add hybrid search results with their similarity scores
		results.hybrid.forEach((result) => {
			combinedResults.push({
				result,
				score: result.similarity * 1.1, // Slightly boost hybrid results
				source: 'hybrid'
			});
		});

		// Remove duplicates (same ID) and sort by score
		const uniqueResults = new Map<string, (typeof combinedResults)[0]>();

		combinedResults.forEach((item) => {
			const id = String(item.result.id);
			const existing = uniqueResults.get(id);

			if (!existing || item.score > existing.score) {
				uniqueResults.set(id, item);
			}
		});

		return Array.from(uniqueResults.values())
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map((item) => item.result);
	}

	// Method to compare search performance and results
	async compareSearchMethods(
		query: string,
		limit: number = 10
	): Promise<{
		flexsearch: SearchResult[];
		vector: VectorSearchResult[];
		hybrid: VectorSearchResult[];
		stats: {
			flexsearchCount: number;
			vectorCount: number;
			hybridCount: number;
			overlap: number;
		};
	}> {
		const results = await this.search(query, { limit });

		const flexsearchIds = new Set(results.flexsearch.map((r) => String(r.id)));
		const vectorIds = new Set(results.vector.map((r) => r.id));
		const hybridIds = new Set(results.hybrid.map((r) => r.id));

		// Calculate overlap between methods
		const overlap = new Set<string>();
		flexsearchIds.forEach((id) => {
			if (vectorIds.has(id) || hybridIds.has(id)) {
				overlap.add(id);
			}
		});
		vectorIds.forEach((id) => {
			if (hybridIds.has(id) && !overlap.has(id)) {
				overlap.add(id);
			}
		});

		return {
			...results,
			stats: {
				flexsearchCount: flexsearchIds.size,
				vectorCount: vectorIds.size,
				hybridCount: hybridIds.size,
				overlap: overlap.size
			}
		};
	}

	// Health check method to verify all search services are working
	async healthCheck(): Promise<{
		flexsearch: boolean;
		vector: boolean;
		postgres: boolean;
		ollama: boolean;
	}> {
		const health = {
			flexsearch: false,
			vector: false,
			postgres: false,
			ollama: false
		};

		// Check FlexSearch
		try {
			await searchConversations('test', { limit: 1 });
			health.flexsearch = true;
		} catch (error) {
			console.error('FlexSearch health check failed:', error);
		}

		// Check PostgreSQL connection and vector database
		try {
			await vectorDatabase.getStats();
			health.postgres = true;
			health.vector = true;
		} catch (error) {
			console.error('PostgreSQL/vector health check failed:', error);
		}

		// Check Ollama service
		try {
			const { embeddingService } = await import('./embeddings.js');
			await embeddingService.generateEmbedding('test');
			health.ollama = true;
		} catch (error) {
			console.error('Ollama health check failed:', error);
		}

		return health;
	}
}

export const unifiedSearchService = new UnifiedSearchService();
