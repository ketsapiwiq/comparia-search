#!/usr/bin/env node

/**
 * Alternative migration script that extracts conversations from the existing FlexSearch database
 * and populates the vector database with embeddings.
 */

import { vectorDatabase } from '../src/lib/server/vector-db.js';
import { embeddingService } from '../src/lib/server/embeddings.js';
import { initDatabase, searchConversations } from '../src/lib/server/db.js';

// Configuration
const BATCH_SIZE = 5;
const DELAY_BETWEEN_BATCHES = 3000; // 3 seconds delay between batches
const MAX_CONVERSATIONS = 1000; // Limit to avoid overwhelming the system

function formatProgress(progress) {
	const elapsed = Date.now() - progress.startTime;
	const rate = progress.processed > 0 ? (progress.processed / (elapsed / 1000)).toFixed(2) : '0';
	const estimatedTotal = (elapsed * (progress.total / progress.processed)) / 1000;
	const remaining = progress.processed > 0 ? (estimatedTotal - elapsed / 1000).toFixed(0) : '∞';

	return [
		`Progress: ${progress.processed}/${progress.total} (${((progress.processed / progress.total) * 100).toFixed(1)}%)`,
		`Success: ${progress.success}`,
		`Failed: ${progress.failed}`,
		`Rate: ${rate} conv/sec`,
		`ETA: ${remaining}s`
	].join(' | ');
}

async function getAllConversations() {
	const allConversations = [];
	const limit = 100;
	let offset = 0;
	let hasMore = true;

	console.log('📖 Extracting conversations from FlexSearch database...');

	while (hasMore && allConversations.length < MAX_CONVERSATIONS) {
		try {
			const response = await searchConversations('', { limit, offset });

			if (response.results.length === 0) {
				hasMore = false;
			} else {
				allConversations.push(...response.results);
				offset += limit;
				console.log(`📚 Retrieved ${allConversations.length} conversations so far...`);
			}
		} catch (error) {
			console.error(`❌ Error fetching conversations at offset ${offset}:`, error);
			hasMore = false;
		}
	}

	return allConversations.slice(0, MAX_CONVERSATIONS);
}

function searchResultToDocument(result) {
	// Create a rich text representation for embedding
	const content = [
		`Opening: ${result.opening_msg}`,
		result.short_summary ? `Summary: ${result.short_summary}` : '',
		result.keywords ? `Keywords: ${result.keywords.join(', ')}` : '',
		result.categories ? `Categories: ${result.categories.join(', ')}` : '',
		result.languages ? `Languages: ${result.languages.join(', ')}` : '',
		`Models: ${result.model_a_name} vs ${result.model_b_name}`
	]
		.filter(Boolean)
		.join('\n');

	return {
		id: result.id.toString(),
		title: `${result.model_a_name} vs ${result.model_b_name}`,
		url: `/conversation/${result.id}`,
		content
	};
}

async function migrateFromFlexSearch() {
	console.log('🚀 Starting migration from FlexSearch to vector database...');

	try {
		// Initialize FlexSearch database
		console.log('🔍 Initializing FlexSearch database...');
		await initDatabase();

		// Check services are available
		console.log('🔍 Checking services health...');
		const health = await vectorDatabase.getStats();
		console.log(`✅ PostgreSQL connected: ${health.totalDocuments} documents in database`);

		// Test embedding service
		const testEmbedding = await embeddingService.generateEmbedding('test');
		console.log(`✅ Ollama connected: embedding dimension ${testEmbedding.length}`);

		// Get all conversations from FlexSearch
		const conversations = await getAllConversations();
		console.log(`📚 Found ${conversations.length} conversations to migrate`);

		if (conversations.length === 0) {
			console.log('⚠️ No conversations found in FlexSearch database');
			return;
		}

		const progress = {
			total: conversations.length,
			processed: 0,
			success: 0,
			failed: 0,
			startTime: Date.now()
		};

		// Process in batches
		for (let i = 0; i < conversations.length; i += BATCH_SIZE) {
			const batch = conversations.slice(i, i + BATCH_SIZE);
			const documents = batch.map(searchResultToDocument);

			console.log(
				`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(conversations.length / BATCH_SIZE)} (${documents.length} documents)`
			);

			try {
				await vectorDatabase.addDocuments(documents);
				progress.success += documents.length;
				console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1} completed successfully`);
			} catch (error) {
				progress.failed += documents.length;
				console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} failed:`, error);

				// Try individual documents in case of batch failure
				console.log('🔄 Retrying documents individually...');
				for (const doc of documents) {
					try {
						await vectorDatabase.addDocument(doc);
						progress.success += 1;
					} catch (docError) {
						progress.failed += 1;
						console.error(`❌ Failed to add document ${doc.id}:`, docError);
					}
					progress.processed++;
				}
			}

			progress.processed += documents.length;
			console.log(`📊 ${formatProgress(progress)}`);

			// Delay between batches to avoid overwhelming Ollama
			if (i + BATCH_SIZE < conversations.length) {
				console.log(`⏳ Waiting ${DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
				await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
			}
		}

		// Final statistics
		console.log('\n🎉 Migration completed!');
		console.log(`📈 Final stats: ${formatProgress(progress)}`);

		const finalStats = await vectorDatabase.getStats();
		console.log(
			`🗄️ Database now contains ${finalStats.totalDocuments} documents with ${finalStats.documentsWithEmbeddings} embeddings`
		);
	} catch (error) {
		console.error('💥 Migration failed:', error);
		process.exit(1);
	}
}

// Handle graceful shutdown
process.on('SIGINT', () => {
	console.log('\n⏹️ Migration interrupted by user');
	process.exit(0);
});

process.on('SIGTERM', () => {
	console.log('\n⏹️ Migration terminated');
	process.exit(0);
});

// Run migration
migrateFromFlexSearch().catch((error) => {
	console.error('💥 Unhandled error:', error);
	process.exit(1);
});

export { migrateFromFlexSearch };
