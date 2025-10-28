import { writeFileSync, existsSync, unlinkSync, statSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { hostname } from 'os';

interface LockOptions {
  timeout?: number; // Timeout en ms (default: 30 minutes)
  retries?: number; // Nombre de tentatives (default: 60)
  retryDelay?: number; // Délai entre tentatives en ms (default: 500)
}

/**
 * Système de verrouillage inter-processus pour éviter les courses aux initialisations
 */
export class ProcessLock {
  private lockFile: string;
  private timeout: number;
  private retries: number;
  private retryDelay: number;

  constructor(lockName: string, options: LockOptions = {}) {
    this.lockFile = join(process.cwd(), '.cache', `${lockName}.lock`);
    this.timeout = options.timeout || 30 * 60 * 1000; // 30 minutes
    this.retries = options.retries || 60; // 60 tentatives = 30 secondes max
    this.retryDelay = options.retryDelay || 500; // 500ms entre tentatives

    // Créer le dossier .cache s'il n'existe pas
    const cacheDir = dirname(this.lockFile);
    if (!existsSync(cacheDir)) {
      try {
        mkdirSync(cacheDir, { recursive: true });
        console.log(`📁 Dossier de cache créé: ${cacheDir}`);
      } catch (error) {
        console.error(`❌ Impossible de créer le dossier de cache ${cacheDir}:`, error);
      }
    }
  }

  /**
   * Acquérir le verrou
   */
  async acquire(): Promise<boolean> {
    console.log(`🔒 Tentative d'acquisition du verrou: ${this.lockFile}`);

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        // Vérifier si le verrou existe déjà
        if (existsSync(this.lockFile)) {
          const lockStats = statSync(this.lockFile);
          const lockAge = Date.now() - lockStats.mtime.getTime();

          // Si le verrou est trop vieux, le considérer comme abandonné
          if (lockAge > this.timeout) {
            console.log(`⚠️ Verrou abandonné détecté (${lockAge}ms), suppression...`);
            unlinkSync(this.lockFile);
          } else {
            // Verrou encore valide, attendre
            console.log(`⏳ Verrou occupé, tentative ${attempt}/${this.retries}...`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            continue;
          }
        }

        // Créer le verrou avec timestamp
        const lockContent = {
          pid: process.pid,
          timestamp: Date.now(),
          hostname: hostname()
        };

        writeFileSync(this.lockFile, JSON.stringify(lockContent, null, 2));
        console.log(`✅ Verrou acquis avec succès par le processus ${process.pid}`);
        return true;

      } catch (error) {
        console.warn(`⚠️ Erreur lors de la tentative ${attempt}/${this.retries}:`, error);
        
        if (attempt === this.retries) {
          console.error(`❌ Impossible d'acquérir le verrou après ${this.retries} tentatives`);
          return false;
        }

        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
      }
    }

    return false;
  }

  /**
   * Libérer le verrou
   */
  release(): void {
    try {
      if (existsSync(this.lockFile)) {
        unlinkSync(this.lockFile);
        console.log(`🔓 Verrou libéré par le processus ${process.pid}`);
      }
    } catch (error) {
      console.error(`❌ Erreur lors de la libération du verrou:`, error);
    }
  }

  /**
   * Vérifier si le verrou est actuellement détenu
   */
  isLocked(): boolean {
    return existsSync(this.lockFile);
  }

  /**
   * Exécuter une fonction avec le verrou (pattern RAII)
   */
  async withLock<T>(fn: () => Promise<T>): Promise<T | null> {
    const acquired = await this.acquire();
    
    if (!acquired) {
      console.error(`❌ Impossible d'acquérir le verrou, annulation de l'opération`);
      return null;
    }

    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

/**
 * Instance de verrou pour l'initialisation de la base de données
 */
export const dbInitializationLock = new ProcessLock('db-initialization', {
  timeout: 60 * 60 * 1000, // 1 heure timeout pour l'indexation
  retries: 120, // 120 tentatives = 1 minute max d'attente
  retryDelay: 500
});