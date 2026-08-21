# Car Dealership Inventory System

A full-stack car dealership inventory application built with Node.js, TypeScript, Express, SQLite, and React + Tailwind CSS. The project includes JWT-based authentication, protected inventory routes, vehicle search, purchase/restock flows, and an admin dashboard for adding and managing stock.

## Overview

This project demonstrates a complete TDD workflow for a dealership inventory platform:

- Secure user registration and login with JWT authentication
- Protected vehicle listing and search endpoints
- Purchase flow that reduces stock and prevents overselling
- Admin-only vehicle management (create, update, delete, restock)
- React single-page frontend with responsive dashboard UX
- SQLite persistence for real data storage

## Tech Stack

Backend
- Node.js
- TypeScript
- Express
- SQLite via better-sqlite3
- JWT authentication
- Vitest for API tests

Frontend
- React
- Vite
- Tailwind CSS

## Project Structure

- server/: backend API source and tests
- client/: React frontend app
- docs/: screenshots and visual assets
- PROMPTS.md: raw AI interaction log

## Prerequisites

- Node.js 18+
- npm 9+

## Local Setup

1. Clone the repository and open the project root.
2. Install backend dependencies:

   cd server
   npm install

3. Install frontend dependencies:

   cd ../client
   npm install

4. Start the backend API:

   cd ../server
   npm run dev

   The API runs at http://localhost:5000.

5. Start the frontend app:

   cd ../client
   npm run dev -- --host 0.0.0.0

   The UI runs at http://localhost:5173.

6. Demo login:

   Email: admin@dealership.com
   Password: Admin123!

   This seeded admin account can create, update, delete, and restock inventory immediately.

## Environment Notes

The app uses a local SQLite database file created automatically when the backend starts. No external database service is required.

## API Endpoints

Authentication
- POST /api/auth/register
- POST /api/auth/login

Vehicles
- GET /api/vehicles
- GET /api/vehicles/search
- POST /api/vehicles
- PUT /api/vehicles/:id
- DELETE /api/vehicles/:id
- POST /api/vehicles/:id/purchase
- POST /api/vehicles/:id/restock

## Frontend Features

- Login/register screen
- Inventory dashboard with vehicle cards
- Search by make, model, or category
- Purchase action disabled when stock is zero
- Admin controls for adding, updating, deleting, and restocking vehicles
- Responsive layout and polished dark mode styling

## Screenshots

![DriveLine Motors registration screen](docs/registration%20page.png)

![DriveLine Motors login screen](docs/login%20page.png)

![DriveLine Motors admin dashboard](docs/Admin%20Portal.png)

![DriveLine Motors customer dashboard](docs/user%20portal.png)

![DriveLine Motors invoice receipt](docs/Invoice.png)


## My AI Usage

I used GitHub Copilot throughout the project lifecycle to accelerate the workflow.

How I used it:
- I asked Copilot to generate the initial Express + SQLite API scaffolding and route structure.
- I used Copilot to draft the API test cases before implementing the auth and inventory logic.
- I used Copilot to structure the React dashboard and Tailwind styling for the dealership UI.
- I asked for targeted debugging help when the SQLite persistence and TypeScript configuration issues surfaced during verification.

Reflection:
AI significantly reduced setup time and helped me maintain a clear TDD loop. It was especially useful for boilerplate generation, test writing, and quick validation after failures. I still reviewed and adjusted the implementation to ensure business logic, security checks, and project requirements were correct.

## Git and Commit Notes

This repo is initialized as a Git repository. If you want to publish it publicly, add your remote and push the branch after the local work is complete.

Example:

- git remote add origin <your-github-url>
- git push -u origin main

## License

This project is for educational and portfolio use.
