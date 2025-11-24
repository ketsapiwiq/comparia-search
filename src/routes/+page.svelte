<script lang="ts">
	import SearchBar from '$lib/components/SearchBar.svelte';
	import UnifiedResultsList from '$lib/components/UnifiedResultsList.svelte';
	import type {
		SearchResult,
		UnifiedSearchResult,
		UnifiedSearchResponse
	} from '$lib/types/index.js';

	let searchQuery = $state('');
	let searchType = $state<'flexsearch' | 'vector' | 'hybrid' | 'unified' | 'best' | 'compare'>(
		'unified'
	);
	let unifiedResults = $state<UnifiedSearchResult | undefined>();
	let results = $state<SearchResult[] | []>([]);
	let loading = $state(false);
	let error = $state('');
	let currentPage = $state(1);
	let totalPages = $state(1);
	let total = $state(0);

	// Debug: Track results changes
	$effect(() => {
		console.log('🔄 Results changed:', {
			resultsCount: results.length,
			loading,
			error,
			query: searchQuery,
			currentPage
		});
	});

	async function performSearch(query: string, page = 1) {
		console.log('🚀 performSearch called:', { query, page, searchType });

		if (!query || query.trim().length < 2) {
			console.log('❌ Query too short, clearing results');
			results = [];
			unifiedResults = undefined;
			error = '';
			currentPage = 1;
			totalPages = 1;
			total = 0;
			return;
		}

		loading = true;
		error = '';

		try {
			const params = new URLSearchParams({
				q: query.trim(),
				page: page.toString(),
				limit: '20',
				type: searchType
			});

			console.log('📡 Fetching search results...', params.toString());
			const response = await fetch(`/api/search?${params}`);

			if (!response.ok) {
				const errorData = await response.json();
				throw new Error(errorData.error || 'Recherche failed');
			}

			const data: UnifiedSearchResponse = await response.json();
			console.log('📊 Search response received:', data);

			// Handle different response types
			if (searchType === 'unified') {
				unifiedResults = {
					flexsearch: data.flexsearch || [],
					vector: data.vector || [],
					hybrid: data.hybrid || []
				};
				results = [];
			} else {
				results = data.results || [];
				unifiedResults = undefined;
			}

			currentPage = data.page;
			totalPages = data.totalPages;
			total = data.total;

			console.log('✅ Results updated:', {
				searchType,
				resultsCount: results.length,
				unifiedResults: unifiedResults
					? {
							flexsearch: unifiedResults.flexsearch.length,
							vector: unifiedResults.vector.length,
							hybrid: unifiedResults.hybrid.length
						}
					: undefined,
				total,
				currentPage,
				totalPages
			});
		} catch (err) {
			console.error('❌ Error during search:', err);
			error = err instanceof Error ? err.message : 'Une erreur est survenue lors de la recherche';
			results = [];
			unifiedResults = undefined;
			currentPage = 1;
			totalPages = 1;
			total = 0;
		} finally {
			loading = false;
			console.log('🏁 Search completed, loading = false');
		}
	}

	function handlePageChange(page: number) {
		if (page !== currentPage && searchQuery.trim().length >= 2) {
			currentPage = page;
			performSearch(searchQuery, page);
		}
	}

	function handleSearchTypeChange(type: typeof searchType) {
		searchType = type;
		currentPage = 1;
		if (searchQuery.trim().length >= 2) {
			performSearch(searchQuery, 1);
		}
	}

	function handleSearch(query: string) {
		searchQuery = query;
		currentPage = 1;
		if (query.trim().length >= 2) {
			performSearch(query, 1);
		} else {
			results = [];
			unifiedResults = undefined;
			error = '';
			totalPages = 1;
			total = 0;
			// Force URL update to clear search params
			const url = new URL(window.location.pathname, window.location.origin);
			if (window.location.search !== '') {
				window.history.replaceState(null, '', url.toString());
			}
		}
	}

	// Initial load from URL
	$effect(() => {
		const urlParams = new URLSearchParams(window.location.search);
		const urlQuery = urlParams.get('q') || '';
		const urlPage = parseInt(urlParams.get('page') || '1');
		const urlType = (urlParams.get('type') as typeof searchType) || 'unified';

		// Only initialize on first load, not on every change
		if (searchQuery === '' && currentPage === 1) {
			searchQuery = urlQuery;
			currentPage = urlPage;
			searchType = urlType;

			if (urlQuery.length >= 2) {
				performSearch(urlQuery, urlPage);
			}
		}
	});

	// Mettre à jour l'URL lors de la recherche (mais éviter les boucles)
	$effect(() => {
		if (loading) return; // Ne pas mettre à jour l'URL pendant le chargement

		const url = new URL(window.location.pathname, window.location.origin);

		if (searchQuery.trim().length >= 2) {
			url.searchParams.set('q', searchQuery.trim());
			url.searchParams.set('page', currentPage.toString());
			url.searchParams.set('type', searchType);
		} else {
			url.searchParams.delete('q');
			url.searchParams.delete('page');
			url.searchParams.delete('type');
		}

		if (window.location.search !== url.search) {
			window.history.replaceState(null, '', url.toString());
		}
	});
