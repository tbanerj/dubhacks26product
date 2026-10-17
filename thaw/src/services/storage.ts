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
export async function cacheGet<T>(key: string, ttlMs: number): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(`thaw-cache:${key}`);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.at > ttlMs) return null;
    return entry.value;
  } catch {
    return null;
  }
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
