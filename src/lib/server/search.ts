import { searchConversations as dbSearchConversations, getConversationById as dbGetConversationById } from './db.js';
// import {
//   getCachedSearch,
//   setCachedSearch,
//   getCachedConversation,
//   setCachedConversation,
//   generateSearchKey,
//   generateConversationKey
// } from './cache.js';
import type { SearchResult, SearchResponse, SearchOptions, Conversation } from '$lib/types/index.js';

export async function searchConversations(
  query: string,
  options: SearchOptions = {}
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
    // // Vérifier le cache
    // const cacheKey = generateSearchKey(query.trim(), Math.floor(offset / limit) + 1, limit);
    // const cached = getCachedSearch<SearchResponse>(cacheKey);
    
    // if (cached) {
    //   console.log(`🎯 Cache hit pour: ${query} (page ${Math.floor(offset / limit) + 1})`);
    //   return cached;
    // }
    
    // Effectuer la recherche
    console.log(`🔍 Recherche pour: "${query}" (page ${Math.floor(offset / limit) + 1}, limit ${limit})`);
    const results = await dbSearchConversations(query.trim(), { limit, offset });
    
    // // Mettre en cache
    // setCachedSearch(cacheKey, results);
    
    console.log(`✅ ${results.results.length} résultats trouvés sur ${results.total} total`);
    
    return results;

  } catch (error) {
    console.error('❌ Erreur lors de la recherche:', error);
    throw new Error('Erreur lors de la recherche');
  }
}

export async function getConversationById(id: number): Promise<Conversation | null> {
  try {
    // // Vérifier le cache
    // const cacheKey = generateConversationKey(id);
    // const cached = getCachedConversation<Conversation>(cacheKey);
    
    // if (cached) {
    //   console.log(`🎯 Cache hit pour conversation: ${id}`);
    //   return cached;
    // }
    
    // Récupérer la conversation
    console.log(`📄 Récupération de la conversation: ${id}`);
    const conversation = await dbGetConversationById(id);
    
    if (!conversation) {
      return null;
    }
    
// Mettre en cache
    // setCachedConversation(cacheKey, conversation);
    
    console.log(`✅ Conversation ${id} récupérée avec succès`);
    
    return conversation;

  } catch (error) {
    console.error(`❌ Erreur lors de la récupération de la conversation ${id}:`, error);
    return null;
  }
}

export async function getRecentConversations(limit: number = 10): Promise<SearchResult[]> {
  try {
    // Utiliser la recherche avec une query vide pour obtenir les conversations récentes
    // Note: FlexSearch ne permet pas de trier par date nativement, donc nous retournons les résultats par score
    const results = await dbSearchConversations('', { limit, offset: 0 });
    return results.results;

  } catch (error) {
    console.error('Erreur lors de la récupération des conversations récentes:', error);
    return [];
  }
}

export async function getConversationsByModel(
  modelName: string,
  limit: number = 20,
  offset: number = 0
): Promise<SearchResponse> {
  try {
    // Rechercher par nom de modèle
    const results = await dbSearchConversations(modelName, { limit, offset });
    
    // Filtrer pour ne garder que les conversations qui contiennent le modèle
    const filteredResults = results.results.filter(result => 
      result.model_a_name.toLowerCase().includes(modelName.toLowerCase()) ||
      result.model_b_name.toLowerCase().includes(modelName.toLowerCase())
    );
    
    return {
      results: filteredResults,
      total: filteredResults.length,
      page: Math.floor(offset / limit) + 1,
      totalPages: Math.ceil(filteredResults.length / limit)
    };

  } catch (error) {
    console.error('Erreur lors de la recherche par modèle:', error);
    return {
      results: [],
      total: 0,
      page: 1,
      totalPages: 0
    };
  }
}

export async function getStatistics(): Promise<{
  totalConversations: number;
  uniqueModels: number;
  categories: Array<{ category: string; count: number; }>;
  languages: Array<{ language: string; count: number; }>;
}> {
  try {
    // Importer directement la fonction pour éviter les dépendances circulaires
    const { getStatistics: dbGetStatistics } = await import('./db.js');
    return await dbGetStatistics();

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