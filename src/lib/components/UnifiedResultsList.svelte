<script lang="ts">
	import ResultCard from './ResultCard.svelte';
	import Pagination from './Pagination.svelte';
	import type { SearchResult, VectorSearchResult, UnifiedSearchResult } from '$lib/types/index.js';

	let {
		unifiedResults,
		loading = false,
		error = '',
		currentPage = 1,
		totalPages = 1,
		query = '',
		onPageChange,
		total = 0,
		searchType = 'unified'
	}: {
		unifiedResults?: UnifiedSearchResult;
		results?: SearchResult[] | VectorSearchResult[] | Array<SearchResult | VectorSearchResult>;
		loading?: boolean;
		error?: string;
		currentPage: number;
		totalPages: number;
		query: string;
		onPageChange?: (page: number) => void;
		total?: number;
		searchType?: string;
	} = $props();

	function handlePageChange(page: number) {
		if (onPageChange) {
			onPageChange(page);
		}
	}

	function isVectorResult(result: SearchResult | VectorSearchResult): result is VectorSearchResult {
		return 'content' in result && 'url' in result;
	}

	function isSearchResult(result: SearchResult | VectorSearchResult): result is SearchResult {
		return 'model_a_name' in result && 'model_b_name' in result;
	}

	// Get the appropriate results array based on search type
	function getDisplayResults():
		| SearchResult[]
		| VectorSearchResult[]
		| Array<SearchResult | VectorSearchResult> {
		if (unifiedResults) {
			switch (searchType) {
				case 'flexsearch':
					return unifiedResults.flexsearch || [];
				case 'vector':
					return unifiedResults.vector || [];
				case 'hybrid':
					return unifiedResults.hybrid || [];
				case 'best':
					// For best results, we need to combine them, but they're already combined in the API response
					return [];
				default:
					return [];
			}
		}
		return [];
	}

	const displayResults = $derived(getDisplayResults());
</script>

