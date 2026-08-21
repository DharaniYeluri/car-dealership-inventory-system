import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { db } from '../src/db.js';

describe('Car Dealership API', () => {
  let adminToken: string;
  let customerToken: string;
  let vehicleId: number;

  beforeAll(async () => {
    db.exec(`
      DELETE FROM vehicles;
      DELETE FROM sqlite_sequence WHERE name='vehicles';
      DELETE FROM users;
      DELETE FROM sqlite_sequence WHERE name='users';
    `);

    db.prepare(
      `INSERT OR IGNORE INTO users (id, name, email, password, isAdmin)
       VALUES (1, 'System Admin', 'admin@dealership.com', ?, 1)`,
    ).run(bcrypt.hashSync('Admin123!', 10));

    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@dealership.com', password: 'Admin123!' });

    adminToken = adminLogin.body.token;

    const customerRegister = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Customer User', email: 'customer@example.com', password: 'Password123!' });

    customerToken = customerRegister.body.token;
  });

  afterAll(async () => {
    // no-op, app is kept in-memory in tests
  });

  it('blocks admin registration and requires the default admin account', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Admin User', email: 'admin2@example.com', password: 'Password123!', isAdmin: true });

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/admin registration is disabled|default admin account/i);
  });

  it('registers a user and returns a JWT', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test Buyer', email: 'buyer@example.com', password: 'Password123!' });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.email).toBe('buyer@example.com');
  });

  it('logs a user in', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'customer@example.com', password: 'Password123!' });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
    expect(response.body.user.email).toBe('customer@example.com');
  });

  it('asks a user to register when the email does not exist', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing-user@example.com', password: 'Password123!' });

    expect(response.status).toBe(404);
    expect(response.body.message).toMatch(/register|not found/i);
  });

  it('creates a vehicle with admin auth', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        make: 'Toyota',
        model: 'Corolla',
        category: 'Sedan',
        price: 25000,
        quantity: 3,
      });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.make).toBe('Toyota');
    vehicleId = response.body.id;
  });

  it('lists available vehicles', async () => {
    const response = await request(app)
      .get('/api/vehicles')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
  });

  it('searches vehicles by make and category', async () => {
    const response = await request(app)
      .get('/api/vehicles/search')
      .query({ make: 'Toyota', category: 'Sedan' })
      .set('Authorization', `Bearer ${customerToken}`);

    expect(response.status).toBe(200);
    expect(response.body[0].make).toBe('Toyota');
  });

  it('rejects duplicate vehicle entries for the same make, model, and category', async () => {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        make: 'Toyota',
        model: 'Corolla',
        category: 'Sedan',
        price: 27000,
        quantity: 2,
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toMatch(/already exists|duplicate/i);
  });

  it('allows a customer to purchase a vehicle and reduces stock', async () => {
    const response = await request(app)
      .post(`/api/vehicles/${vehicleId}/purchase`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 1 });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Vehicle purchased successfully');
    expect(response.body.vehicle.quantity).toBe(2);
  });

  it('forbids purchase when the requested quantity exceeds stock', async () => {
    const response = await request(app)
      .post(`/api/vehicles/${vehicleId}/purchase`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ quantity: 3 });

    expect(response.status).toBe(400);
    expect(response.body.message).toMatch(/not enough stock|insufficient/i);
  });

  it('allows admin to restock a vehicle', async () => {
    const response = await request(app)
      .post(`/api/vehicles/${vehicleId}/restock`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 4 });

    expect(response.status).toBe(200);
    expect(response.body.vehicle.quantity).toBe(6);
  });

  it('allows admin to delete a vehicle', async () => {
    const response = await request(app)
      .delete(`/api/vehicles/${vehicleId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('deleted');
  });
});
