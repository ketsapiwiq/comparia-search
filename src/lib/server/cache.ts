import { LRUCache } from 'lru-cache';

// Cache pour les résultats de recherche
const searchCache = new LRUCache<string, any>({
  max: 500, // Maximum 500 entrées
  ttl: 1000 * 60 * 5, // 5 minutes TTL
  updateAgeOnGet: true // Met à jour l'âge lors de l'accès
});

// Cache pour les conversations individuelles
const conversationCache = new LRUCache<string, any>({
  max: 1000, // Maximum 1000 conversations
  ttl: 1000 * 60 * 15, // 15 minutes TTL
  updateAgeOnGet: true
});

// Cache pour les statistiques
const statisticsCache = new LRUCache<string, any>({
  max: 10, // Maximum 10 entrées de stats
  ttl: 1000 * 60 * 30, // 30 minutes TTL
  updateAgeOnGet: true
});

export function getCachedSearch<T>(key: string): T | undefined {
  return searchCache.get(key) as T | undefined;
}

export function setCachedSearch<T>(key: string, value: T): void {
  searchCache.set(key, value);
}

export function getCachedConversation<T>(key: string): T | undefined {
  return conversationCache.get(key) as T | undefined;
}

export function setCachedConversation<T>(key: string, value: T): void {
  conversationCache.set(key, value);
}

export function getCachedStatistics<T>(key: string): T | undefined {
  return statisticsCache.get(key) as T | undefined;
}

export function setCachedStatistics<T>(key: string, value: T): void {
  statisticsCache.set(key, value);
}

export function clearAllCaches(): void {
  searchCache.clear();
  conversationCache.clear();
  statisticsCache.clear();
  console.log('🗑️ Tous les caches ont été vidés');
}

export function getCacheStats(): {
  search: { size: number; maxSize: number };
  conversation: { size: number; maxSize: number };
  statistics: { size: number; maxSize: number };
} {
  return {
    search: {
      size: searchCache.size,
      maxSize: searchCache.max
    },
    conversation: {
      size: conversationCache.size,
      maxSize: conversationCache.max
    },
    statistics: {
      size: statisticsCache.size,
      maxSize: statisticsCache.max
    }
  };
}

export function invalidateSearchCache(): void {
  searchCache.clear();
  console.log('🗑️ Cache de recherche vidé');
}

export function invalidateConversationCache(): void {
  conversationCache.clear();
  console.log('🗑️ Cache de conversations vidé');
}

export function invalidateStatisticsCache(): void {
  statisticsCache.clear();
  console.log('🗑️ Cache de statistiques vidé');
}

// Fonctions utilitaires pour générer des clés de cache
export function generateSearchKey(query: string, page: number, limit: number): string {
  return `search:${query}:${page}:${limit}`;
}

export function generateConversationKey(id: number): string {
  return `conversation:${id}`;
}

export function generateStatisticsKey(): string {
  return 'statistics:global';
}