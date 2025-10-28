import { json } from '@sveltejs/kit';
import { getConversationById } from '$lib/server/search.js';
import { getCachedConversation, setCachedConversation, generateConversationKey } from '$lib/server/cache.js';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const id = parseInt(params.id);
  
  // Validation de l'ID
  if (isNaN(id) || id < 1) {
    return json({ error: 'ID de conversation invalide' }, { status: 400 });
  }
  
  try {
    // Vérifier le cache
    const cacheKey = generateConversationKey(id);
    const cached = getCachedConversation(cacheKey);
    
    if (cached) {
      console.log(`🎯 Cache hit pour conversation: ${id}`);
      return json(cached);
    }
    
    // Récupérer la conversation
    console.log(`📄 Récupération de la conversation: ${id}`);
    const conversation = await getConversationById(id);
    
    if (!conversation) {
      return json({ error: 'Conversation non trouvée' }, { status: 404 });
    }
    
    // Mettre en cache
    setCachedConversation(cacheKey, conversation);
    
    console.log(`✅ Conversation ${id} récupérée avec succès`);
    
    return json(conversation);
    
  } catch (error) {
    console.error(`❌ Erreur lors de la récupération de la conversation ${id}:`, error);
    return json({ 
      error: 'Une erreur est survenue lors de la récupération de la conversation'
    }, { status: 500 });
  }
};