# Test Report

## Backend Test Suite

Command executed:

```bash
cd server
npm test -- --run
```

Result:

- Test files: 1 passed
- Tests: 12 passed
- Failures: 0
- Duration: 27.71s

### Covered Scenarios

- Blocks admin registration and requires the default admin account
- Registers a customer and returns a JWT
- Logs a customer in
- Prompts an unknown email to register
- Creates a vehicle with admin authentication
- Lists available vehicles
- Searches vehicles by make and category
- Rejects duplicate vehicle entries
- Processes a customer purchase and reduces stock
- Rejects purchases exceeding available stock
- Restocks a vehicle with admin authentication
- Deletes a vehicle with admin authentication

## Frontend Build Verification

Command:

```bash
cd client
npm run build
```

Result: The production frontend build succeeds with Vite.
