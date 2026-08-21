import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

export const db = new Database('dealership.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    isAdmin INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const defaultAdminPassword = bcrypt.hashSync('Admin123!', 10);
db.prepare(
  `INSERT OR IGNORE INTO users (id, name, email, password, isAdmin)
   VALUES (1, 'System Admin', 'admin@dealership.com', ?, 1)`,
).run(defaultAdminPassword);

db.prepare(
  `INSERT OR IGNORE INTO vehicles (id, make, model, category, price, quantity)
   VALUES
     (1, 'Toyota', 'Corolla', 'Sedan', 25000, 4),
     (2, 'Ford', 'Explorer', 'SUV', 38500, 2),
     (3, 'Chevrolet', 'Silverado', 'Truck', 44000, 3),
     (4, 'Honda', 'Civic', 'Sedan', 22000, 5),
     (5, 'BMW', 'X5', 'SUV', 62900, 1)`,
).run();
