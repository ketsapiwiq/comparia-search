import { initDatabase } from '$lib/server/db.js';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

let initializationPromise: Promise<void> | null = null;

/**
 * Hook d'initialisation de la base de données avec gestion centralisée
 */
const initDb: Handle = async ({ event, resolve }) => {
  // Si l'initialisation est déjà en cours, attendre
  if (initializationPromise) {
    try {
      await initializationPromise;
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation en cours:', error);
      // Continuer malgré l'erreur pour ne pas bloquer le serveur
    }
  } else {
    // Démarrer l'initialisation
    initializationPromise = initDatabase();
    
    try {
      await initializationPromise;
      console.log('✅ Hook serveur: Base de données initialisée avec succès');
    } catch (error) {
      console.error('❌ Hook serveur: Erreur lors de l\'initialisation de la base de données:', error);
      // Ne pas bloquer le démarrage du serveur, mais logger l'erreur
    } finally {
      initializationPromise = null;
    }
  }
  
  return resolve(event);
};

/**
 * Hook de gestion des requêtes avec headers de sécurité
 */
const handleRequest: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  
  // Ajouter des headers de sécurité
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Ajouter des headers de performance
  response.headers.set('X-Process-ID', process.pid.toString());
  
  return response;
};

export const handle = sequence(initDb, handleRequest);
