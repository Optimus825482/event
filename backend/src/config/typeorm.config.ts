import { DataSource } from "typeorm";
import { config } from "dotenv";
import { join } from "path";

// Load environment variables
config();

/**
 * TypeORM DataSource Configuration
 * Used for migrations and CLI commands
 *
 * IMPORTANT: Only ONE default export allowed for TypeORM CLI
 */
export default new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "eventflow",

  // Entities
  entities: [join(__dirname, "..", "entities", "*.entity{.ts,.js}")],

  // Migrations
  migrations: [join(__dirname, "..", "migrations", "*{.ts,.js}")],

  // Synchronize - ALWAYS false for migrations
  synchronize: false,

  // Logging
  logging:
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn", "schema"]
      : ["error"],

  // Connection pool
  extra: {
    max: parseInt(process.env.DB_POOL_MAX || "50", 10),
    min: parseInt(process.env.DB_POOL_MIN || "10", 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    query_timeout: 30000,
    statement_timeout: 60000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    application_name: `eventflow_${process.env.NODE_ENV || "dev"}`,
  },
});
