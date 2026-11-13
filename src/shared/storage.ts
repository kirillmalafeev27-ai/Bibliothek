/**
 * Хранилище «ключ — строка». По умолчанию localStorage; если он недоступен
 * (приватный режим, песочница) — память. Ошибок наружу не бросает.
 */
export interface KeyValueStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

export function memoryStorage(): KeyValueStorage {
  const data = new Map<string, string>();
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => {
      data.set(key, value);
    },
  };
}

export function browserStorage(): KeyValueStorage {
  const fallback = memoryStorage();
  return {
    get(key) {
      try {
        const v = window.localStorage.getItem(key);
        return v ?? fallback.get(key);
      } catch {
        return fallback.get(key);
      }
    },
    set(key, value) {
      fallback.set(key, value);
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Хранилище недоступно или переполнено: живём на памяти.
      }
    },
  };
}

/** Тот же интерфейс, но все ключи — с префиксом игры. */
export function prefixed(storage: KeyValueStorage, prefix: string): KeyValueStorage {
  return {
    get: (key) => storage.get(prefix + key),
    set: (key, value) => storage.set(prefix + key, value),
  };
}

export function readJson<T>(storage: KeyValueStorage, key: string, fallback: T): T {
  const raw = storage.get(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return fallback;
    return { ...fallback, ...(parsed as object) } as T;
  } catch {
    return fallback;
  }
}

export function writeJson(storage: KeyValueStorage, key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}
