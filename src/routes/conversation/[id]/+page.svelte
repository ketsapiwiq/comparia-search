<script lang="ts">
  import { onMount } from 'svelte';
  import type { Conversation } from '$lib/types/index.js';
  
  let { params } = $props();
  let conversation = $state<Conversation | null>(null);
  let loading = $state(true);
  let error = $state('');
  let activeTab = $state<'a' | 'b'>('a');
  
  onMount(async () => {
    await loadConversation(params.id);
  });
  
  async function loadConversation(id: string) {
    loading = true;
    error = '';
    
    try {
      const response = await fetch(`/api/conversation/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Conversation non trouvée');
        }
        throw new Error('Erreur lors du chargement de la conversation');
      }
      
      const data = await response.json();
      conversation = data;
      
    } catch (err) {
      console.error('Error loading conversation:', err);
      error = err instanceof Error ? err.message : 'Une erreur est survenue';
    } finally {
      loading = false;
    }
  }
  
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  function formatTokens(tokens?: number | null): string {
    if (!tokens) return '0';
    return tokens.toLocaleString('fr-FR');
  }
  
  function getRoleIcon(role: string): string {
    switch (role.toLowerCase()) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'system': return '⚙️';
      default: return '❓';
    }
  }
  
  function getRoleLabel(role: string): string {
    switch (role.toLowerCase()) {
      case 'user': return 'Utilisateur';
      case 'assistant': return 'Assistant';
      case 'system': return 'Système';
      default: return role;
    }
  }
</script>

<svelte:head>
  <title>
    {loading ? 'Chargement...' : conversation ? `Conversation ${conversation.id}` : 'Conversation non trouvée'}
  </title>
  <meta name="description" content="Détail d'une conversation entre modèles de langage" />
</svelte:head>

<main class="container">
  {#if loading}
    <div class="loading-state">
      <div class="loading-spinner"></div>
      <p>Chargement de la conversation...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">❌</div>
      <h2>Erreur</h2>
      <p>{error}</p>
      <a href="/" class="back-link">← Retour à la recherche</a>
    </div>
  {:else if conversation}
    <div class="conversation-header">
      <div class="header-info">
        <h1 class="conversation-title">
          Conversation #{conversation.id}
        </h1>
        <div class="conversation-meta">
          <span class="date">
            {formatDate(conversation.timestamp)}
          </span>
          <span class="turns">
            {conversation.conv_turns} tour{conversation.conv_turns > 1 ? 's' : ''}
          </span>
        </div>
      </div>
      
      <div class="model-comparison">
        <div class="model model-a">
          <h3>Modèle A</h3>
          <div class="model-name">{conversation.model_a_name}</div>
          <div class="model-stats">
            Tokens: {formatTokens(conversation.total_conv_a_output_tokens)}
          </div>
        </div>
        
        <div class="vs">VS</div>
        
        <div class="model model-b">
          <h3>Modèle B</h3>
          <div class="model-name">{conversation.model_b_name}</div>
          <div class="model-stats">
            Tokens: {formatTokens(conversation.total_conv_b_output_tokens)}
          </div>
        </div>
      </div>
    </div>
    
    {#if conversation.short_summary}
      <section class="summary-section">
        <h2>Résumé</h2>
        <p class="summary-text">{conversation.short_summary}</p>
      </section>
    {/if}
    
    <div class="tabs">
      <button 
        class="tab-button"
        class:active={activeTab === 'a'}
        on:click={() => activeTab = 'a'}
      >
        Conversation A
      </button>
      <button 
        class="tab-button"
        class:active={activeTab === 'b'}
        on:click={() => activeTab = 'b'}
      >
        Conversation B
      </button>
    </div>
    
    <section class="conversation-section">
      <div class="conversation-content">
        {#if activeTab === 'a'}
          <h3>Conversation avec {conversation.model_a_name}</h3>
          {#each conversation.conversation_a as message (message.content)}
            <div class="message" class:message-{message.role.toLowerCase()}>
              <div class="message-header">
                <span class="role-icon">
                  {getRoleIcon(message.role)}
                </span>
                <span class="role-label">
                  {getRoleLabel(message.role)}
                </span>
                {#if message.metadata?.output_tokens}
                  <span class="token-count">
                    {message.metadata.output_tokens} tokens
                  </span>
                {/if}
              </div>
              <div class="message-content">
                {@html message.content.replace(/\n/g, '<br>')}
              </div>
            </div>
          {/each}
        {:else}
          <h3>Conversation avec {conversation.model_b_name}</h3>
          {#each conversation.conversation_b as message (message.content)}
            <div class="message" class:message-{message.role.toLowerCase()}>
              <div class="message-header">
                <span class="role-icon">
                  {getRoleIcon(message.role)}
                </span>
                <span class="role-label">
                  {getRoleLabel(message.role)}
                </span>
                {#if message.metadata?.output_tokens}
                  <span class="token-count">
                    {message.metadata.output_tokens} tokens
                  </span>
                {/if}
              </div>
              <div class="message-content">
                {@html message.content.replace(/\n/g, '<br>')}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </section>
    
    {#if conversation.keywords && conversation.keywords.length > 0}
      <section class="metadata-section">
        <h2>Métadonnées</h2>
        <div class="metadata-grid">
          {#if conversation.keywords}
            <div class="metadata-item">
              <h4>Mots-clés</h4>
              <div class="keywords">
                {#each conversation.keywords as keyword}
                  <span class="keyword-tag">{keyword}</span>
                {/each}
              </div>
            </div>
          {/if}
          
          {#if conversation.categories && conversation.categories.length > 0}
            <div class="metadata-item">
              <h4>Catégories</h4>
              <div class="categories">
                {#each conversation.categories as category}
                  <span class="category-tag">{category}</span>
                {/each}
              </div>
            </div>
          {/if}
          
          {#if conversation.languages && conversation.languages.length > 0}
            <div class="metadata-item">
              <h4>Langues</h4>
              <div class="languages">
                {#each conversation.languages as language}
                  <span class="language-tag">{language}</span>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      </section>
    {/if}
    
    <div class="back-section">
      <a href="/" class="back-link">← Retour à la recherche</a>
    </div>
  {/if}
</main>

<style>
  .container {
    max-width: 1000px;
    margin: 0 auto;
    padding: 0 20px;
    min-height: 100vh;
  }
  
  .loading-state,
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
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
  
  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
  
  .conversation-header {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
    border: 1px solid #e2e8f0;
  }
  
  .header-info {
    margin-bottom: 24px;
  }
  
  .conversation-title {
    font-size: 1.8rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0 0 8px 0;
  }
  
  .conversation-meta {
    display: flex;
    gap: 16px;
    font-size: 14px;
    color: #64748b;
  }
  
  .model-comparison {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 20px;
  }
  
  .model {
    text-align: center;
    padding: 20px;
    border-radius: 8px;
    background: #f8fafc;
  }
  
  .model-a {
    border: 2px solid #dbeafe;
  }
  
  .model-b {
    border: 2px solid #d1fae5;
  }
  
  .model h3 {
    font-size: 14px;
    font-weight: 600;
    color: #64748b;
    margin: 0 0 8px 0;
  }
  
  .model-name {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  
  .model-a .model-name {
    color: #3b82f6;
  }
  
  .model-b .model-name {
    color: #10b981;
  }
  
  .model-stats {
    font-size: 12px;
    color: #64748b;
  }
  
  .vs {
    font-size: 24px;
    font-weight: 700;
    color: #64748b;
  }
  
  .summary-section {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
    border: 1px solid #e2e8f0;
  }
  
  .summary-section h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 16px 0;
  }
  
  .summary-text {
    line-height: 1.6;
    color: #374151;
  }
  
  .tabs {
    display: flex;
    margin: 20px 0;
    border-bottom: 1px solid #e2e8f0;
  }
  
  .tab-button {
    padding: 12px 24px;
    border: none;
    background: none;
    font-size: 16px;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s ease;
  }
  
  .tab-button:hover {
    color: #1e293b;
  }
  
  .tab-button.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }
  
  .conversation-section {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin: 0 0 20px 0;
    border: 1px solid #e2e8f0;
  }
  
  .conversation-content h3 {
    font-size: 1.1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 20px 0;
  }
  
  .message {
    margin-bottom: 20px;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .message-user {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
  }
  
  .message-assistant {
    background: #eff6ff;
    border: 1px solid #dbeafe;
  }
  
  .message-system {
    background: #fef3c7;
    border: 1px solid #fbbf24;
  }
  
  .message-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    font-size: 14px;
    font-weight: 500;
  }
  
  .role-icon {
    font-size: 16px;
  }
  
  .role-label {
    flex: 1;
  }
  
  .token-count {
    font-size: 12px;
    color: #64748b;
    background: rgba(255, 255, 255, 0.3);
    padding: 2px 6px;
    border-radius: 4px;
  }
  
  .message-content {
    padding: 16px;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  
  .metadata-section {
    background: white;
    border-radius: 12px;
    padding: 24px;
    margin: 20px 0;
    border: 1px solid #e2e8f0;
  }
  
  .metadata-section h2 {
    font-size: 1.2rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0 0 20px 0;
  }
  
  .metadata-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 20px;
  }
  
  .metadata-item h4 {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 8px 0;
  }
  
  .keywords,
  .categories,
  .languages {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  
  .keyword-tag {
    background: #f3f4f6;
    color: #374151;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .category-tag {
    background: #ede9fe;
    color: #5b21b6;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .language-tag {
    background: #dcfce7;
    color: #166534;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
  }
  
  .back-section {
    text-align: center;
    margin: 40px 0;
  }
  
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: #3b82f6;
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }
  
  .back-link:hover {
    background: #2563eb;
  }
  
  @media (max-width: 768px) {
    .container {
      padding: 0 16px;
    }
    
    .model-comparison {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    
    .vs {
      display: none;
    }
    
    .conversation-meta {
      flex-direction: column;
      gap: 8px;
    }
    
    .metadata-grid {
      grid-template-columns: 1fr;
    }
  }
</style>