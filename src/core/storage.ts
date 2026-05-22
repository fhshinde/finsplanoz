import { z } from 'zod';

const PREFIX = 'hos.';

export function load<T>(key: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : fallback;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.error('storage save failed', key, e);
  }
}

export function remove(key: string) {
  localStorage.removeItem(PREFIX + key);
}
