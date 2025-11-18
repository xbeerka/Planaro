/**
 * IndexedDB Cache для мгновенной загрузки данных календаря
 * Стратегия: Stale-While-Revalidate
 * 
 * 1. Показываем кэшированные данные мгновенно (0ms)
 * 2. В фоне загружаем свежие данные с сервера
 * 3. Обновляем UI и кэш
 * 
 * Преимущества:
 * - Instant loading вместо 800ms wait
 * - Offline support (с устаревшими данными)
 * - Reduced server load
 * - Better UX
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { SchedulerEvent, Project, Resource, Department, Grade, Company, EventPattern } from '../types/scheduler';

// Схема базы данных
interface SchedulerCacheDB extends DBSchema {
  events: {
    key: string; // workspaceId
    value: {
      workspaceId: string;
      events: SchedulerEvent[];
      timestamp: number;
      version: number;
    };
  };
  projects: {
    key: string; // workspaceId
    value: {
      workspaceId: string;
      projects: Project[];
      timestamp: number;
    };
  };
  resources: {
    key: string; // workspaceId
    value: {
      workspaceId: string;
      resources: Resource[];
      timestamp: number;
    };
  };
  departments: {
    key: string; // workspaceId
    value: {
      workspaceId: string;
      departments: Department[];
      timestamp: number;
    };
  };
  grades: {
    key: 'global'; // Grades are global
    value: {
      grades: Grade[];
      timestamp: number;
    };
  };
  companies: {
    key: 'global'; // Companies are global
    value: {
      companies: Company[];
      timestamp: number;
    };
  };
  eventPatterns: {
    key: 'global'; // Event patterns are global
    value: {
      eventPatterns: EventPattern[];
      timestamp: number;
    };
  };
}

const DB_NAME = 'scheduler-cache';
const DB_VERSION = 2; // Increment when schema changes

let dbPromise: Promise<IDBPDatabase<SchedulerCacheDB>> | null = null;

/**
 * Получить/создать соединение с IndexedDB
 */
function getDB(): Promise<IDBPDatabase<SchedulerCacheDB>> {
  if (!dbPromise) {
    dbPromise = openDB<SchedulerCacheDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion, newVersion) {
        console.log(`🔧 Upgrading IndexedDB from v${oldVersion} to v${newVersion}`);
        
        // Создаем stores если их нет
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events');
        }
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects');
        }
        if (!db.objectStoreNames.contains('resources')) {
          db.createObjectStore('resources');
        }
        if (!db.objectStoreNames.contains('departments')) {
          db.createObjectStore('departments');
        }
        if (!db.objectStoreNames.contains('grades')) {
          db.createObjectStore('grades');
        }
        if (!db.objectStoreNames.contains('companies')) {
          db.createObjectStore('companies');
        }
        if (!db.objectStoreNames.contains('eventPatterns')) {
          db.createObjectStore('eventPatterns');
        }
      },
      blocked() {
        console.warn('⚠️ IndexedDB upgrade blocked by another tab');
      },
      blocking() {
        console.warn('⚠️ IndexedDB is blocking another tab upgrade');
        // Можно закрыть соединение чтобы разблокировать
        dbPromise?.then(db => db.close());
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

// =============================================================================
// EVENTS
// =============================================================================

/**
 * Получить кэшированные события
 * @param workspaceId - ID воркспейса
 * @param maxAge - Максимальный возраст кэша в миллисекундах (по умолчанию 5 минут)
 * @returns События или null если кэш устарел/отсутствует
 */
export async function getCachedEvents(
  workspaceId: string,
  maxAge: number = 5 * 60 * 1000 // 5 minutes
): Promise<SchedulerEvent[] | null> {
  try {
    const db = await getDB();
    const cached = await db.get('events', workspaceId);
    
    if (!cached) {
      console.log(`📦 No cached events for workspace ${workspaceId}`);
      return null;
    }
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) {
      console.log(`📦 Cached events expired (${Math.round(age / 1000)}s old)`);
      return null;
    }
    
    console.log(`📦 Loaded ${cached.events.length} events from IndexedDB (${Math.round(age / 1000)}s old)`);
    return cached.events;
  } catch (error) {
    console.error('❌ IndexedDB read error (events):', error);
    return null;
  }
}

/**
 * Сохранить события в кэш
 */
export async function setCachedEvents(
  workspaceId: string,
  events: SchedulerEvent[],
  version: number = 1
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('events', {
      workspaceId,
      events,
      timestamp: Date.now(),
      version
    });
    console.log(`💾 Cached ${events.length} events to IndexedDB`);
  } catch (error) {
    console.error('❌ IndexedDB write error (events):', error);
  }
}

// =============================================================================
// PROJECTS
// =============================================================================

export async function getCachedProjects(
  workspaceId: string,
  maxAge: number = 15 * 60 * 1000 // 15 minutes (меняются реже)
): Promise<Project[] | null> {
  try {
    const db = await getDB();
    const cached = await db.get('projects', workspaceId);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) return null;
    
    console.log(`📦 Loaded ${cached.projects.length} projects from IndexedDB (${Math.round(age / 1000)}s old)`);
    return cached.projects;
  } catch (error) {
    console.error('❌ IndexedDB read error (projects):', error);
    return null;
  }
}

export async function setCachedProjects(
  workspaceId: string,
  projects: Project[]
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('projects', {
      workspaceId,
      projects,
      timestamp: Date.now()
    });
    console.log(`💾 Cached ${projects.length} projects to IndexedDB`);
  } catch (error) {
    console.error('❌ IndexedDB write error (projects):', error);
  }
}

