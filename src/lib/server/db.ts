import { createReadStream, existsSync } from 'fs';
import readline from 'readline';
import FlexSearch from 'flexsearch';
import { getCachedStatistics, setCachedStatistics } from './cache.js';
import { dbInitializationLock } from './lock.js';
import type { Conversation, SearchResult, SearchResponse } from '$lib/types/index.js';

let index: any = null;
let conversations: Conversation[] = [];
let isInitialized = false;
let initializationPromise: Promise<void | null> | null = null;

export async function initDatabase(): Promise<void> {
	// Si déjà initialisé, retourner immédiatement
	if (isInitialized) {
		console.log('✅ Base de données déjà initialisée (processus', process.pid, ')');
		return;
	}

	// Si une initialisation est en cours, attendre qu'elle se termine
	if (initializationPromise) {
		console.log('⏳ Initialisation en cours, attente...');
		await initializationPromise;
		return;
	}

	// Démarrer une nouvelle initialisation avec verrouillage
	initializationPromise = dbInitializationLock.withLock(async () => {
		// Double vérification après avoir acquis le verrou
		if (isInitialized) {
			console.log('✅ Base de données déjà initialisée (vérification post-verrou)');
			return;
		}

		console.log(`🚀 DÉBUT DE L'INITIALISATION (processus ${process.pid})`);
		const startTime = Date.now();

		try {
			console.log('🔄 Initialisation de FlexSearch...');

			// Créer l'index de recherche
			index = new FlexSearch.Document({
				document: {
					id: 'id',
					index: [
						'conversation_a.content',
						'conversation_b.content',
						'opening_msg',
						'short_summary',
						'keywords'
					],
					store: true
				},
				tokenize: 'forward',
				resolution: 9,
				cache: 100
			});

			console.log('✅ FlexSearch initialisé avec succès');

			// Vérifier l'existence du fichier avant de charger
			const filePath = `${process.cwd()}/static/data/conversations.jsonl`;
			if (!existsSync(filePath)) {
				console.warn('⚠️ Fichier conversations.jsonl non trouvé, création de données de test...');
				createTestData();
			} else {
				console.log('📂 Chargement des données depuis conversations.jsonl...');
				await loadDataFromFile();
				console.log('✅ Données chargées avec succès');
			}

			isInitialized = true;
			const duration = Date.now() - startTime;
			console.log(
				`🚀 Base de données prête pour la recherche en ${Math.round(duration / 1000)}s (${conversations.length} conversations indexées)`
			);
		} catch (error) {
			console.error("❌ Erreur lors de l'initialisation de la base de données:", error);
			throw error;
		}
	});

	try {
		await initializationPromise;
	} finally {
		initializationPromise = null;
	}
}

async function loadDataFromFile(): Promise<void> {
	const filePath = `${process.cwd()}/static/data/conversations.jsonl`;
	const BATCH_SIZE = 2000; // Réduit pour éviter la surcharge mémoire
	const MAX_CONVERSATIONS = Infinity; // Charger TOUTES les conversations

	try {
		const stream = createReadStream(filePath);
		const rl = readline.createInterface({
			input: stream,
			crlfDelay: Infinity
		});

		let count = 0;
		let batch: Conversation[] = [];

		console.log(`📂 Début du chargement (max ${MAX_CONVERSATIONS} conversations)...`);

		for await (const line of rl) {
			if (line.trim() && count < MAX_CONVERSATIONS) {
				try {
					const conversation = JSON.parse(line) as Conversation;

					// Normaliser les données pour FlexSearch
					const normalizedConv = {
						...conversation,
						conversation_a: conversation.conversation_a || [],
						conversation_b: conversation.conversation_b || [],
						opening_msg: conversation.opening_msg || '',
						keywords: Array.isArray(conversation.keywords) ? conversation.keywords : [],
						categories: Array.isArray(conversation.categories) ? conversation.categories : [],
						languages: Array.isArray(conversation.languages) ? conversation.languages : []
					};

					// Log pour détecter les conversations avec "Romain"
					const contentToCheck = [
						...normalizedConv.conversation_a.map((msg: any) => msg.content || ''),
						...normalizedConv.conversation_b.map((msg: any) => msg.content || ''),
						normalizedConv.opening_msg || '',
						normalizedConv.short_summary || '',
						...(normalizedConv.keywords || [])
					]
						.join(' ')
						.toLowerCase();

					if (contentToCheck.includes('romain')) {
						console.log(`🎯 Conversation avec "Romain" trouvée - ID: ${conversation.id}`);
					}

					batch.push(normalizedConv);

					// Traiter par batch pour optimiser les performances
					if (batch.length >= BATCH_SIZE) {
						await processBatch(batch, index);
						conversations.push(...batch);
						count += batch.length;

						console.log(`📊 ${count} conversations indexées...`);
						batch = [];

						// Pause plus longue et GC forcé pour gérer gros volume
						await new Promise((resolve) => setTimeout(resolve, 100));
						if (global.gc) {
							global.gc(); // Forcer GC chaque batch
						}
					}
				} catch (parseError) {
					console.warn(`⚠️ Erreur de parsing ligne ${count + 1}:`, parseError);
					continue;
				}
			}

			// Arrêter si on atteint la limite
			if (count >= MAX_CONVERSATIONS) {
				console.log(`⚠️ Limite de ${MAX_CONVERSATIONS} conversations atteinte`);
				break;
			}
		}

		// Traiter le dernier batch
		if (batch.length > 0) {
			await processBatch(batch, index);
			conversations.push(...batch);
			count += batch.length;
		}

		console.log(`✅ ${count} conversations indexées avec succès`);
	} catch (error) {
		console.error('Erreur lors de la lecture du fichier:', error);
		throw error;
	}
}

