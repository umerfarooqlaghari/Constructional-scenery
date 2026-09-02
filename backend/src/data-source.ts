import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Strip sslmode from URL — TypeORM/pg-connection-string mishandles sslmode=verify-full
// (tries to load a local CA cert that doesn't exist, hanging the SSL handshake).
const _raw = (process.env.DATABASE_URL || '').replace(/^["']|["']$/g, '');
const _url  = new URL(_raw.includes('://') ? _raw : 'postgres://localhost/db');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: _url.hostname,
  port: parseInt(_url.port, 10) || 5432,
  username: _url.username,
  password: decodeURIComponent(_url.password),
  database: _url.pathname.replace(/^\//, '').split('?')[0],
  ssl: { rejectUnauthorized: false },
  extra: {
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  },
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, 'entities', '*.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
});

