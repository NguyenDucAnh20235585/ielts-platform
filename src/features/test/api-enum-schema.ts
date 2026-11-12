import { z } from "zod";

/**
 * Zod schema for an API enum value: accepts the API spelling ("READING") and
 * returns the database value ("reading"). Used by query and body schemas.
 */
export function apiEnum<Map extends Record<string, string>>(map: Map) {
  const entries = Object.entries(map);
  const apiValues = entries.map(([, api]) => api);
  return z
    .string()
    .refine((value) => apiValues.includes(value), { message: `Expected one of: ${apiValues.join(", ")}` })
    .transform((value) => {
      const entry = entries.find(([, api]) => api === value);
      if (!entry) throw new Error("unreachable");
      return entry[0] as keyof Map & string;
    });
}
