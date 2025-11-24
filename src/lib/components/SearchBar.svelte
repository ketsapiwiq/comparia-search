<script lang="ts">
	import { debounce } from '$lib/utils/debounce.js';

	let {
		query = $bindable(''),
		onSearch,
		loading = false,
		placeholder = 'Rechercher dans les conversations...'
	}: {
		query?: string;
		onSearch: (query: string) => void;
		loading?: boolean;
		placeholder?: string;
	} = $props();

	const debouncedSearch = debounce((q: string) => {
		if (q && q.length >= 2) {
			onSearch(q);
		} else if (!q || q.length === 0) {
			onSearch('');
		}
	}, 300);

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			if (query && query.length >= 2) {
				onSearch(query);
			}
		}
	}

	$effect(() => {
		debouncedSearch(query);
	});
</script>

<div class="search-bar">
	<div class="search-input-wrapper">
		<input
			type="search"
			bind:value={query}
			{placeholder}
			onkeypress={handleKeyPress}
			class="search-input"
			disabled={loading}
		/>
		{#if query}
			<button
				onclick={clearSearch}
				class="clear-button"
				disabled={loading}
				title="Effacer la recherche"
			>
				✕
			</button>
		{/if}
		{#if loading}
			<div class="loading-spinner" title="Recherche en cours...">
				<div class="spinner"></div>
			</div>
		{/if}
	</div>

	{#if query && query.length > 0 && query.length < 2}
		<div class="search-hint">Tapez au moins 2 caractères pour lancer la recherche</div>
	{/if}
</div>

<style>
	.search-bar {
		width: 100%;
		margin-bottom: 1rem;
	}

	.search-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.search-input {
		width: 100%;
		padding: 12px 40px 12px 16px;
		border: 2px solid #e2e8f0;
		border-radius: 8px;
		font-size: 16px;
		outline: none;
		transition:
			border-color 0.2s,
			box-shadow 0.2s;
		background: white;
	}

	.search-input:focus {
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.search-input:disabled {
		background-color: #f8fafc;
		cursor: not-allowed;
		opacity: 0.7;
	}

	.clear-button {
		position: absolute;
		right: 12px;
		background: none;
		border: none;
		color: #64748b;
		cursor: pointer;
		padding: 4px;
		border-radius: 4px;
		font-size: 14px;
		line-height: 1;
		transition:
			background-color 0.2s,
			color 0.2s;
	}

	.clear-button:hover:not(:disabled) {
		background-color: #f1f5f9;
		color: #475569;
	}

	.clear-button:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.loading-spinner {
		position: absolute;
		right: 40px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.spinner {
		width: 18px;
		height: 18px;
		border: 2px solid #e2e8f0;
		border-top: 2px solid #3b82f6;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}

	.search-hint {
		margin-top: 8px;
		font-size: 14px;
		color: #64748b;
		font-style: italic;
	}
</style>