/**
 * Traite un batch de conversations pour l'indexation
 */
async function processBatch(batch: Conversation[], index: any): Promise<void> {
	if (!index) return;

	// Ajouter toutes les conversations du batch à l'index
	for (const conv of batch) {
		index.add(conv);
	}

	// Pause très courte pour permettre au event loop de respirer
	await new Promise((resolve) => setTimeout(resolve, 1));
}

function createTestData(): void {
	const testConv: Conversation = {
		id: 1,
		timestamp: Date.now(),
		model_a_name: 'gpt-4',
		model_b_name: 'claude-3',
		conversation_a: [
			{ role: 'user', content: 'Hello, how are you?' },
			{ role: 'assistant', content: "I'm doing well, thank you for asking!" }
		],
		conversation_b: [
			{ role: 'user', content: 'Hello, how are you?' },
			{ role: 'assistant', content: "I'm doing great, thanks for your message!" }
		],
		conv_turns: 2,
		system_prompt_a: null,
		system_prompt_b: null,
		conversation_pair_id: 'test-pair-1',
		conv_a_id: 'test-a-1',
		conv_b_id: 'test-b-1',
		session_hash: 'test-session',
		visitor_id: null,
		ip: null,
		model_pair_name: '{gpt-4,claude-3}',
		opening_msg: 'Hello, how are you?',
		archived: false,
		mode: 'test',
		custom_models_selection: null,
		short_summary: 'A simple greeting conversation between AI models',
		keywords: ['greeting', 'ai', 'test'],
		categories: ['test'],
		languages: ['en'],
		pii_analyzed: false,
		contains_pii: false,
		total_conv_a_output_tokens: 50,
		total_conv_b_output_tokens: 45,
		ip_map: null,
		postprocess_failed: false
	};

	conversations = [testConv];

	if (index) {
		index.add(testConv);
	}

	console.log('✅ Données de test créées');
}

export function isDatabaseInitialized(): boolean {
	return isInitialized;
}

