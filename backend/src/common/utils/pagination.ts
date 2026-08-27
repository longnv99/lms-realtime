export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedData<T> {
  data: T[];
  meta: PaginationMeta;
}
