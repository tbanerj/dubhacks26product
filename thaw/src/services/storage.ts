import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/** Never let a storage failure crash the game; persistence is best-effort. */
const safeStorage: StateStorage = {
  getItem: async (name) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name, value) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      // ignore – e.g. storage full; game continues in memory
    }
  },
  removeItem: async (name) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};

export const zustandStorage = createJSONStorage(() => safeStorage);

interface CacheEntry<T> {
  at: number;
  value: T;
}

/** Small TTL cache on top of AsyncStorage (used for place lookups). */
async function readCache<T>(key: string): Promise<CacheEntry<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(`thaw-cache:${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry<T>;
  } catch {
    return null;
  }
}

export async function cacheGet<T>(key: string, ttlMs: number): Promise<T | null> {
  const entry = await readCache<T>(key);
  if (!entry || Date.now() - entry.at > ttlMs) return null;
  return entry.value;
}

/** Last successful value, even past the TTL. Used when a live refresh fails. */
export async function cacheGetStale<T>(key: string): Promise<T | null> {
  const entry = await readCache<T>(key);
  return entry?.value ?? null;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { at: Date.now(), value };
    await AsyncStorage.setItem(`thaw-cache:${key}`, JSON.stringify(entry));
  } catch {
    // ignore
  }
}

export async function clearCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith('thaw-cache:')));
  } catch {
    // ignore
  }
}
