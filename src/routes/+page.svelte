<script lang="ts">
  import SearchBar from '$lib/components/SearchBar.svelte';
  import ResultsList from '$lib/components/ResultsList.svelte';
  import type { SearchResult } from '$lib/types/index.js';
  
  let searchQuery = $state('');
  let results = $state<SearchResult[]>([]);
  let loading = $state(false);
  let error = $state('');
  let currentPage = $state(1);
  let totalPages = $state(1);
  let total = $state(0);
  
  async function performSearch(query: string, page = 1) {
    if (!query || query.trim().length < 2) {
      results = [];
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
        limit: '20'
      });
      
      const response = await fetch(`/api/search?${params}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Recherche failed');
      }
      
      const data = await response.json();
      results = data.results || [];
      currentPage = data.page;
      totalPages = data.totalPages;
      total = data.total;
      
    } catch (err) {
      console.error('Error during search:', err);
      error = err instanceof Error ? err.message : 'Une erreur est survenue lors de la recherche';
      results = [];
      currentPage = 1;
      totalPages = 1;
      total = 0;
    } finally {
      loading = false;
    }
  }
  
  function handlePageChange(page: number) {
    if (page !== currentPage && searchQuery.trim().length >= 2) {
      currentPage = page;
      performSearch(searchQuery, page);
    }
  }
  
  function handleSearch(query: string) {
    searchQuery = query;
    currentPage = 1;
    if (query.trim().length >= 2) {
      performSearch(query, 1);
    } else {
      results = [];
      error = '';
      totalPages = 1;
      total = 0;
    }
  }
  
  // Gérer le navigateur back/forward
  $effect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlQuery = urlParams.get('q') || '';
    const urlPage = parseInt(urlParams.get('page') || '1');
    
    if (urlQuery !== searchQuery || urlPage !== currentPage) {
      searchQuery = urlQuery;
      currentPage = urlPage;
      
      if (urlQuery.length >= 2) {
        performSearch(urlQuery, urlPage);
      }
    }
  });
  
  // Mettre à jour l'URL lors de la recherche
  $effect(() => {
    if (searchQuery.trim().length >= 2) {
      const url = new URL(window.location.pathname, window.location.origin);
      url.searchParams.set('q', searchQuery.trim());
      url.searchParams.set('page', currentPage.toString());
      
      if (window.location.search !== url.search) {
        window.history.pushState(null, '', url.toString());
      }
    } else if (searchQuery.trim().length === 0) {
      const url = new URL(window.location.pathname, window.location.origin);
      if (window.location.search !== '') {
        window.history.pushState(null, '', url.toString());
      }
    }
  });
</script>

<svelte:head>
  <title>
    {searchQuery.trim().length >= 2 ? `"${searchQuery}" - Recherche de conversations` : 'Recherche de conversations'}
  </title>
  <meta name="description" content="Recherche full-text instantanée dans des milliers de conversations IA" />
</svelte:head>

<main class="container">
  <header class="header">
    <h1 class="title">🔍 Recherche de Conversations</h1>
    <p class="subtitle">
      Explorez des milliers de conversations entre modèles de langage avec une recherche full-text instantanée
    </p>
  </header>
  
  <div class="search-section">
    <SearchBar
      query={searchQuery}
      onSearch={handleSearch}
      {loading}
    />
  </div>
  
  <div class="results-section">
    <ResultsList 
      {results}
      {loading}
      {error}
      {currentPage}
      {totalPages}
      query={searchQuery.trim()}
      onPageChange={handlePageChange}
      {total}
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