<script lang="ts">
  import ResultCard from './ResultCard.svelte';
  import Pagination from './Pagination.svelte';
  import type { SearchResult } from '$lib/types/index.js';
  
  let { 
    results = [],
    loading = false,
    error = '',
    currentPage = 1,
    totalPages = 1,
    query = '',
    onPageChange,
    total = 0
  }: {
    results: SearchResult[];
    loading?: boolean;
    error?: string;
    currentPage: number;
    totalPages: number;
    query: string;
    onPageChange?: (page: number) => void;
    total?: number;
  } = $props();
  
  function handlePageChange(page: number) {
    if (onPageChange) {
      onPageChange(page);
    }
  }
</script>

<div class="results-list">
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
  {:else if results.length === 0 && query.length >= 2}
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
  {:else if results.length === 0}
    <div class="welcome-state">
      <div class="welcome-icon">💬</div>
      <h3>Rechercher des conversations</h3>
      <p>
        Tapez au moins 2 caractères dans la barre de recherche pour trouver des conversations.
      </p>
    </div>
  {:else}
    <div class="results-header">
      <h2 class="results-title">
        {total} résultat{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
        {#if query}
          pour "<strong>{query}</strong>"
        {/if}
      </h2>
    </div>
    
    <div class="results-container">
      {#each results as result (result.id)}
        <ResultCard 
          {result} 
          highlightQuery={query}
        />
      {/each}
    </div>
    
    {#if totalPages > 1}
      <div class="pagination-wrapper">
        <Pagination 
          {currentPage}
          {totalPages}
          onPageChange={handlePageChange}
        />
      </div>
    {/if}
  {/if}
</div>

<style>
  .results-list {
    width: 100%;
    max-width: 800px;
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
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
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
  
  @media (max-width: 640px) {
    .results-list {
      padding: 0 16px;
    }
    
    .suggestions {
      max-width: 100%;
    }
  }
</style>