import bcrypt from 'bcryptjs';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'car-dealership-secret';

export type AuthUser = {
  id: number;
  email: string;
  name: string;
  isAdmin: boolean;
};

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: AuthUser) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload & AuthUser;
  return {
    id: Number(decoded.id),
    email: String(decoded.email),
    name: String(decoded.name),
    isAdmin: Boolean(decoded.isAdmin),
  };
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token required.' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const user = verifyToken(token);
    req.user = user;
    return next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ message: 'Admin access required.' });
  }

  return next();
}

export function findUserByEmail(email: string) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
    | {
        id: number;
        name: string;
        email: string;
        password: string;
        isAdmin: number;
      }
    | undefined;
}

export function createUser({ name, email, password, isAdmin = false }: { name: string; email: string; password: string; isAdmin?: boolean }) {
  const insert = db.prepare(
    'INSERT INTO users (name, email, password, isAdmin) VALUES (?, ?, ?, ?)',
  );

  const info = insert.run(name, email, password, isAdmin ? 1 : 0);
  return db.prepare('SELECT id, name, email, isAdmin FROM users WHERE id = ?').get(info.lastInsertRowid) as {
    id: number;
    name: string;
    email: string;
    isAdmin: number;
  };
}
