import type { Conversation } from '$lib/types/index.js';

export interface EmbeddingResponse {
	embedding: number[];
	model: string;
}

export interface OllamaEmbedRequest {
	model: string;
	prompt: string;
}

export interface OllamaEmbedResponse {
	embedding: number[];
}

export class EmbeddingService {
	private ollamaHost: string;
	private model: string;
	private dimensions: number;
	private cache: Map<string, number[]> = new Map();
	private maxCacheSize: number;

	constructor() {
		this.ollamaHost = process.env.OLLAMA_HOST || 'http://localhost:11434';
		this.model = process.env.OLLAMA_MODEL || 'mxbai-large';
		this.dimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || '1024');
		this.maxCacheSize = parseInt(process.env.EMBEDDING_CACHE_SIZE || '100');
	}

	/**
	 * Generate embedding for a single text
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		if (!text || text.trim().length === 0) {
			throw new Error('Text cannot be empty for embedding generation');
		}

		// Check cache first
		const cacheKey = text.trim().toLowerCase();
		if (this.cache.has(cacheKey)) {
			console.log(`🎯 Embedding cache hit for: ${text.substring(0, 50)}...`);
			return this.cache.get(cacheKey)!;
		}

		try {
			console.log(`🔄 Generating embedding for: ${text.substring(0, 50)}...`);

			const response = await fetch(`${this.ollamaHost}/api/embeddings`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					model: this.model,
					prompt: text.trim()
				} as OllamaEmbedRequest)
			});

			if (!response.ok) {
				const errorText = await response.text();
				throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
			}

			const data = (await response.json()) as OllamaEmbedResponse;

			if (!data.embedding || !Array.isArray(data.embedding)) {
				throw new Error('Invalid embedding response from Ollama');
			}

			if (data.embedding.length !== this.dimensions) {
				console.warn(
					`⚠️ Embedding dimensions mismatch: expected ${this.dimensions}, got ${data.embedding.length}`
				);
			}

			// Cache the result
			this.addToCache(cacheKey, data.embedding);

			console.log(`✅ Embedding generated (${data.embedding.length} dimensions)`);
			return data.embedding;
		} catch (error) {
			console.error('❌ Error generating embedding:', error);
			throw new Error(
				`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Generate embeddings for multiple texts in batch
	 */
	async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
		const batchSize = parseInt(process.env.BATCH_SIZE || '50');
		const results: number[][] = [];

		console.log(`🔄 Generating embeddings for ${texts.length} texts (batch size: ${batchSize})`);

		for (let i = 0; i < texts.length; i += batchSize) {
			const batch = texts.slice(i, i + batchSize);
			console.log(
				`📊 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`
			);

			const batchPromises = batch.map((text) => this.generateEmbedding(text));
			const batchResults = await Promise.allSettled(batchPromises);

			for (let j = 0; j < batchResults.length; j++) {
				const result = batchResults[j];
				if (result.status === 'fulfilled') {
					results.push(result.value);
				} else {
					console.error(`❌ Failed to generate embedding for text ${i + j}:`, result.reason);
					// Add empty embedding to maintain array alignment
					results.push(new Array(this.dimensions).fill(0));
				}
			}

			// Small delay to avoid overwhelming Ollama
			if (i + batchSize < texts.length) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
		}

		console.log(`✅ Generated ${results.length} embeddings`);
		return results;
	}

	/**
	 * Generate embedding for conversation summary
	 */
	async generateSummaryEmbedding(conversation: Conversation): Promise<number[]> {
		const summaryText = this.prepareSummaryText(conversation);
		return this.generateEmbedding(summaryText);
	}

	/**
	 * Generate embedding for conversation content
	 */
	async generateContentEmbedding(conversation: Conversation): Promise<number[]> {
		const contentText = this.prepareContentText(conversation);
		return this.generateEmbedding(contentText);
	}

	/**
	 * Generate both summary and content embeddings for a conversation
	 */
	async generateConversationEmbeddings(conversation: Conversation): Promise<{
		summary_embedding: number[];
		content_embedding: number[];
	}> {
		console.log(`🔄 Generating embeddings for conversation ${conversation.id}`);

		const [summaryEmbedding, contentEmbedding] = await Promise.all([
			this.generateSummaryEmbedding(conversation),
			this.generateContentEmbedding(conversation)
		]);

		console.log(`✅ Generated embeddings for conversation ${conversation.id}`);
		return {
			summary_embedding: summaryEmbedding,
			content_embedding: contentEmbedding
		};
	}

	/**
	 * Prepare text for summary embedding
	 */
	private prepareSummaryText(conversation: Conversation): string {
		const parts: string[] = [];

		if (conversation.short_summary) {
			parts.push(conversation.short_summary);
		}

		if (conversation.keywords && conversation.keywords.length > 0) {
			parts.push('Keywords: ' + conversation.keywords.join(', '));
		}

		if (conversation.categories && conversation.categories.length > 0) {
			parts.push('Categories: ' + conversation.categories.join(', '));
		}

		if (conversation.opening_msg) {
			parts.push('Opening: ' + conversation.opening_msg);
		}

		parts.push(`Models: ${conversation.model_a_name} vs ${conversation.model_b_name}`);

		return parts.join('. ');
	}

	/**
	 * Prepare text for content embedding
	 */
	private prepareContentText(conversation: Conversation): string {
		const parts: string[] = [];

		// Add summary first for context
		if (conversation.short_summary) {
			parts.push(conversation.short_summary);
		}

		// Extract assistant responses from both conversations
		const extractAssistantMessages = (messages: any[]): string[] => {
			return messages
				.filter((msg) => msg.role === 'assistant' && msg.content)
				.map((msg) => msg.content);
		};

		const aMessages = extractAssistantMessages(conversation.conversation_a || []);
		const bMessages = extractAssistantMessages(conversation.conversation_b || []);

		parts.push('Model A responses: ' + aMessages.join(' '));
		parts.push('Model B responses: ' + bMessages.join(' '));

		return parts.join('. ');
	}

	/**
	 * Add embedding to cache with size management
	 */
	private addToCache(key: string, embedding: number[]): void {
		if (this.cache.size >= this.maxCacheSize) {
			// Remove oldest entry (first in Map)
			const firstKey = this.cache.keys().next().value;
			if (firstKey) {
				this.cache.delete(firstKey);
			}
		}
		this.cache.set(key, embedding);
	}

	/**
	 * Check if Ollama service is available
	 */
	async isHealthy(): Promise<boolean> {
		try {
			const response = await fetch(`${this.ollamaHost}/api/tags`, {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' }
			});

			if (!response.ok) {
				return false;
			}

			const data = await response.json();
			const models = data.models || [];
			const hasModel = models.some((model: any) => model.name === this.model);

			if (!hasModel) {
				console.warn(`⚠️ Model ${this.model} not found in Ollama`);
				return false;
			}

			return true;
		} catch (error) {
			console.error('❌ Ollama health check failed:', error);
			return false;
		}
	}

	/**
	 * Get model info
	 */
	getModelInfo(): { host: string; model: string; dimensions: number } {
		return {
			host: this.ollamaHost,
			model: this.model,
			dimensions: this.dimensions
		};
	}

	/**
	 * Clear cache
	 */
	clearCache(): void {
		this.cache.clear();
		console.log('🗑️ Embedding cache cleared');
	}

	/**
	 * Get cache statistics
	 */
	getCacheStats(): { size: number; maxSize: number } {
		return {
			size: this.cache.size,
			maxSize: this.maxCacheSize
		};
	}
}

// Singleton instance
export const embeddingService = new EmbeddingService();
