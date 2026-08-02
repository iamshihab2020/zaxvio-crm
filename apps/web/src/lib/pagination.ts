/**
 * The pagination envelope every list endpoint returns.
 *
 * This shape was declared **8 times** across page clients, half of them named
 * `PaginationData` and half `PaginationInfo`, all structurally identical. One
 * definition means a change to the contract is a compile error rather than a
 * silent divergence between two pages. (ARC-10 / ARC-02 cleanup)
 */
export interface PaginationData {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Historic alias — several pages named the same shape `PaginationInfo`. */
export type PaginationInfo = PaginationData;

export const EMPTY_PAGINATION: PaginationData = {
  page: 1,
  limit: 15,
  total: 0,
  totalPages: 0,
};
