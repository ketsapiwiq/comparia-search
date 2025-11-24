#!/usr/bin/env node

/**
 * Migration script to populate embeddings for existing conversations
 * This script reads conversations from the existing data source and generates
 * embeddings for them using the Ollama service, then stores them in PostgreSQL.
 */

import { vectorDatabase } from '../src/lib/server/vector-db.js';
import { embeddingService } from '../src/lib/server/embeddings.js';
import { createReadStream, existsSync } from 'fs';
import readline from 'readline';

// Configuration
const DATA_FILE_PATH = './data/conversations.jsonl'; // Adjust path as needed
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds delay between batches

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

async function readConversations(filePath) {
	if (!existsSync(filePath)) {
		throw new Error(`Data file not found: ${filePath}`);
	}

	const conversations = [];
	const fileStream = createReadStream(filePath);
	const rl = readline.createInterface({
		input: fileStream,
		crlfDelay: Infinity
	});

	for await (const line of rl) {
		try {
			const conversation = JSON.parse(line);
			conversations.push(conversation);
		} catch (error) {
			console.warn(`Failed to parse line: ${line.substring(0, 100)}...`);
		}
	}

	return conversations;
}

function conversationToDocument(conversation) {
	// Create a rich text representation for embedding
	const content = [
		`Opening: ${conversation.opening_msg}`,
		conversation.short_summary ? `Summary: ${conversation.short_summary}` : '',
		conversation.keywords ? `Keywords: ${conversation.keywords.join(', ')}` : '',
		conversation.categories ? `Categories: ${conversation.categories.join(', ')}` : '',
		conversation.languages ? `Languages: ${conversation.languages.join(', ')}` : '',
		// Include some conversation content
		conversation.conversation_a
			.slice(0, 2)
			.map((msg) => msg.content)
			.join(' '),
		conversation.conversation_b
			.slice(0, 2)
			.map((msg) => msg.content)
			.join(' ')
	]
		.filter(Boolean)
		.join('\n');

	return {
		id: conversation.id.toString(),
		title: `${conversation.model_a_name} vs ${conversation.model_b_name}`,
		url: `/conversation/${conversation.id}`,
		content
	};
}

async function migrateConversations() {
	console.log('🚀 Starting migration of conversations to vector database...');

	try {
		// Check services are available
		console.log('🔍 Checking services health...');
		const health = await vectorDatabase.getStats();
		console.log(`✅ PostgreSQL connected: ${health.totalDocuments} documents in database`);

		// Test embedding service
		const testEmbedding = await embeddingService.generateEmbedding('test');
		console.log(`✅ Ollama connected: embedding dimension ${testEmbedding.length}`);

		// Read conversations
		console.log('📖 Reading conversations from data file...');
		const conversations = await readConversations(DATA_FILE_PATH);
		console.log(`📚 Found ${conversations.length} conversations`);

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
			const documents = batch.map(conversationToDocument);

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
migrateConversations().catch((error) => {
	console.error('💥 Unhandled error:', error);
	process.exit(1);
});

export { migrateConversations };
