import { CircuitFileFormat } from '../types/circuit';

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
  componentCount: number;
  wireCount: number;
  data: CircuitFileFormat;
}

const DB_NAME = 'SECS_CircuitDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

// In-memory fallback map for environments without native IndexedDB (Node.js tests, private mode)
const inMemoryStore = new Map<string, SavedProject>();

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && !!window.indexedDB;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!hasIndexedDb()) {
      reject(new Error('IndexedDB not supported in this environment.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Returns all saved projects sorted by last updated timestamp descending
 */
export async function getAllProjects(): Promise<SavedProject[]> {
  if (!hasIndexedDb()) {
    const list = Array.from(inMemoryStore.values());
    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return list;
  }
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const list = (request.result as SavedProject[]) || [];
        list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        resolve(list);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to load projects from IndexedDB:', err);
    return [];
  }
}

/**
 * Saves or updates a project in IndexedDB
 */
export async function saveProject(project: SavedProject): Promise<void> {
  if (!hasIndexedDb()) {
    inMemoryStore.set(project.id, JSON.parse(JSON.stringify(project)));
    return;
  }
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(project);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to save project to IndexedDB:', err);
  }
}

/**
 * Retrieves a single project by ID
 */
export async function getProject(id: string): Promise<SavedProject | undefined> {
  if (!hasIndexedDb()) {
    const p = inMemoryStore.get(id);
    return p ? JSON.parse(JSON.stringify(p)) : undefined;
  }
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to get project from IndexedDB:', err);
    return undefined;
  }
}

/**
 * Deletes a project from IndexedDB
 */
export async function deleteProject(id: string): Promise<void> {
  if (!hasIndexedDb()) {
    inMemoryStore.delete(id);
    return;
  }
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to delete project from IndexedDB:', err);
  }
}

/**
 * Duplicates an existing project with a new ID and title
 */
export async function duplicateProject(id: string): Promise<SavedProject | null> {
  const original = await getProject(id);
  if (!original) return null;

  const now = new Date().toISOString();
  const duplicate: SavedProject = {
    ...original,
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name: `${original.name} (Copy)`,
    createdAt: now,
    updatedAt: now,
    data: {
      ...original.data,
      name: `${original.name} (Copy)`,
      timestamp: now,
    },
  };

  await saveProject(duplicate);
  return duplicate;
}
