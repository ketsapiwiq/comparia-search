import { json } from '@sveltejs/kit';
import { searchConversations } from '$lib/server/search.js';
import { unifiedSearchService } from '$lib/server/unified-search.js';
// import { getCachedSearch, setCachedSearch, generateSearchKey } from '$lib/server/cache.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const query = url.searchParams.get('q') || '';
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '20');
	const type = url.searchParams.get('type') || 'unified'; // 'flexsearch', 'vector', 'hybrid', 'unified', 'best'

	// Validation des paramètres
	if (page < 1) {
		return json({ error: 'Le numéro de page doit être supérieur à 0' }, { status: 400 });
	}

	if (limit < 1 || limit > 100) {
		return json({ error: 'La limite doit être entre 1 et 100' }, { status: 400 });
	}

	if (!query || query.trim().length < 2) {
		return json(
			{
				error: 'La recherche doit contenir au moins 2 caractères',
				results: [],
				total: 0,
				page: 1,
				totalPages: 0
			},
			{ status: 400 }
		);
	}

	try {
		console.log(`🔍 Recherche ${type} pour: "${query}" (page ${page}, limit ${limit})`);

		switch (type) {
			case 'flexsearch': {
				const results = await searchConversations(query.trim(), {
					limit,
					offset: (page - 1) * limit
				});
				console.log(
					`✅ FlexSearch: ${results.results.length} résultats trouvés sur ${results.total} total`
				);
				return json(results);
			}

			case 'vector': {
				const offset = (page - 1) * limit;
				const vectorResults = await unifiedSearchService.search(query.trim(), {
					limit,
					includeFlexsearch: false,
					includeVector: true,
					includeHybrid: false
				});
				console.log(`✅ Vector: ${vectorResults.vector.length} résultats trouvés`);
				return json({
					results: vectorResults.vector,
					total: vectorResults.vector.length,
					page,
					totalPages: Math.ceil(vectorResults.vector.length / limit),
					type: 'vector'
				});
			}

			case 'hybrid': {
				const offset = (page - 1) * limit;
				const hybridResults = await unifiedSearchService.search(query.trim(), {
					limit,
					includeFlexsearch: false,
					includeVector: false,
					includeHybrid: true
				});
				console.log(`✅ Hybrid: ${hybridResults.hybrid.length} résultats trouvés`);
				return json({
					results: hybridResults.hybrid,
					total: hybridResults.hybrid.length,
					page,
					totalPages: Math.ceil(hybridResults.hybrid.length / limit),
					type: 'hybrid'
				});
			}

			case 'best': {
				const bestResults = await unifiedSearchService.getBestResults(query.trim(), limit);
				console.log(`✅ Best: ${bestResults.length} résultats trouvés`);
				return json({
					results: bestResults,
					total: bestResults.length,
					page,
					totalPages: Math.ceil(bestResults.length / limit),
					type: 'best'
				});
			}

			case 'compare': {
				const comparison = await unifiedSearchService.compareSearchMethods(query.trim(), limit);
				console.log(
					`✅ Comparison: flexsearch=${comparison.stats.flexsearchCount}, vector=${comparison.stats.vectorCount}, hybrid=${comparison.stats.hybridCount}, overlap=${comparison.stats.overlap}`
				);
				return json({
					...comparison,
					page,
					type: 'compare'
				});
			}

			case 'unified':
			default: {
				const unifiedResults = await unifiedSearchService.search(query.trim(), { limit });
				console.log(
					`✅ Unified: flexsearch=${unifiedResults.flexsearch.length}, vector=${unifiedResults.vector.length}, hybrid=${unifiedResults.hybrid.length}`
				);
				return json({
					...unifiedResults,
					page,
					type: 'unified'
				});
			}
		}
	} catch (error) {
		console.error('❌ Erreur lors de la recherche:', error);
		return json(
			{
				error: 'Une erreur est survenue lors de la recherche',
				results: [],
				total: 0,
				page: 1,
				totalPages: 0,
				type
			},
			{ status: 500 }
		);
	}
};
