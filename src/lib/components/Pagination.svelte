<script lang="ts">
  let { 
    currentPage = 1,
    totalPages = 1,
    onPageChange
  }: {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  } = $props();
  
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages && page !== currentPage) {
      onPageChange(page);
    }
  }
  
  function goToPrevious() {
    goToPage(currentPage - 1);
  }
  
  function goToNext() {
    goToPage(currentPage + 1);
  }
  
  // Calcul des pages à afficher
  const pages = $derived(() => calculatePagesToShow(currentPage, totalPages));
  
  function calculatePagesToShow(page: number, total: number): number[] {
    const maxVisible = 7;
    const pages: number[] = [];
    
    if (total <= maxVisible) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
      return pages;
    }
    
    const half = Math.floor(maxVisible / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(total, page + half);
    
    if (start === 1) {
      end = Math.min(total, start + maxVisible - 1);
    } else if (end === total) {
      start = Math.max(1, end - maxVisible + 1);
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    
    return pages;
  }
  
  const showStartEllipsis = $derived(() => pages()[0] > 2);
  const showEndEllipsis = $derived(() => pages()[pages().length - 1] < totalPages - 1);
</script>

<div class="pagination" role="navigation" aria-label="Pagination">
  <!-- Bouton précédent -->
  <button 
    class="pagination-button nav-button"
    class:disabled={currentPage === 1}
    onclick={goToPrevious}
    disabled={currentPage === 1}
    aria-label="Page précédente"
  >
    ←
  </button>
  
  <!-- Première page + ellipsis -->
  {#if showStartEllipsis()}
    <button 
      class="pagination-button"
      onclick={() => goToPage(1)}
      aria-label="Aller à la page 1"
    >
      1
    </button>
    <span class="ellipsis">...</span>
  {/if}
  
  <!-- Pages visibles -->
  {#each pages() as page}
    {#if page !== 1 && page !== totalPages}
      <button 
        class="pagination-button"
        class:active={page === currentPage}
        onclick={() => goToPage(page)}
        aria-label={`Aller à la page ${page}`}
        aria-current={page === currentPage ? 'page' : undefined}
      >
        {page}
      </button>
    {/if}
  {/each}
  
  <!-- Dernière page + ellipsis -->
  {#if showEndEllipsis()}
    <span class="ellipsis">...</span>
    <button 
      class="pagination-button"
      onclick={() => goToPage(totalPages)}
      aria-label={`Aller à la page ${totalPages}`}
    >
      {totalPages}
    </button>
  {/if}
  
  <!-- Bouton suivant -->
  <button 
    class="pagination-button nav-button"
    class:disabled={currentPage === totalPages}
    onclick={goToNext}
    disabled={currentPage === totalPages}
    aria-label="Page suivante"
  >
    →
  </button>
</div>

<!-- Informations de pagination -->
<div class="pagination-info">
  Page {currentPage} sur {totalPages}
</div>

<style>
  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    margin-bottom: 16px;
  }
  
  .pagination-button {
    min-width: 40px;
    height: 40px;
    border: 1px solid #e2e8f0;
    background: white;
    color: #374151;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }
  
  .pagination-button:hover:not(.disabled):not(.active) {
    background: #f8fafc;
    border-color: #3b82f6;
    color: #1e40af;
  }
  
  .pagination-button.active {
    background: #3b82f6;
    border-color: #3b82f6;
    color: white;
  }
  
  .pagination-button.disabled {
    background: #f8fafc;
    color: #9ca3af;
    border-color: #e5e7eb;
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  .nav-button {
    font-size: 16px;
    font-weight: bold;
  }
  
  .ellipsis {
    color: #6b7280;
    padding: 0 8px;
    font-size: 14px;
    display: flex;
    align-items: center;
  }
  
  .pagination-info {
    text-align: center;
    color: #6b7280;
    font-size: 14px;
    font-weight: 500;
  }
  
  @media (max-width: 640px) {
    .pagination {
      flex-wrap: wrap;
      gap: 2px;
    }
    
    .pagination-button {
      min-width: 36px;
      height: 36px;
      font-size: 13px;
    }
    
    .pagination-info {
      margin-top: 8px;
    }
  }
</style>