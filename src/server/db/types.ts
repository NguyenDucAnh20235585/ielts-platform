import type postgres from "postgres";

export type Sql = postgres.Sql;
export type TransactionSql = postgres.TransactionSql;
/** Anything that can run a query: the pool or an open transaction. */
export type Queryable = postgres.ISql;
