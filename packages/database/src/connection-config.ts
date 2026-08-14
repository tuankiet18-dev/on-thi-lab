export interface DatabaseConnectionOptions {
  /**
   * Lambda containers must keep this value small. Supavisor multiplexes many
   * short-lived clients over a bounded number of PostgreSQL connections.
   */
  maxConnections?: number;
  connectTimeoutSeconds?: number;
  idleTimeoutSeconds?: number;
  maxLifetimeSeconds?: number;
}

export interface PostgresClientOptions {
  prepare: false;
  max: number;
  connect_timeout: number;
  idle_timeout: number;
  max_lifetime: number;
  ssl?: "require";
}

const DEFAULT_OPTIONS = {
  maxConnections: 1,
  connectTimeoutSeconds: 10,
  idleTimeoutSeconds: 20,
  maxLifetimeSeconds: 60 * 10,
} as const;

function positiveInteger(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && value! > 0 ? value! : fallback;
}

export function buildPostgresClientOptions(
  connectionString: string,
  options: DatabaseConnectionOptions = {},
): PostgresClientOptions {
  let requiresTls = false;
  try {
    requiresTls = new URL(connectionString).hostname.endsWith(".supabase.com");
  } catch {
    // postgres.js will report malformed connection strings when it connects.
  }

  return {
    prepare: false,
    max: positiveInteger(
      options.maxConnections,
      DEFAULT_OPTIONS.maxConnections,
    ),
    connect_timeout: positiveInteger(
      options.connectTimeoutSeconds,
      DEFAULT_OPTIONS.connectTimeoutSeconds,
    ),
    idle_timeout: positiveInteger(
      options.idleTimeoutSeconds,
      DEFAULT_OPTIONS.idleTimeoutSeconds,
    ),
    max_lifetime: positiveInteger(
      options.maxLifetimeSeconds,
      DEFAULT_OPTIONS.maxLifetimeSeconds,
    ),
    ...(requiresTls ? { ssl: "require" as const } : {}),
  };
}

export function isSupabaseTransactionPoolerUrl(
  connectionString: string,
): boolean {
  try {
    const url = new URL(connectionString);
    return url.hostname.endsWith(".pooler.supabase.com") && url.port === "6543";
  } catch {
    return false;
  }
}
