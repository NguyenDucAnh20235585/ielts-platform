import { z } from "zod";

/** Query fields shared by every paginated list (api-contract §1.4). */
export const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

export type Pagination = { page: number; limit: number; total: number; total_pages: number };

export type Paginated<Item> = { items: Item[]; pagination: Pagination };

export function offsetOf(page: number, limit: number): number {
  return (page - 1) * limit;
}

export function paginated<Item>(
  items: Item[],
  total: number,
  page: number,
  limit: number,
): Paginated<Item> {
  return {
    items,
    pagination: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };
}
