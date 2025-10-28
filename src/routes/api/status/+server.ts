import { isDatabaseInitialized } from '$lib/server/db.js';
import { getCacheStats } from '$lib/server/cache.js';
import { dbInitializationLock } from '$lib/server/lock.js';
import type { RequestHandler } from '@sveltejs/kit';

export const GET: RequestHandler = async () => {
  try {
    const stats = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage()
      },
      database: {
        initialized: isDatabaseInitialized(),
        lockStatus: dbInitializationLock.isLocked() ? 'locked' : 'unlocked'
      },
      cache: getCacheStats(),
      performance: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    return new Response(JSON.stringify(stats, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache'
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};