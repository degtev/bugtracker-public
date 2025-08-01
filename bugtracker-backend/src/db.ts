import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

export default pool;

export const query = (text: string, params?: any[]) => pool.query(text, params);
