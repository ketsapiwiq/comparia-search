import { json } from '@sveltejs/kit';
import { searchConversations } from '$lib/server/search.js';
// import { getCachedSearch, setCachedSearch, generateSearchKey } from '$lib/server/cache.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const query = url.searchParams.get('q') || '';
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');
  
  // Validation des paramètres
  if (page < 1) {
    return json({ error: 'Le numéro de page doit être supérieur à 0' }, { status: 400 });
  }
  
  if (limit < 1 || limit > 100) {
    return json({ error: 'La limite doit être entre 1 et 100' }, { status: 400 });
  }
  
  if (!query || query.trim().length < 2) {
    return json({ 
      error: 'La recherche doit contenir au moins 2 caractères',
      results: [],
      total: 0,
      page: 1,
      totalPages: 0
    }, { status: 400 });
  }
  
  try {
    // // Vérifier le cache
    // const cacheKey = generateSearchKey(query.trim(), page, limit);
    // const cached = getCachedSearch(cacheKey);
    
    // if (cached) {
    //   console.log(`🎯 Cache hit pour: ${query} (page ${page})`);
    //   return json(cached);
    // }
    
    // Effectuer la recherche
    console.log(`🔍 Recherche pour: "${query}" (page ${page}, limit ${limit})`);
    const results = await searchConversations(query.trim(), { limit, offset: (page - 1) * limit });
    
    // // Mettre en cache
    // setCachedSearch(cacheKey, results);
    
    console.log(`✅ ${results.results.length} résultats trouvés sur ${results.total} total`);
    
    return json(results);
    
  } catch (error) {
    console.error('❌ Erreur lors de la recherche:', error);
    return json({ 
      error: 'Une erreur est survenue lors de la recherche',
      results: [],
      total: 0,
      page: 1,
      totalPages: 0
    }, { status: 500 });
  }
};