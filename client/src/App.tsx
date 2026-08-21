import { FormEvent, useEffect, useMemo, useState } from 'react';

type Vehicle = {
  id: number;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
};

type User = {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
};

type AuthResponse = {
  token: string;
  user: User;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const TOKEN_KEY = 'dealership-token';
const USER_KEY = 'dealership-user';

function getAuthHeaders(token?: string) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [search, setSearch] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [adminForm, setAdminForm] = useState({
    make: '',
    model: '',
    category: '',
    price: '',
    quantity: '',
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((vehicle) => {
      return [vehicle.make, vehicle.model, vehicle.category].some((field) => field.toLowerCase().includes(q));
    });
  }, [vehicles, search]);

  const refreshVehicles = async () => {
    if (!token) return;
    const response = await fetch(`${API_BASE}/vehicles`, {
      headers: getAuthHeaders(token),
    });
    if (!response.ok) {
      throw new Error('Unable to load inventory.');
    }
    const data = (await response.json()) as Vehicle[];
    setVehicles(data);
  };

  useEffect(() => {
    if (!token) return;
    refreshVehicles().catch(() => {
      setError('Inventory could not be loaded.');
    });
  }, [token]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setStatus('');

    const endpoint = authMode === 'login' ? '/auth/login' : '/auth/register';
    const body: Record<string, string | boolean> = {
      email: authForm.email,
      password: authForm.password,
    };

    if (authMode === 'register') {
      body.name = authForm.name;
      body.isAdmin = authForm.email.includes('admin');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as AuthResponse & { message?: string };

    if (!response.ok) {
      setError(data.message ?? 'Authentication failed.');
      return;
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setStatus(authMode === 'login' ? 'Welcome back!' : 'Registration successful!');
    setAuthForm({ name: '', email: '', password: '' });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setVehicles([]);
  };

  const handlePurchase = async (vehicleId: number) => {
    if (!token) return;
    const response = await fetch(`${API_BASE}/vehicles/${vehicleId}/purchase`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ quantity: 1 }),
    });
    const data = (await response.json()) as { message?: string; vehicle?: Vehicle };
    if (!response.ok) {
      setError(data.message ?? 'Purchase failed.');
      return;
    }
    setStatus(data.message ?? 'Purchase successful.');
    setError('');
    await refreshVehicles();
  };

  const handleAddVehicle = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    const response = await fetch(`${API_BASE}/vehicles`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({
        make: adminForm.make,
        model: adminForm.model,
        category: adminForm.category,
        price: Number(adminForm.price),
        quantity: Number(adminForm.quantity),
      }),
    });

    const data = (await response.json()) as Vehicle & { message?: string };
    if (!response.ok) {
      setError(data.message ?? 'Unable to add vehicle.');
      return;
    }

    setStatus(`Added ${data.make} ${data.model}.`);
    setAdminForm({ make: '', model: '', category: '', price: '', quantity: '' });
    await refreshVehicles();
  };

  const handleDeleteVehicle = async (vehicleId: number) => {
    if (!token) return;
    const response = await fetch(`${API_BASE}/vehicles/${vehicleId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(token),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(data.message ?? 'Unable to delete vehicle.');
      return;
    }
    setStatus(data.message ?? 'Vehicle deleted.');
    setError('');
    await refreshVehicles();
  };

  const handleRestock = async (vehicleId: number) => {
    if (!token) return;
    const response = await fetch(`${API_BASE}/vehicles/${vehicleId}/restock`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ quantity: 5 }),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(data.message ?? 'Restock failed.');
      return;
    }
    setStatus(data.message ?? 'Vehicle restocked.');
    await refreshVehicles();
  };

  const handleUpdate = async (vehicle: Vehicle) => {
    if (!token) return;
    const updated = {
      ...vehicle,
      price: Number(vehicle.price),
      quantity: Number(vehicle.quantity),
    };

    const response = await fetch(`${API_BASE}/vehicles/${vehicle.id}`, {
      method: 'PUT',
      headers: getAuthHeaders(token),
      body: JSON.stringify(updated),
    });

    const data = (await response.json()) as Vehicle & { message?: string };
    if (!response.ok) {
      setError(data.message ?? 'Unable to update vehicle.');
      return;
    }

    setStatus(`${data.make} ${data.model} updated.`);
    await refreshVehicles();
  };

  if (!user || !token) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-md rounded-3xl border border-violet-500/30 bg-slate-900/80 p-8 shadow-soft backdrop-blur-sm">
          <div className="mb-8 text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-violet-300">DriveLine Motors</p>
            <h1 className="mt-3 text-3xl font-bold">Inventory access</h1>
          </div>

          <div className="mb-6 flex rounded-full bg-slate-800 p-1">
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${authMode === 'login' ? 'bg-violet-500 text-white' : 'text-slate-300'}`}
              type="button"
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${authMode === 'register' ? 'bg-violet-500 text-white' : 'text-slate-300'}`}
              type="button"
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleAuth}>
            {authMode === 'register' && (
              <label className="block text-sm text-slate-300">
                Full name
                <input
                  className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                  value={authForm.name}
                  onChange={(event) => setAuthForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Alex Morgan"
                />
              </label>
            )}

            <label className="block text-sm text-slate-300">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                value={authForm.email}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="you@example.com"
              />
            </label>

            <label className="block text-sm text-slate-300">
              Password
              <input
                type="password"
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="••••••••"
              />
            </label>

            {error && <p className="text-sm text-rose-400">{error}</p>}
            {status && <p className="text-sm text-emerald-400">{status}</p>}

            <button className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white transition hover:bg-violet-400" type="submit">
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-violet-300">DriveLine Motors</p>
            <h1 className="mt-1 text-2xl font-bold">Inventory Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-200">
              {user.name}
            </div>
            <button className="rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-violet-400" onClick={logout}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-8 px-6 py-8 lg:grid-cols-[1.3fr_0.7fr]">
        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-soft">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">Current stock</p>
                <h2 className="mt-2 text-2xl font-semibold">Available vehicles</h2>
              </div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400 md:w-64"
                placeholder="Search make or model"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredVehicles.map((vehicle) => (
              <article key={vehicle.id} className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-soft">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-violet-300">{vehicle.category}</p>
                    <h3 className="mt-2 text-2xl font-bold">{vehicle.make}</h3>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${vehicle.quantity > 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                    {vehicle.quantity > 0 ? `${vehicle.quantity} in stock` : 'Sold out'}
                  </span>
                </div>

                <p className="mt-3 text-lg text-slate-300">{vehicle.model}</p>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Price</p>
                    <p className="text-2xl font-bold text-white">${vehicle.price.toLocaleString()}</p>
                  </div>
                  <button
                    type="button"
                    disabled={vehicle.quantity === 0}
                    onClick={() => handlePurchase(vehicle.id)}
                    className="rounded-xl bg-violet-500 px-4 py-2 font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                  >
                    Purchase
                  </button>
                </div>

                {user.isAdmin && (
                  <div className="mt-5 flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedVehicleId(vehicle.id)}
                      className="flex-1 rounded-xl border border-slate-700 px-3 py-2 text-sm hover:border-violet-400"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestock(vehicle.id)}
                      className="flex-1 rounded-xl border border-violet-500/50 px-3 py-2 text-sm text-violet-200 hover:border-violet-400"
                    >
                      Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                      className="flex-1 rounded-xl border border-rose-500/50 px-3 py-2 text-sm text-rose-200 hover:border-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        {user.isAdmin && (
          <aside className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-soft">
              <p className="text-sm uppercase tracking-[0.25em] text-violet-300">Admin tools</p>
              <h2 className="mt-2 text-2xl font-semibold">Add vehicle</h2>

              <form className="mt-5 space-y-4" onSubmit={handleAddVehicle}>
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                  placeholder="Make"
                  value={adminForm.make}
                  onChange={(event) => setAdminForm((prev) => ({ ...prev, make: event.target.value }))}
                />
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                  placeholder="Model"
                  value={adminForm.model}
                  onChange={(event) => setAdminForm((prev) => ({ ...prev, model: event.target.value }))}
                />
                <input
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                  placeholder="Category"
                  value={adminForm.category}
                  onChange={(event) => setAdminForm((prev) => ({ ...prev, category: event.target.value }))}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                    placeholder="Price"
                    value={adminForm.price}
                    onChange={(event) => setAdminForm((prev) => ({ ...prev, price: event.target.value }))}
                  />
                  <input
                    type="number"
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                    placeholder="Quantity"
                    value={adminForm.quantity}
                    onChange={(event) => setAdminForm((prev) => ({ ...prev, quantity: event.target.value }))}
                  />
                </div>
                <button className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white hover:bg-violet-400" type="submit">
                  Save vehicle
                </button>
              </form>
            </div>

            {selectedVehicleId && (
              <div className="rounded-3xl border border-slate-800 bg-slate-900 p-5 shadow-soft">
                <p className="text-sm uppercase tracking-[0.25em] text-violet-300">Edit selected</p>
                {(() => {
                  const vehicle = vehicles.find((item) => item.id === selectedVehicleId);
                  if (!vehicle) return null;
                  return (
                    <div className="mt-4 space-y-4">
                      <input
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                        value={vehicle.make}
                        onChange={(event) => {
                          setVehicles((prev) => prev.map((item) => item.id === vehicle.id ? { ...item, make: event.target.value } : item));
                        }}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                        value={vehicle.model}
                        onChange={(event) => {
                          setVehicles((prev) => prev.map((item) => item.id === vehicle.id ? { ...item, model: event.target.value } : item));
                        }}
                      />
                      <input
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                        value={vehicle.category}
                        onChange={(event) => {
                          setVehicles((prev) => prev.map((item) => item.id === vehicle.id ? { ...item, category: event.target.value } : item));
                        }}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <input
                          type="number"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                          value={vehicle.price}
                          onChange={(event) => {
                            setVehicles((prev) => prev.map((item) => item.id === vehicle.id ? { ...item, price: Number(event.target.value) } : item));
                          }}
                        />
                        <input
                          type="number"
                          className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                          value={vehicle.quantity}
                          onChange={(event) => {
                            setVehicles((prev) => prev.map((item) => item.id === vehicle.id ? { ...item, quantity: Number(event.target.value) } : item));
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-white hover:bg-emerald-400"
                        onClick={() => {
                          const target = vehicles.find((item) => item.id === vehicle.id);
                          if (target) {
                            void handleUpdate(target);
                          }
                          setSelectedVehicleId(null);
                        }}
                      >
                        Apply changes
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}
          </aside>
        )}
      </main>

      {(status || error) && (
        <div className="fixed bottom-6 right-6 max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-4 shadow-soft">
          {status && <p className="text-sm text-emerald-300">{status}</p>}
          {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default App;