</script>

<svelte:head>
	<title>
		{searchQuery.trim().length >= 2
			? `"${searchQuery}" - Recherche de conversations`
			: 'Recherche de conversations'}
	</title>
	<meta
		name="description"
		content="Recherche full-text instantanée dans des milliers de conversations IA"
	/>
</svelte:head>

<main class="container">
	<header class="header">
		<h1 class="title">🔍 Recherche de Conversations</h1>
		<p class="subtitle">
			Explorez des milliers de conversations entre modèles de langage avec recherche full-text,
			sémantique et hybride
		</p>

		<!-- Search Type Selector -->
		<div class="search-type-selector">
			<label for="search-type" class="selector-label">Type de recherche:</label>
			<select
				id="search-type"
				bind:value={searchType}
				onchange={() => handleSearchTypeChange(searchType)}
				class="search-type-select"
			>
				<option value="unified">🎯 Unifiée (toutes)</option>
				<option value="flexsearch">🔍 Full-Text</option>
				<option value="vector">🧠 Sémantique</option>
				<option value="hybrid">⚡ Hybride</option>
				<option value="best">🏆 Meilleurs résultats</option>
				<option value="compare">📊 Comparer</option>
			</select>
		</div>
	</header>

	<div class="search-section">
		<SearchBar query={searchQuery} onSearch={handleSearch} {loading} />
	</div>

	<div class="results-section">
		<UnifiedResultsList
			{unifiedResults}
			{results}
			{loading}
			{error}
			{currentPage}
			{totalPages}
			query={searchQuery.trim()}
			onPageChange={handlePageChange}
			{total}
			{searchType}
		/>
	</div>

	{#if results.length > 0}
		<footer class="footer">
			<div class="stats">
				<span class="stat">
					{total} résultat{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
				</span>
				<span class="stat">
					Page {currentPage} sur {totalPages}
				</span>
			</div>
		</footer>
	{/if}
</main>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 0 20px;
		min-height: 100vh;
	}

	.header {
		text-align: center;
		padding: 40px 0 30px 0;
	}

	.title {
		font-size: 2.5rem;
		font-weight: 700;
		color: #1e293b;
		margin: 0 0 12px 0;
		line-height: 1.2;
	}

	.subtitle {
		font-size: 1.1rem;
		color: #64748b;
		margin: 0;
		line-height: 1.6;
		max-width: 600px;
		margin-left: auto;
		margin-right: auto;
		margin-bottom: 24px;
	}

	.search-type-selector {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-top: 20px;
	}

	.selector-label {
		font-size: 14px;
		font-weight: 600;
		color: #374151;
	}

	.search-type-select {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: white;
		font-size: 14px;
		color: #374151;
		cursor: pointer;
		transition: border-color 0.2s ease;
	}

	.search-type-select:hover {
		border-color: #3b82f6;
	}

	.search-type-select:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.search-section {
		margin-bottom: 30px;
	}

	.results-section {
		margin-bottom: 40px;
	}

	.footer {
		border-top: 1px solid #e2e8f0;
		padding-top: 20px;
		margin-top: 40px;
	}

	.stats {
		display: flex;
		justify-content: center;
		gap: 20px;
		flex-wrap: wrap;
	}

	.stat {
		font-size: 14px;
		color: #64748b;
		font-weight: 500;
	}

	@media (max-width: 768px) {
		.container {
			padding: 0 16px;
		}

		.header {
			padding: 30px 0 20px 0;
		}

		.title {
			font-size: 2rem;
		}

		.subtitle {
			font-size: 1rem;
		}
	}

	@media (max-width: 480px) {
		.title {
			font-size: 1.75rem;
		}

		.stats {
			flex-direction: column;
			gap: 8px;
			text-align: center;
		}
	}
</style>
