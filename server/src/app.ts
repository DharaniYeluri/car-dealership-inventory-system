import express, { Request, Response } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { db } from './db.js';
import { AuthRequest, comparePassword, createUser, findUserByEmail, generateToken, hashPassword, requireAdmin, requireAuth } from './auth.js';

export const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { name, email, password, isAdmin } = req.body ?? {};

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  if (findUserByEmail(normalizedEmail)) {
    return res.status(409).json({ message: 'User already exists.' });
  }

  const passwordHash = await hashPassword(String(password));
  const user = createUser({
    name: String(name),
    email: normalizedEmail,
    password: passwordHash,
    isAdmin: Boolean(isAdmin),
  });

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: Boolean(user.isAdmin),
  });

  return res.status(201).json({
    token,
    user: { id: user.id, name: user.name, email: user.email, isAdmin: Boolean(user.isAdmin) },
  });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const user = findUserByEmail(normalizedEmail);

  if (!user || !(await comparePassword(String(password), user.password))) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const token = generateToken({
    id: user.id,
    email: user.email,
    name: user.name,
    isAdmin: Boolean(user.isAdmin),
  });

  return res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, isAdmin: Boolean(user.isAdmin) },
  });
});

app.get('/api/vehicles', requireAuth, (req: AuthRequest, res: Response) => {
  void req;
  const vehicles = db.prepare('SELECT * FROM vehicles ORDER BY createdAt DESC').all() as Array<{
    id: number;
    make: string;
    model: string;
    category: string;
    price: number;
    quantity: number;
  }>;

  return res.json(vehicles);
});

app.get('/api/vehicles/search', requireAuth, (req: Request, res: Response) => {
  const { make, model, category, priceMin, priceMax } = req.query as Record<string, string | undefined>;

  const clauses: string[] = [];
  const values: (string | number)[] = [];

  if (make) {
    clauses.push('make = ?');
    values.push(String(make));
  }

  if (model) {
    clauses.push('model = ?');
    values.push(String(model));
  }

  if (category) {
    clauses.push('category = ?');
    values.push(String(category));
  }

  if (priceMin) {
    clauses.push('price >= ?');
    values.push(Number(priceMin));
  }

  if (priceMax) {
    clauses.push('price <= ?');
    values.push(Number(priceMax));
  }

  let query = 'SELECT * FROM vehicles';

  if (clauses.length) {
    query += ` WHERE ${clauses.join(' AND ')}`;
  }

  query += ' ORDER BY createdAt DESC';

  const vehicles = db.prepare(query).all(...values) as Array<{ id: number; make: string; model: string; category: string; price: number; quantity: number }>;

  return res.json(vehicles);
});

app.post('/api/vehicles', requireAuth, requireAdmin, (req: AuthRequest, res: Response) => {
  const { make, model, category, price, quantity } = req.body ?? {};

  if (!make || !model || !category || price === undefined || quantity === undefined) {
    return res.status(400).json({ message: 'Make, model, category, price, and quantity are required.' });
  }

  const amount = Number(quantity);
  const salePrice = Number(price);

  if (amount < 0 || salePrice < 0) {
    return res.status(400).json({ message: 'Price and quantity must be non-negative.' });
  }

  const result = db.prepare(
    'INSERT INTO vehicles (make, model, category, price, quantity) VALUES (?, ?, ?, ?, ?)',
  ).run(String(make), String(model), String(category), salePrice, amount);

  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(result.lastInsertRowid) as {
    id: number;
    make: string;
    model: string;
    category: string;
    price: number;
    quantity: number;
  };

  return res.status(201).json(vehicle);
});

app.put('/api/vehicles/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const { make, model, category, price, quantity } = req.body ?? {};
  const existing = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(id)) as { id: number } | undefined;

  if (!existing) {
    return res.status(404).json({ message: 'Vehicle not found.' });
  }

  const updatedVehicle = db.prepare(`
    UPDATE vehicles
    SET make = COALESCE(?, make),
        model = COALESCE(?, model),
        category = COALESCE(?, category),
        price = COALESCE(?, price),
        quantity = COALESCE(?, quantity)
    WHERE id = ?
  `).run(
    make !== undefined ? String(make) : null,
    model !== undefined ? String(model) : null,
    category !== undefined ? String(category) : null,
    price !== undefined ? Number(price) : null,
    quantity !== undefined ? Number(quantity) : null,
    Number(id),
  );

  if (updatedVehicle.changes === 0) {
    return res.status(400).json({ message: 'Vehicle update failed.' });
  }

  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(id)) as {
    id: number;
    make: string;
    model: string;
    category: string;
    price: number;
    quantity: number;
  };

  return res.json(vehicle);
});

app.delete('/api/vehicles/:id', requireAuth, requireAdmin, (req: Request, res: Response) => {
  const { id } = req.params;
  const result = db.prepare('DELETE FROM vehicles WHERE id = ?').run(Number(id));

  if (result.changes === 0) {
    return res.status(404).json({ message: 'Vehicle not found.' });
  }

  return res.json({ message: `Vehicle ${id} deleted successfully.` });
});

app.post('/api/vehicles/:id/purchase', requireAuth, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const requestedQuantity = Number(req.body?.quantity ?? 1);
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(id)) as {
    id: number;
    make: string;
    model: string;
    category: string;
    price: number;
    quantity: number;
  } | undefined;

  if (!vehicle) {
    return res.status(404).json({ message: 'Vehicle not found.' });
  }

  if (requestedQuantity <= 0) {
    return res.status(400).json({ message: 'Quantity must be greater than zero.' });
  }

  if (vehicle.quantity < requestedQuantity) {
    return res.status(400).json({ message: 'Not enough stock for this purchase.' });
  }

  const nextQuantity = vehicle.quantity - requestedQuantity;
  const updatedVehicle = db.prepare('UPDATE vehicles SET quantity = ? WHERE id = ?').run(nextQuantity, Number(id));

  if (updatedVehicle.changes === 0) {
    return res.status(500).json({ message: 'Unable to update vehicle stock.' });
  }

  const finalVehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(id));

  return res.json({ message: 'Purchase successful.', vehicle: finalVehicle });
});

app.post('/api/vehicles/:id/restock', requireAuth, requireAdmin, (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const quantityToAdd = Number(req.body?.quantity ?? 1);
  const vehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(id)) as {
    id: number;
    make: string;
    model: string;
    category: string;
    price: number;
    quantity: number;
  } | undefined;

  if (!vehicle) {
    return res.status(404).json({ message: 'Vehicle not found.' });
  }

  if (quantityToAdd <= 0) {
    return res.status(400).json({ message: 'Quantity must be greater than zero.' });
  }

  const updatedVehicle = db.prepare('UPDATE vehicles SET quantity = quantity + ? WHERE id = ?').run(quantityToAdd, Number(id));

  if (updatedVehicle.changes === 0) {
    return res.status(500).json({ message: 'Unable to restock vehicle.' });
  }

  const finalVehicle = db.prepare('SELECT * FROM vehicles WHERE id = ?').get(Number(id));

  return res.json({ message: 'Vehicle restocked successfully.', vehicle: finalVehicle });
});

app.use((err: unknown, _req: Request, res: Response, _next: () => void) => {
  console.error(err);
  res.status(500).json({ message: 'Internal server error.' });
});
