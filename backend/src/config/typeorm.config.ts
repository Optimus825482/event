import { DataSource, DataSourceOptions } from "typeorm";
import { config } from "dotenv";
import { join } from "path";

// .env dosyasını yükle
config({ path: join(__dirname, "../../.env") });

export const dataSourceOptions: DataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "eventflow",
  entities: [join(__dirname, "../entities/**/*.entity{.ts,.js}")],
  migrations: [join(__dirname, "../migrations/*{.ts,.js}")],
  synchronize: false, // Migration kullanırken her zaman false
  logging: process.env.NODE_ENV === "development",
};

// TypeORM CLI için DataSource export
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