// =============================================================================
// RESOURCES
// =============================================================================

export async function getCachedResources(
  workspaceId: string,
  maxAge: number = 15 * 60 * 1000
): Promise<Resource[] | null> {
  try {
    const db = await getDB();
    const cached = await db.get('resources', workspaceId);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) return null;
    
    console.log(`📦 Loaded ${cached.resources.length} resources from IndexedDB (${Math.round(age / 1000)}s old)`);
    return cached.resources;
  } catch (error) {
    console.error('❌ IndexedDB read error (resources):', error);
    return null;
  }
}

export async function setCachedResources(
  workspaceId: string,
  resources: Resource[]
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('resources', {
      workspaceId,
      resources,
      timestamp: Date.now()
    });
    console.log(`💾 Cached ${resources.length} resources to IndexedDB`);
  } catch (error) {
    console.error('❌ IndexedDB write error (resources):', error);
  }
}

// =============================================================================
// DEPARTMENTS
// =============================================================================

export async function getCachedDepartments(
  workspaceId: string,
  maxAge: number = 15 * 60 * 1000
): Promise<Department[] | null> {
  try {
    const db = await getDB();
    const cached = await db.get('departments', workspaceId);
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) return null;
    
    console.log(`📦 Loaded ${cached.departments.length} departments from IndexedDB (${Math.round(age / 1000)}s old)`);
    return cached.departments;
  } catch (error) {
    console.error('❌ IndexedDB read error (departments):', error);
    return null;
  }
}

export async function setCachedDepartments(
  workspaceId: string,
  departments: Department[]
): Promise<void> {
  try {
    const db = await getDB();
    await db.put('departments', {
      workspaceId,
      departments,
      timestamp: Date.now()
    });
    console.log(`💾 Cached ${departments.length} departments to IndexedDB`);
  } catch (error) {
    console.error('❌ IndexedDB write error (departments):', error);
  }
}

// =============================================================================
// GLOBAL DATA (Grades, Companies, Event Patterns)
// =============================================================================

export async function getCachedGrades(
  maxAge: number = 60 * 60 * 1000 // 1 hour (rarely change)
): Promise<Grade[] | null> {
  try {
    const db = await getDB();
    const cached = await db.get('grades', 'global');
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) return null;
    
    console.log(`📦 Loaded ${cached.grades.length} grades from IndexedDB`);
    return cached.grades;
  } catch (error) {
    console.error('❌ IndexedDB read error (grades):', error);
    return null;
  }
}

export async function setCachedGrades(grades: Grade[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('grades', 'global', {
      grades,
      timestamp: Date.now()
    });
    console.log(`💾 Cached ${grades.length} grades to IndexedDB`);
  } catch (error) {
    console.error('❌ IndexedDB write error (grades):', error);
  }
}

export async function getCachedCompanies(
  maxAge: number = 60 * 60 * 1000
): Promise<Company[] | null> {
  try {
    const db = await getDB();
    const cached = await db.get('companies', 'global');
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) return null;
    
    console.log(`📦 Loaded ${cached.companies.length} companies from IndexedDB`);
    return cached.companies;
  } catch (error) {
    console.error('❌ IndexedDB read error (companies):', error);
    return null;
  }
}

export async function setCachedCompanies(companies: Company[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('companies', 'global', {
      companies,
      timestamp: Date.now()
    });
    console.log(`💾 Cached ${companies.length} companies to IndexedDB`);
  } catch (error) {
    console.error('❌ IndexedDB write error (companies):', error);
  }
}

export async function getCachedEventPatterns(
  maxAge: number = 60 * 60 * 1000
): Promise<EventPattern[] | null> {
  try {
    const db = await getDB();
    const cached = await db.get('eventPatterns', 'global');
    
    if (!cached) return null;
    
    const age = Date.now() - cached.timestamp;
    if (age > maxAge) return null;
    
    console.log(`📦 Loaded ${cached.eventPatterns.length} event patterns from IndexedDB`);
    return cached.eventPatterns;
  } catch (error) {
    console.error('❌ IndexedDB read error (eventPatterns):', error);
    return null;
  }
}

export async function setCachedEventPatterns(eventPatterns: EventPattern[]): Promise<void> {
  try {
    const db = await getDB();
    await db.put('eventPatterns', 'global', {
      eventPatterns,
      timestamp: Date.now()
    });
    console.log(`💾 Cached ${eventPatterns.length} event patterns to IndexedDB`);
  } catch (error) {
    console.error('❌ IndexedDB write error (eventPatterns):', error);
  }
}

// =============================================================================
// CACHE INVALIDATION
// =============================================================================

/**
 * Очистить кэш для воркспейса
 */
export async function clearWorkspaceCache(workspaceId: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('events', workspaceId);
    await db.delete('projects', workspaceId);
    await db.delete('resources', workspaceId);
    await db.delete('departments', workspaceId);
    console.log(`🗑️ Cleared cache for workspace ${workspaceId}`);
  } catch (error) {
    console.error('❌ Cache clear error:', error);
  }
}

/**
 * Очистить весь кэш (при выходе из системы)
 */
export async function clearAllCache(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('events');
    await db.clear('projects');
    await db.clear('resources');
    await db.clear('departments');
    await db.clear('grades');
    await db.clear('companies');
    await db.clear('eventPatterns');
    console.log(`🗑️ Cleared all cache`);
  } catch (error) {
    console.error('❌ Cache clear error:', error);
  }
}