export async function searchConversations(
	query: string,
	options: { limit?: number; offset?: number } = {}
): Promise<SearchResponse> {
	const { limit = 20, offset = 0 } = options;
	if (!query || query.trim().length < 2) {
		return {
			results: [],
			total: 0,
			page: Math.floor(offset / limit) + 1,
			totalPages: 0
		};
	}

	try {
		if (!index) {
			throw new Error('Index non initialisé');
		}

		console.log(`🔍 Recherche pour: "${query}"`);
		console.log(`📊 Configuration de l'index:`, {
			tokenize: 'forward',
			resolution: 9,
			fields: [
				'conversation_a.content',
				'conversation_b.content',
				'opening_msg',
				'short_summary',
				'keywords'
			]
		});

		// Diagnostic: Vérifier si nous avons des conversations indexées
		console.log(`📊 Diagnostic: ${conversations.length} conversations chargées en mémoire`);
		console.log(
			`📊 Diagnostic: 5 premières conversations IDs:`,
			conversations.slice(0, 5).map((c) => c.id)
		);

		// Diagnostic: Tester la recherche en minuscules
		const queryLower = query.toLowerCase();
		console.log(`🔍 Diagnostic: Test avec query en minuscules: "${queryLower}"`);

		// Rechercher dans l'index
		console.log(`🔍 Exécution de la recherche FlexSearch avec query: "${query}"`);
		const searchResults = index.search(query, {
			limit: 1000, // Limite haute pour pagination
			enrich: true,
			merge: true // Fusionner les résultats par ID
		});

		console.log(`📊 Résultats bruts de FlexSearch:`, {
			count: searchResults.length,
			firstResults: searchResults.slice(0, 3),
			type: typeof searchResults[0]
		});

		// Transformer les résultats en SearchResult
		console.log(`🔄 Transformation des ${searchResults.length} résultats bruts...`);
		const allResults: SearchResult[] = searchResults
			.map((result: any) => {
				// Avec merge: true, FlexSearch retourne { id, doc, field[] }
				const resultId = result.id;
				const doc = result.doc;

				console.log(`🔍 Traitement résultat:`, { resultId, doc });

				if (!resultId || !doc) {
					console.log(`⚠️ Résultat invalide:`, result);
					return null;
				}

				// Utiliser le document stocké ou chercher dans les conversations
				const conv = doc || conversations.find((c) => c.id === resultId);
				if (!conv) {
					console.log(`⚠️ Conversation non trouvée pour l'ID: ${resultId}`);
					return null;
				}

				return {
					id: conv.id,
					model_a_name: conv.model_a_name,
					model_b_name: conv.model_b_name,
					short_summary: conv.short_summary || '',
					opening_msg: conv.opening_msg || '',
					keywords: conv.keywords || [],
					categories: conv.categories || [],
					languages: conv.languages || [],
					timestamp: conv.timestamp,
					score: 1.0 // FlexSearch avec merge ne fournit pas de score directement
				};
			})
			.filter(Boolean);

		console.log(`✅ ${allResults.length} résultats transformés avec succès`);

		// Trier par score de pertinence
		allResults.sort((a, b) => (b.score || 0) - (a.score || 0));

		// Pagination
		const paginatedResults = allResults.slice(offset, offset + limit);
		const total = allResults.length;
		const page = Math.floor(offset / limit) + 1;
		const totalPages = Math.ceil(total / limit);

		console.log(`✅ ${paginatedResults.length} résultats trouvés sur ${total} total`);

		return {
			results: paginatedResults,
			total,
			page,
			totalPages
		};
	} catch (error) {
		console.error('Erreur lors de la recherche:', error);
		throw new Error('Erreur lors de la recherche');
	}
}

export async function getConversationById(id: number): Promise<Conversation | null> {
	try {
		const conversation = conversations.find((c) => c.id === id);
		return conversation || null;
	} catch (error) {
		console.error(`Erreur lors de la récupération de la conversation ${id}:`, error);
		return null;
	}
}

export async function getStatistics(): Promise<{
	totalConversations: number;
	uniqueModels: number;
	categories: Array<{ category: string; count: number }>;
	languages: Array<{ language: string; count: number }>;
}> {
	const cacheKey = 'statistics:global';
	const cached = getCachedStatistics(cacheKey);
	if (cached) {
		return cached as any;
	}

	try {
		const totalConversations = conversations.length;

		// Compter les modèles uniques
		const uniqueModels = new Set<string>();
		conversations.forEach((conv) => {
			uniqueModels.add(conv.model_a_name);
			uniqueModels.add(conv.model_b_name);
		});

		// Compter les catégories
		const categoryCounts: Record<string, number> = {};
		conversations.forEach((conv) => {
			if (conv.categories) {
				conv.categories.forEach((cat) => {
					categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
				});
			}
		});

		const categories = Object.entries(categoryCounts)
			.map(([category, count]) => ({ category, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		// Compter les langues
		const languageCounts: Record<string, number> = {};
		conversations.forEach((conv) => {
			if (conv.languages) {
				conv.languages.forEach((lang) => {
					languageCounts[lang] = (languageCounts[lang] || 0) + 1;
				});
			}
		});

		const languages = Object.entries(languageCounts)
			.map(([language, count]) => ({ language, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 10);

		const stats = {
			totalConversations,
			uniqueModels: uniqueModels.size,
			categories,
			languages
		};

		setCachedStatistics(cacheKey, stats);
		return stats;
	} catch (error) {
		console.error('Erreur lors de la récupération des statistiques:', error);
		return {
			totalConversations: 0,
			uniqueModels: 0,
			categories: [],
			languages: []
		};
	}
}
