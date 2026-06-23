import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Strip sslmode from URL — TypeORM/pg-connection-string mishandles sslmode=verify-full
// (tries to load a local CA cert that doesn't exist, hanging the SSL handshake).
const _raw = process.env.DATABASE_URL || '';
const _url  = new URL(_raw.includes('://') ? _raw : 'postgres://localhost/db');
const _pgUrl = `postgres://${_url.username}:${_url.password}@${_url.hostname}:${_url.port || 5432}${_url.pathname}`;

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: _pgUrl,
  ssl: { rejectUnauthorized: false },
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [path.join(__dirname, 'entities', '*.{ts,js}')],
  migrations: [path.join(__dirname, 'migrations', '*.{ts,js}')],
  migrationsTableName: 'typeorm_migrations',
});
