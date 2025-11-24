<script lang="ts">
	import type { SearchResult } from '$lib/types/index.js';

	let {
		result,
		highlightQuery = ''
	}: {
		result: SearchResult;
		highlightQuery?: string;
	} = $props();

	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toLocaleDateString('fr-FR', {
			day: 'numeric',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function highlightText(text: string): string {
		if (!highlightQuery || highlightQuery.length < 2) return text;

		const regex = new RegExp(`(${highlightQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
		return text.replace(regex, '<mark>$1</mark>');
	}

	function handleCardClick() {
		window.location.href = `/conversation/${result.id}`;
	}

	function handleKeyPress(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			handleCardClick();
		}
	}
</script>

<button
	type="button"
	class="result-card"
	onclick={handleCardClick}
	onkeypress={handleKeyPress}
	aria-label="Voir la conversation #{result.id} entre {result.model_a_name} et {result.model_b_name}"
>
	<div class="card-header">
		<div class="models">
			<span class="model model-a">{result.model_a_name}</span>
			<span class="vs">vs</span>
			<span class="model model-b">{result.model_b_name}</span>
		</div>
		{#if result.score !== undefined}
			<div class="score">
				Score: {result.score.toFixed(2)}
			</div>
		{/if}
	</div>

	<div class="summary">
		{@html highlightText(result.short_summary)}
	</div>
	
	<div class="opening-msg">
		{@html highlightText(result.opening_msg)}
	</div>


	<div class="metadata">
		<div class="date">
			{formatDate(result.timestamp)}
		</div>
		<div class="languages">
			{#each result.languages as language}
				<span class="language-tag">{language}</span>
			{/each}
		</div>
	</div>

	{#if result.keywords && result.keywords.length > 0}
		<div class="keywords">
			{#each result.keywords.slice(0, 5) as keyword}
				<span class="keyword-tag">{keyword}</span>
			{/each}
			{#if result.keywords.length > 5}
				<span class="more-keywords">+{result.keywords.length - 5}</span>
			{/if}
		</div>
	{/if}
</button>

<style>
	.result-card {
		background: white;
		border: 1px solid #e2e8f0;
		border-radius: 8px;
		padding: 16px;
		margin-bottom: 12px;
		cursor: pointer;
		transition: all 0.2s ease;
		width: 100%;
		text-align: left;
	}

	.result-card:hover {
		border-color: #3b82f6;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		transform: translateY(-2px);
	}

	.result-card:focus {
		outline: 2px solid #3b82f6;
		outline-offset: 2px;
	}

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.models {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}

	.model {
		font-weight: 600;
		padding: 4px 8px;
		border-radius: 4px;
		background: #f8fafc;
	}

	.model-a {
		color: #3b82f6;
		border: 1px solid #dbeafe;
	}

	.model-b {
		color: #10b981;
		border: 1px solid #d1fae5;
	}

	.vs {
		font-weight: 500;
		color: #64748b;
		font-size: 12px;
	}

	.score {
		font-size: 12px;
		color: #64748b;
		background: #f1f5f9;
		padding: 2px 6px;
		border-radius: 4px;
	}

	.opening-msg {
		font-size: 15px;
		line-height: 1.5;
		color: #1e293b;
		margin-bottom: 12px;
		font-weight: 500;
	}

	.opening-msg :global(mark) {
		background-color: #fef3c7;
		color: #92400e;
		padding: 1px 2px;
		border-radius: 2px;
	}

	.summary {
		font-size: 13px;
		line-height: 1.4;
		color: #64748b;
		margin-bottom: 12px;
	}

	.summary :global(mark) {
		background-color: #fef3c7;
		color: #92400e;
		padding: 1px 2px;
		border-radius: 2px;
	}

	.metadata {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 8px;
		font-size: 13px;
		color: #64748b;
	}

	.date {
		font-weight: 500;
	}

	.languages {
		display: flex;
		gap: 4px;
	}

	.language-tag {
		background: #e0e7ff;
		color: #3730a3;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 500;
	}

	.keywords {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.keyword-tag {
		background: #f3f4f6;
		color: #374151;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 500;
	}

	.more-keywords {
		background: #9ca3af;
		color: white;
		padding: 2px 6px;
		border-radius: 3px;
		font-size: 11px;
		font-weight: 500;
	}
</style>