<div class="unified-results">
	{#if loading}
		<div class="loading-state">
			<div class="loading-spinner"></div>
			<p>Recherche en cours...</p>
		</div>
	{:else if error}
		<div class="error-state">
			<div class="error-icon">⚠️</div>
			<p class="error-message">{error}</p>
		</div>
	{:else if !unifiedResults || (unifiedResults.flexsearch.length === 0 && unifiedResults.vector.length === 0 && unifiedResults.hybrid.length === 0 && query.length >= 2)}
		<div class="empty-state">
			<div class="empty-icon">🔍</div>
			<h3>Aucun résultat trouvé</h3>
			<p>
				Aucune conversation ne correspond à votre recherche "
				<strong>{query}</strong>"
			</p>
			<div class="suggestions">
				<p>Suggestions :</p>
				<ul>
					<li>Vérifiez l'orthographe des termes</li>
					<li>Essayez des mots-clés plus généraux</li>
					<li>Utilisez des synonymes</li>
				</ul>
			</div>
		</div>
	{:else if !unifiedResults || (unifiedResults.flexsearch.length === 0 && unifiedResults.vector.length === 0 && unifiedResults.hybrid.length === 0)}
		<div class="welcome-state">
			<div class="welcome-icon">💬</div>
			<h3>Rechercher des conversations</h3>
			<p>Tapez au moins 2 caractères dans la barre de recherche pour trouver des conversations.</p>
		</div>
	{:else}
		<!-- Unified Search Results -->
		{#if searchType === 'unified' && unifiedResults}
			<div class="unified-sections">
				<!-- FlexSearch Results -->
				{#if unifiedResults.flexsearch.length > 0}
					<section class="result-section">
						<h3 class="section-title">
							🔍 Recherche Full-Text ({unifiedResults.flexsearch.length} résultats)
						</h3>
						<div class="results-container">
							{#each unifiedResults.flexsearch as result (result.id)}
								<ResultCard {result} highlightQuery={query} />
							{/each}
						</div>
					</section>
				{/if}

				<!-- Vector Search Results -->
				{#if unifiedResults.vector.length > 0}
					<section class="result-section">
						<h3 class="section-title">
							🧠 Recherche Sémantique ({unifiedResults.vector.length} résultats)
						</h3>
						<div class="results-container">
							{#each unifiedResults.vector as result (result.id)}
								<div class="vector-result-card">
									<div class="card-header">
										<h4 class="result-title">{result.title}</h4>
										<div class="similarity-score">
											Similarité: {(result.similarity * 100).toFixed(1)}%
										</div>
									</div>
									<div class="result-content">
										{result.content}
									</div>
									<div class="result-url">
										<a href={result.url} target="_blank" rel="noopener noreferrer">
											{result.url}
										</a>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<!-- Hybrid Search Results -->
				{#if unifiedResults.hybrid.length > 0}
					<section class="result-section">
						<h3 class="section-title">
							⚡ Recherche Hybride ({unifiedResults.hybrid.length} résultats)
						</h3>
						<div class="results-container">
							{#each unifiedResults.hybrid as result (result.id)}
								<div class="vector-result-card hybrid">
									<div class="card-header">
										<h4 class="result-title">{result.title}</h4>
										<div class="similarity-score hybrid">
											Score Hybride: {(result.similarity * 100).toFixed(1)}%
										</div>
									</div>
									<div class="result-content">
										{result.content}
									</div>
									<div class="result-url">
										<a href={result.url} target="_blank" rel="noopener noreferrer">
											{result.url}
										</a>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		{:else}
			<!-- Single Search Type Results -->
			<div class="results-header">
				<h2 class="results-title">
					{total} résultat{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
					{#if query}
						pour "<strong>{query}</strong>"
					{/if}
				</h2>
			</div>

			<div class="results-container">
				{#each displayResults as result (result.id)}
					{#if isSearchResult(result)}
						<ResultCard {result} highlightQuery={query} />
					{:else if isVectorResult(result)}
						<div class="vector-result-card">
							<div class="card-header">
								<h4 class="result-title">{result.title}</h4>
								<div class="similarity-score">
									{searchType === 'hybrid' ? 'Score Hybride: ' : 'Similarité: '}
									{(result.similarity * 100).toFixed(1)}%
								</div>
							</div>
							<div class="result-content">
								{result.content}
							</div>
							<div class="result-url">
								<a href={result.url} target="_blank" rel="noopener noreferrer">
									{result.url}
								</a>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}

		{#if totalPages > 1}
			<div class="pagination-wrapper">
				<Pagination {currentPage} {totalPages} onPageChange={handlePageChange} />
			</div>
		{/if}
	{/if}
</div>

<style>
	.unified-results {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
	}

	.loading-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
		text-align: center;
	}

	.loading-spinner {
		width: 40px;
		height: 40px;
		border: 3px solid #e2e8f0;
		border-top: 3px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
		margin-bottom: 16px;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.error-state,
	.empty-state,
	.welcome-state {
		text-align: center;
		padding: 40px 20px;
	}

	.error-icon,
	.empty-icon,
	.welcome-icon {
		font-size: 48px;
		margin-bottom: 16px;
	}

	.error-message {
		color: #dc2626;
		font-weight: 500;
	}

	.empty-state h3,
	.welcome-state h3 {
		margin: 0 0 16px 0;
		color: #1e293b;
	}

	.empty-state p,
	.welcome-state p {
		color: #64748b;
		margin: 0 0 24px 0;
		line-height: 1.6;
	}

	.suggestions {
		text-align: left;
		background: #f8fafc;
		padding: 20px;
		border-radius: 8px;
		border-left: 4px solid #3b82f6;
		max-width: 400px;
		margin: 0 auto;
	}

	.suggestions p {
		font-weight: 600;
		color: #1e293b;
		margin-bottom: 8px;
	}

	.suggestions ul {
		margin: 0;
		padding-left: 20px;
	}

	.suggestions li {
		margin-bottom: 4px;
		color: #64748b;
	}

	.results-header {
		margin-bottom: 20px;
	}

	.results-title {
		font-size: 18px;
		font-weight: 600;
		color: #1e293b;
		margin: 0;
		padding: 0;
	}

	.results-container {
		margin-bottom: 24px;
	}

	.pagination-wrapper {
		display: flex;
		justify-content: center;
		margin-top: 32px;
	}

	.unified-sections {
		display: flex;
		flex-direction: column;
		gap: 40px;
	}

	.result-section {
		border: 1px solid #e2e8f0;
		border-radius: 12px;
		padding: 20px;
		background: #fafafa;
	}

	.section-title {
		font-size: 16px;
		font-weight: 600;
		color: #1e293b;
		margin: 0 0 16px 0;
		padding-bottom: 8px;
		border-bottom: 2px solid #e2e8f0;
	}

	.vector-result-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 12px;
		transition: all 0.2s ease;
	}

	.vector-result-card:hover {
		border-color: #3b82f6;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.vector-result-card.hybrid {
		border-left: 4px solid #8b5cf6;
	}

	.vector-result-card .card-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 12px;
	}

	.result-title {
		font-size: 16px;
		font-weight: 600;
		color: #1e293b;
		margin: 0;
		line-height: 1.4;
		flex: 1;
		margin-right: 16px;
	}

	.similarity-score {
		font-size: 12px;
		color: #64748b;
		background: #f1f5f9;
		padding: 4px 8px;
		border-radius: 4px;
		white-space: nowrap;
		font-weight: 500;
	}

	.similarity-score.hybrid {
		background: #f3e8ff;
		color: #8b5cf6;
	}

	.result-content {
		font-size: 14px;
		line-height: 1.5;
		color: #374151;
		margin-bottom: 12px;
		max-height: 100px;
		overflow-y: auto;
	}

	.result-url {
		font-size: 12px;
		color: #64748b;
	}

	.result-url a {
		color: #3b82f6;
		text-decoration: none;
	}

	.result-url a:hover {
		text-decoration: underline;
	}

	@media (max-width: 640px) {
		.unified-results {
			padding: 0 16px;
		}

		.suggestions {
			max-width: 100%;
		}

		.result-section {
			padding: 16px;
		}

		.vector-result-card .card-header {
			flex-direction: column;
			gap: 8px;
		}

		.result-title {
			margin-right: 0;
		}
	}
</style>
