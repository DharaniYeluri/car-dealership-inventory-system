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

type Receipt = {
  invoiceId: string;
  customerName: string;
  vehicleName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  tax: number;
  serviceFee: number;
  paymentMethod: string;
  total: number;
  purchasedAt: string;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
const TOKEN_KEY = 'dealership-token';
const USER_KEY = 'dealership-user';
const SETTINGS_KEY = 'dealership-settings';

type DealerSettings = {
  defaultRestockQuantity: number;
  vipFollowUp: boolean;
  autoStockAlerts: boolean;
  customerWelcomeMessages: boolean;
  salesNotifications: boolean;
};

const DEFAULT_SETTINGS: DealerSettings = {
  defaultRestockQuantity: 1,
  vipFollowUp: true,
  autoStockAlerts: true,
  customerWelcomeMessages: true,
  salesNotifications: true,
};

function normalizeSettings(raw: unknown): DealerSettings {
  const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (!parsed || typeof parsed !== 'object') {
    return DEFAULT_SETTINGS;
  }

  const rawQuantity = Number((parsed as Partial<DealerSettings>).defaultRestockQuantity);

  return {
    ...DEFAULT_SETTINGS,
    ...(parsed as Partial<DealerSettings>),
    defaultRestockQuantity: Number.isFinite(rawQuantity) ? Math.max(1, rawQuantity) : DEFAULT_SETTINGS.defaultRestockQuantity,
  };
}

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
  const [editDraft, setEditDraft] = useState<Vehicle | null>(null);
  const [restockAmounts, setRestockAmount] = useState<Record<number, number>>({});
  const [adminForm, setAdminForm] = useState({
    make: '',
    model: '',
    category: '',
    price: '',
    quantity: '',
  });
  const [settings, setSettings] = useState<DealerSettings>(() => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;

    try {
      return normalizeSettings(raw);
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authRole, setAuthRole] = useState<'customer' | 'admin'>('customer');
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', isAdmin: false });
  const [status, setStatus] = useState('');
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const isAdminUser = Boolean(user?.isAdmin);
  const [error, setError] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [activeTab, setActiveTab] = useState<'Overview' | 'Inventory' | 'Sales' | 'Customers' | 'Settings'>('Inventory');

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    return vehicles.filter((vehicle) => {
      const matchesSearch =
        !q ||
        [vehicle.make, vehicle.model, vehicle.category].some((field) => field.toLowerCase().includes(q));
      const matchesCategory = !categoryFilter || vehicle.category.toLowerCase() === categoryFilter.toLowerCase();
      const matchesMinPrice = !priceMin || vehicle.price >= Number(priceMin);
      const matchesMaxPrice = !priceMax || vehicle.price <= Number(priceMax);

      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
    });
  }, [vehicles, search, categoryFilter, priceMin, priceMax]);

  const totalVehicles = vehicles.length;
  const inStockVehicles = vehicles.filter((vehicle) => vehicle.quantity > 0).length;
  const lowStockVehicles = vehicles.filter((vehicle) => vehicle.quantity > 0 && vehicle.quantity <= 3).length;

  const salesOverview = useMemo(() => {
    const totalInventoryValue = vehicles.reduce((sum, vehicle) => sum + vehicle.price * vehicle.quantity, 0);
    const avgPrice = vehicles.length ? vehicles.reduce((sum, vehicle) => sum + vehicle.price, 0) / vehicles.length : 0;
    const unitsAvailable = vehicles.reduce((sum, vehicle) => sum + vehicle.quantity, 0);

    return {
      totalInventoryValue,
      avgPrice,
      unitsAvailable,
      lowStockCount: lowStockVehicles,
    };
  }, [vehicles, lowStockVehicles]);

  useEffect(() => {
    if (!token) {
      setAuthForm({ name: '', email: '', password: '', isAdmin: false });
    }
  }, [token]);

  useEffect(() => {
    document.body.style.overflow = receipt ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [receipt]);

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

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
      body.isAdmin = false;
    } else if (authRole === 'admin') {
      body.isAdmin = true;
    }

    if (authMode === 'login') {
      setAuthForm((prev) => ({ ...prev, isAdmin: authRole === 'admin' }));
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await response.json()) as AuthResponse & { message?: string };

    if (!response.ok) {
      const message = data.message ?? 'Authentication failed.';
      setError(message);
      if (authMode === 'login' && response.status === 404) {
        setAuthMode('register');
        setAuthRole('customer');
        setAuthForm((prev) => ({ ...prev, name: '', email: prev.email, password: '', isAdmin: false }));
      }
      return;
    }

    if (authMode === 'register') {
      setAuthMode('login');
      setAuthRole('customer');
      setStatus('Registration successful! Please log in to continue.');
      setError('');
      setAuthForm({ name: '', email: body.email as string, password: '', isAdmin: false });
      return;
    }

    setToken(data.token);
    setUser(data.user);
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setStatus('Welcome back!');
    setAuthForm({ name: '', email: '', password: '', isAdmin: false });
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setAuthForm({ name: '', email: '', password: '', isAdmin: false });
    setVehicles([]);
  };

  const handlePurchase = async (vehicleId: number) => {
    if (!token) return;
    const selectedVehicle = vehicles.find((vehicle) => vehicle.id === vehicleId);
    const quantity = 1;
    const response = await fetch(`${API_BASE}/vehicles/${vehicleId}/purchase`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ quantity }),
    });
    const data = (await response.json()) as { message?: string; vehicle?: Vehicle };
    if (!response.ok) {
      setError(data.message ?? 'Purchase failed.');
      setReceipt(null);
      return;
    }

    const unitPrice = selectedVehicle?.price ?? 0;
    const subtotal = unitPrice * quantity;
    const tax = subtotal * 0.08;
    const serviceFee = 299;
    const invoiceId = `INV-${Date.now()}`;
    const purchasedAt = new Date().toLocaleString();

    setReceipt({
      invoiceId,
      customerName: user?.name ?? 'Customer',
      vehicleName: `${selectedVehicle?.make ?? 'Vehicle'} ${selectedVehicle?.model ?? ''}`.trim(),
      category: selectedVehicle?.category ?? 'Vehicle',
      quantity,
      unitPrice,
      subtotal,
      tax,
      serviceFee,
      paymentMethod: 'Visa •••• 4821',
      total: subtotal + tax + serviceFee,
      purchasedAt,
    });
    setStatus(data.message ?? 'Vehicle purchased successfully. Sale recorded.');
    setError('');
    await refreshVehicles();
  };

  const handleDownloadInvoice = () => {
    if (!receipt) return;

    const invoiceText = [
      'DriveLine Motors',
      'Sales & Service Invoice',
      '=========================',
      `Invoice: ${receipt.invoiceId}`,
      `Customer: ${receipt.customerName}`,
      `Date: ${receipt.purchasedAt}`,
      `Vehicle: ${receipt.vehicleName}`,
      `Category: ${receipt.category}`,
      `Quantity: ${receipt.quantity}`,
      `Unit Price: $${receipt.unitPrice.toLocaleString()}`,
      `Subtotal: $${receipt.subtotal.toLocaleString()}`,
      `Tax: $${receipt.tax.toFixed(2)}`,
      `Service fee: $${receipt.serviceFee.toLocaleString()}`,
      `Payment: ${receipt.paymentMethod}`,
      `Total Charged: $${receipt.total.toLocaleString()}`,
      '',
      'Authorized by: DriveLine Motors Sales Team',
      'Thank you for choosing DriveLine Motors.',
    ].join('\n');

    const blob = new Blob([invoiceText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${receipt.invoiceId}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handlePrintInvoice = () => {
    if (!receipt) return;
    window.print();
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

  const handleRestock = async (vehicleId: number, quantityToAdd = 1) => {
    if (!token) return;
    const cleanQuantity = Number(quantityToAdd);
    const response = await fetch(`${API_BASE}/vehicles/${vehicleId}/restock`, {
      method: 'POST',
      headers: getAuthHeaders(token),
      body: JSON.stringify({ quantity: Number.isFinite(cleanQuantity) && cleanQuantity > 0 ? cleanQuantity : 1 }),
    });
    const data = (await response.json()) as { message?: string };
    if (!response.ok) {
      setError(data.message ?? 'Restock failed.');
      return;
    }
    setStatus(data.message ?? 'Vehicle restocked.');
    setError('');
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
      <div className="relative min-h-screen overflow-hidden bg-[#030b16] px-6 py-12 text-slate-100">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'url("https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1600&q=80")',
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_25%),radial-gradient(circle_at_bottom_right,_rgba(168,85,247,0.20),_transparent_28%),linear-gradient(120deg,_rgba(3,7,18,0.92),_rgba(15,23,42,0.82),_rgba(3,7,18,0.94))]" />
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)', backgroundSize: '36px 36px' }} />

        <div className="pointer-events-none absolute inset-x-0 top-10 flex justify-center">
          <div className="relative h-56 w-[440px] opacity-80 blur-[2px]">
            <div className="absolute left-1/2 top-10 h-20 w-52 -translate-x-1/2 rounded-[50%] border border-violet-400/30 bg-violet-500/10" />
            <div className="absolute left-1/2 top-20 h-16 w-72 -translate-x-1/2 rounded-[18px] border border-slate-400/30 bg-gradient-to-r from-slate-800/40 via-slate-700/30 to-slate-600/20" />
            <div className="absolute left-10 top-28 h-8 w-20 rounded-full border border-slate-400/30 bg-slate-800/60" />
            <div className="absolute right-10 top-28 h-8 w-20 rounded-full border border-slate-400/30 bg-slate-800/60" />
            <div className="absolute left-12 top-32 h-3 w-3 rounded-full bg-slate-200/80" />
            <div className="absolute right-12 top-32 h-3 w-3 rounded-full bg-slate-200/80" />
            <div className="absolute left-1/2 top-24 h-2 w-32 -translate-x-1/2 rounded-full bg-violet-400/40" />
          </div>
        </div>

        <div className="relative mx-auto max-w-md rounded-[32px] border border-violet-400/30 bg-slate-950/70 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.9)] backdrop-blur-xl">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-black tracking-[-0.04em] text-white">DriveLine Motors</h1>
          </div>

          <div className="mb-6 flex rounded-full bg-slate-800 p-1">
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${authMode === 'login' ? 'bg-violet-500 text-white' : 'text-slate-300'}`}
              type="button"
              onClick={() => {
                setAuthMode('login');
                setAuthForm((prev) => ({ ...prev, password: '', email: prev.email || '' }));
              }}
            >
              Login
            </button>
            <button
              className={`flex-1 rounded-full px-4 py-2 text-sm font-medium ${authMode === 'register' ? 'bg-violet-500 text-white' : 'text-slate-300'}`}
              type="button"
              onClick={() => {
                setAuthMode('register');
                setAuthForm((prev) => ({ ...prev, password: '', isAdmin: false }));
              }}
            >
              Register
            </button>
          </div>

          {authMode === 'login' && (
            <div className="mb-6 grid grid-cols-2 gap-2">
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${authRole === 'customer' ? 'bg-emerald-500 text-white' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
                onClick={() => {
                  setAuthRole('customer');
                  setAuthForm({ name: '', email: '', password: '', isAdmin: false });
                }}
              >
                Customer Login
              </button>
              <button
                type="button"
                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${authRole === 'admin' ? 'bg-violet-500 text-white' : 'border border-slate-700 bg-slate-900 text-slate-300'}`}
                onClick={() => {
                  setAuthRole('admin');
                  setAuthForm({ name: '', email: 'admin@dealership.com', password: 'Admin123!', isAdmin: true });
                }}
              >
                Admin Login
              </button>
            </div>
          )}

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
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-400"
                value={authForm.password}
                onChange={(event) => setAuthForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="••••••••"
              />
            </label>

            {authMode === 'register' && (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-violet-100">
                Customer registration only. Admin access uses the default dealership account.
              </div>
            )}

            {error && <p className="text-sm text-rose-400">{error}</p>}

            <button className="w-full rounded-xl bg-violet-500 px-4 py-3 font-semibold text-white transition hover:bg-violet-400" type="submit">
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020b1f] text-slate-100">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex items-center justify-between border-b border-[#1d2c46] bg-[#0f2d1f] px-4 py-2 text-slate-100 shadow-[0_0_20px_rgba(0,0,0,0.25)]">
          <div className="flex items-center gap-4 text-[10px] text-slate-300">
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-400">◌</span>
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-slate-400">↻</span>
            <span className="rounded-full border border-slate-500 bg-[#0e1d13] px-2 py-1 font-medium uppercase tracking-[0.18em] text-emerald-300">
              Not secure
            </span>
            <span className="tracking-[0.1em] text-slate-300">192.168.56.1:5173</span>
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-300">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#ef4444] bg-[#ef4444] font-bold text-white">D</div>
            <div className="rounded-full border border-slate-600 bg-slate-900/60 px-2 py-1 uppercase tracking-[0.16em] text-slate-200">School</div>
          </div>
        </div>

        <div className={`border-b px-4 py-4 md:px-6 ${isAdminUser ? 'border-violet-500/30 bg-[radial-gradient(circle_at_top_left,_rgba(139,92,246,0.18),_transparent_30%),linear-gradient(135deg,_#120d2e_0%,_#0b1324_100%)]' : 'border-[#1c2b42] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.12),_transparent_35%),linear-gradient(135deg,_#07182f_0%,_#091a2d_100%)]'}`}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.34em] text-violet-300">DriveLine Motors</p>
              <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] text-slate-100 md:text-4xl">
                {isAdminUser ? 'Fleet Control Center' : 'Inventory Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${isAdminUser ? 'border-violet-400/60 bg-violet-500/10 text-violet-100' : 'border-[#30415c] bg-[#0d1c2d] text-slate-200'}`}>
                {isAdminUser ? 'ADMIN PORTAL' : user.name.toUpperCase()}
              </div>
              <button
                type="button"
                className="rounded-xl border border-[#3b4e68] bg-[#0d1c2d] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:border-violet-400 hover:text-white"
                onClick={logout}
              >
                Logout
              </button>
            </div>
          </div>
        </div>

        <main className="bg-[#020d1d] px-4 py-6 md:px-6">
          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-[22px] border border-violet-500/20 bg-[linear-gradient(135deg,_rgba(76,29,149,0.18),_rgba(15,23,42,0.85))] p-4 shadow-[0_12px_25px_rgba(76,29,149,0.15)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Total vehicles</p>
              <p className="mt-3 text-3xl font-bold text-white">{totalVehicles}</p>
            </div>
            <div className="rounded-[22px] border border-emerald-500/20 bg-[linear-gradient(135deg,_rgba(16,185,129,0.16),_rgba(15,23,42,0.85))] p-4 shadow-[0_12px_25px_rgba(16,185,129,0.12)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">In stock</p>
              <p className="mt-3 text-3xl font-bold text-emerald-300">{inStockVehicles}</p>
            </div>
            <div className="rounded-[22px] border border-amber-500/20 bg-[linear-gradient(135deg,_rgba(245,158,11,0.16),_rgba(15,23,42,0.85))] p-4 shadow-[0_12px_25px_rgba(245,158,11,0.12)]">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-300">Low stock</p>
              <p className="mt-3 text-3xl font-bold text-amber-300">{lowStockVehicles}</p>
            </div>
          </div>
          <div className="flex flex-col gap-6 xl:flex-row">
            <aside className="w-full rounded-[24px] border border-[#1b2d47] bg-[#091a2d] p-3 xl:max-w-[220px]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300">Navigation</p>
              <nav className="mt-3 space-y-2">
                {(isAdminUser ? ['Overview', 'Inventory', 'Sales', 'Customers', 'Settings'] : ['Overview', 'Inventory']).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveTab(item as 'Overview' | 'Inventory' | 'Sales' | 'Customers' | 'Settings')}
                    className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2 text-left text-sm font-medium transition ${activeTab === item ? 'bg-violet-500/15 text-violet-100 ring-1 ring-violet-500/30' : 'bg-[#0d1a2c] text-slate-300 hover:bg-[#112338]'}`}
                  >
                    <span>{item}</span>
                    <span className="rounded-full border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-300">{activeTab === item ? 'Live' : '•'}</span>
                  </button>
                ))}
              </nav>
            </aside>

            <section className="flex-1 space-y-6">
              {(activeTab === 'Overview' || activeTab === 'Sales') && (
                <div className="rounded-[28px] border border-[#1b2d47] bg-[#091a2d] p-5 md:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">Sales overview</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-[20px] border border-violet-500/20 bg-violet-500/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Units available</p>
                      <p className="mt-3 text-3xl font-bold text-white">{salesOverview.unitsAvailable}</p>
                    </div>
                    <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Inventory value</p>
                      <p className="mt-3 text-3xl font-bold text-emerald-300">${salesOverview.totalInventoryValue.toLocaleString()}</p>
                    </div>
                    <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Avg. price</p>
                      <p className="mt-3 text-3xl font-bold text-amber-300">${Math.round(salesOverview.avgPrice).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Customers' && (
                <div className="rounded-[28px] border border-[#1b2d47] bg-[#091a2d] p-5 md:p-7">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">Customer care</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">VIP leads</p>
                      <p className="mt-3 text-3xl font-bold text-emerald-300">12</p>
                    </div>
                    <div className="rounded-[20px] border border-violet-500/20 bg-violet-500/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Follow-ups</p>
                      <p className="mt-3 text-3xl font-bold text-violet-300">8</p>
                    </div>
                    <div className="rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-400">Test drives</p>
                      <p className="mt-3 text-3xl font-bold text-amber-300">4</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'Settings' && (
                <div className="rounded-[28px] border border-[#1b2d47] bg-[#091a2d] p-5 md:p-7">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-violet-300">Settings</p>
                    <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                      Saved
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[20px] border border-violet-500/20 bg-violet-500/5 p-4 text-slate-200">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium text-slate-100">Default restock quantity</p>
                          <p className="mt-1 text-sm text-slate-400">Used for quick restock actions.</p>
                        </div>
                        <div className="flex items-center overflow-hidden rounded-[12px] border border-[#314767] bg-[#081725]">
                          <button
                            type="button"
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                defaultRestockQuantity: Math.max(1, prev.defaultRestockQuantity - 1),
                              }))
                            }
                            className="h-10 w-10 text-lg text-slate-200 transition hover:bg-slate-700"
                            aria-label="Decrease default restock quantity"
                          >
                            −
                          </button>
                          <span className="w-12 text-center text-sm font-medium text-slate-100">{settings.defaultRestockQuantity}</span>
                          <button
                            type="button"
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                defaultRestockQuantity: prev.defaultRestockQuantity + 1,
                              }))
                            }
                            className="h-10 w-10 text-lg text-slate-200 transition hover:bg-slate-700"
                            aria-label="Increase default restock quantity"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-emerald-500/20 bg-emerald-500/5 p-4 text-slate-200">
                      <p className="text-sm font-medium text-slate-100">Customer notifications</p>
                      <div className="mt-4 space-y-3 text-sm text-slate-300">
                        {[
                          { key: 'vipFollowUp', label: 'VIP follow-up queue' },
                          { key: 'autoStockAlerts', label: 'Auto stock alerts' },
                          { key: 'customerWelcomeMessages', label: 'Welcome messages' },
                          { key: 'salesNotifications', label: 'Sales updates' },
                        ].map((toggle) => (
                          <label key={toggle.key} className="flex cursor-pointer items-center justify-between gap-3 rounded-[12px] border border-[#314767] bg-[#081725] px-3 py-2">
                            <span>{toggle.label}</span>
                            <input
                              type="checkbox"
                              checked={settings[toggle.key as keyof DealerSettings] as boolean}
                              onChange={(event) =>
                                setSettings((prev) => ({
                                  ...prev,
                                  [toggle.key]: event.target.checked,
                                }))
                              }
                              className="h-4 w-4 accent-violet-500"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[20px] border border-amber-500/20 bg-amber-500/5 p-4">
                    <p className="text-sm font-medium text-slate-100">Current preference summary</p>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-2">
                      <div>• Default restock: {settings.defaultRestockQuantity}</div>
                      <div>• VIP follow-up: {settings.vipFollowUp ? 'On' : 'Off'}</div>
                      <div>• Stock alerts: {settings.autoStockAlerts ? 'On' : 'Off'}</div>
                      <div>• Welcome messages: {settings.customerWelcomeMessages ? 'On' : 'Off'}</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-[#1b2d47] bg-[#091a2d] p-5 md:p-7">
                <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.28em] text-violet-300">Current stock</p>
                    <h2 className="mt-3 text-4xl font-extrabold tracking-[-0.04em] text-slate-100">Available vehicles</h2>
                  </div>

                  <div className="w-full max-w-[420px]">
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className="w-full rounded-[18px] border border-[#314767] bg-[#081725] px-4 py-3 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-violet-400"
                      placeholder="Search make or model"
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
                  <input
                    value={categoryFilter}
                    onChange={(event) => setCategoryFilter(event.target.value)}
                    className="rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                    placeholder="Category"
                  />
                  <input
                    type="number"
                    value={priceMin}
                    onChange={(event) => setPriceMin(event.target.value)}
                    className="rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                    placeholder="Min price"
                  />
                  <input
                    type="number"
                    value={priceMax}
                    onChange={(event) => setPriceMax(event.target.value)}
                    className="rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                    placeholder="Max price"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setCategoryFilter('');
                      setPriceMin('');
                      setPriceMax('');
                    }}
                    className="rounded-[14px] border border-[#3c4c67] bg-[#0e1f33] px-3 py-2.5 text-sm font-medium text-slate-200 transition hover:border-violet-400 hover:text-white"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {filteredVehicles.map((vehicle) => {
                  const stockState = vehicle.quantity === 0 ? 'Sold out' : vehicle.quantity <= 3 ? 'Low stock' : 'Available';
                  const stockColor =
                    vehicle.quantity === 0
                      ? 'bg-rose-500/10 text-rose-300'
                      : vehicle.quantity <= 3
                        ? 'bg-amber-500/10 text-amber-300'
                        : 'bg-emerald-500/10 text-emerald-300';

                  return (
                    <article key={vehicle.id} className="rounded-[24px] border border-[#1d2d47] bg-[linear-gradient(180deg,_rgba(13,24,40,0.98),_rgba(9,15,28,0.98))] p-4 shadow-[0_12px_20px_rgba(2,8,23,0.35)] transition hover:-translate-y-1 hover:border-violet-400/40">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-violet-300">{vehicle.category}</p>
                          <h3 className="mt-2 text-[24px] font-bold tracking-[-0.04em] text-slate-100">{vehicle.make}</h3>
                        </div>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-medium ${stockColor}`}>
                          {stockState}
                        </span>
                      </div>

                      <p className="mt-2 text-base text-slate-300">{vehicle.model}</p>
                      <div className="mt-5 flex items-end justify-between">
                        <div>
                          <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Price</p>
                          <p className="text-[24px] font-bold text-white">${vehicle.price.toLocaleString()}</p>
                        </div>
                        {!isAdminUser && (
                          <button
                            type="button"
                            disabled={vehicle.quantity === 0}
                            onClick={() => handlePurchase(vehicle.id)}
                            className="rounded-[12px] bg-violet-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                          >
                            Purchase
                          </button>
                        )}
                      </div>

                      {isAdminUser && (
                        <div className="mt-5 space-y-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const target = vehicles.find((item) => item.id === vehicle.id);
                                if (target) {
                                  setSelectedVehicleId(target.id);
                                  setEditDraft({ ...target, price: Number(target.price), quantity: Number(target.quantity) });
                                }
                              }}
                              className="flex-1 rounded-[12px] border border-[#384d6f] bg-[#0d1a2c] px-3 py-2 text-sm text-slate-200 transition hover:border-violet-400"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              className="flex-1 rounded-[12px] border border-rose-500/50 bg-[#2a1018] px-3 py-2 text-sm text-rose-200 transition hover:border-rose-400"
                            >
                              Delete
                            </button>
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="flex items-center overflow-hidden rounded-[12px] border border-[#314767] bg-[#081725]">
                              <button
                                type="button"
                                onClick={() =>
                                  setRestockAmount((prev) => ({
                                    ...prev,
                                    [vehicle.id]: Math.max(1, (Number(prev[vehicle.id]) || settings.defaultRestockQuantity) - 1),
                                  }))
                                }
                                className="h-10 w-10 text-lg text-slate-200 transition hover:bg-slate-700"
                                aria-label={`Decrease restock quantity for ${vehicle.make} ${vehicle.model}`}
                              >
                                −
                              </button>
                              <span className="w-12 text-center text-sm font-medium text-slate-100">{Number(restockAmounts[vehicle.id] ?? settings.defaultRestockQuantity)}</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setRestockAmount((prev) => ({
                                    ...prev,
                                    [vehicle.id]: (Number(prev[vehicle.id]) || settings.defaultRestockQuantity) + 1,
                                  }))
                                }
                                className="h-10 w-10 text-lg text-slate-200 transition hover:bg-slate-700"
                                aria-label={`Increase restock quantity for ${vehicle.make} ${vehicle.model}`}
                              >
                                +
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRestock(vehicle.id, Number(restockAmounts[vehicle.id] ?? settings.defaultRestockQuantity))}
                              className="flex-1 rounded-[12px] border border-violet-500/50 bg-[#120f2d] px-3 py-2 text-sm text-violet-200 transition hover:border-violet-400"
                            >
                              Restock
                            </button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>

            {isAdminUser && (
              <aside className="w-full space-y-6 xl:max-w-[360px]">
                <div className="rounded-[30px] border border-[#1d2d47] bg-[#091a2d] p-5 shadow-[0_15px_28px_rgba(2,8,23,0.4)]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-300">Admin tools</p>
                  <h2 className="mt-2 text-[30px] font-bold tracking-[-0.04em] text-slate-100">Add vehicle</h2>

                  <form className="mt-5 space-y-4" onSubmit={handleAddVehicle}>
                    <input
                      className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                      placeholder="Make"
                      value={adminForm.make}
                      onChange={(event) => setAdminForm((prev) => ({ ...prev, make: event.target.value }))}
                    />
                    <input
                      className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                      placeholder="Model"
                      value={adminForm.model}
                      onChange={(event) => setAdminForm((prev) => ({ ...prev, model: event.target.value }))}
                    />
                    <input
                      className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                      placeholder="Category"
                      value={adminForm.category}
                      onChange={(event) => setAdminForm((prev) => ({ ...prev, category: event.target.value }))}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <input
                        type="number"
                        className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                        placeholder="Price"
                        value={adminForm.price}
                        onChange={(event) => setAdminForm((prev) => ({ ...prev, price: event.target.value }))}
                      />
                      <input
                        type="number"
                        className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                        placeholder="Quantity"
                        value={adminForm.quantity}
                        onChange={(event) => setAdminForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      />
                    </div>
                    <button className="w-full rounded-[14px] bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400" type="submit">
                      Save vehicle
                    </button>
                  </form>
                </div>

                {selectedVehicleId && editDraft && (
                  <div className="rounded-[30px] border border-[#1d2d47] bg-[#091a2d] p-5 shadow-[0_15px_28px_rgba(2,8,23,0.4)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-violet-300">Edit selected</p>
                    <div className="mt-4 space-y-4">
                      <input
                        className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                        value={editDraft.make}
                        onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, make: event.target.value } : prev))}
                      />
                      <input
                        className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                        value={editDraft.model}
                        onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, model: event.target.value } : prev))}
                      />
                      <input
                        className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                        value={editDraft.category}
                        onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, category: event.target.value } : prev))}
                      />
                      <div className="grid gap-4 sm:grid-cols-2">
                        <input
                          type="number"
                          className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                          value={editDraft.price}
                          onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, price: Number(event.target.value) } : prev))}
                        />
                        <input
                          type="number"
                          className="w-full rounded-[14px] border border-[#314767] bg-[#081725] px-3 py-2.5 text-sm text-slate-100 outline-none focus:border-violet-400"
                          value={editDraft.quantity}
                          onChange={(event) => setEditDraft((prev) => (prev ? { ...prev, quantity: Number(event.target.value) } : prev))}
                        />
                      </div>
                      <button
                        type="button"
                        className="w-full rounded-[14px] bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-400"
                        onClick={() => {
                          void handleUpdate(editDraft);
                          setSelectedVehicleId(null);
                          setEditDraft(null);
                        }}
                      >
                        Save vehicle
                      </button>
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        </main>

        {receipt && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4"
            onClick={() => setReceipt(null)}
          >
            <div
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-[28px] border border-violet-500/30 bg-[#091a2d] p-6 shadow-[0_18px_40px_rgba(2,8,23,0.7)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-400/50 bg-violet-500/10 text-lg font-black text-violet-200">
                    D
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-violet-300">Receipt</p>
                    <h3 className="mt-1 text-xl font-bold text-slate-100">DriveLine Motors</h3>
                  </div>
                </div>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-300">
                  Paid
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between rounded-[18px] border border-violet-500/20 bg-gradient-to-r from-violet-500/10 to-slate-800/50 px-4 py-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Sales & Service</p>
                  <p className="mt-1 text-sm font-semibold text-slate-100">Official invoice</p>
                </div>
                <div className="text-right text-xs text-slate-300">
                  <div>{receipt.invoiceId}</div>
                  <div>{receipt.purchasedAt}</div>
                </div>
              </div>

              <div className="mt-5 rounded-[18px] border border-[#314767] bg-[#081725] p-4">
                <div className="flex items-center justify-between text-sm text-slate-300">
                  <span>Invoice</span>
                  <span className="font-medium text-slate-100">{receipt.invoiceId}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                  <span>Customer</span>
                  <span className="font-medium text-slate-100">{receipt.customerName}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm text-slate-300">
                  <span>Date</span>
                  <span className="font-medium text-slate-100">{receipt.purchasedAt}</span>
                </div>
              </div>

              <div className="mt-5 space-y-3 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>{receipt.vehicleName}</span>
                  <span className="text-slate-100">{receipt.quantity} × ${receipt.unitPrice.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Category</span>
                  <span className="text-slate-100">{receipt.category}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Subtotal</span>
                  <span className="text-slate-100">${receipt.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Tax (8%)</span>
                  <span className="text-slate-100">${receipt.tax.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Service fee</span>
                  <span className="text-slate-100">${receipt.serviceFee.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Payment</span>
                  <span className="text-slate-100">{receipt.paymentMethod}</span>
                </div>
              </div>

              <div className="mt-5 border-t border-[#314767] pt-4">
                <div className="flex items-center justify-between text-base font-semibold text-slate-100">
                  <span>Total charged</span>
                  <span>${receipt.total.toLocaleString()}</span>
                </div>
              </div>

              <div className="mt-6 rounded-[18px] border border-[#314767] bg-[#081725] p-4">
                <p className="text-[10px] uppercase tracking-[0.22em] text-slate-400">Authorized by</p>
                <div className="mt-3 flex items-end justify-between gap-4">
                  <div>
                    <div className="h-0.5 w-28 rounded-full bg-violet-400" />
                    <p className="mt-2 text-sm font-medium text-slate-100">DriveLine Motors Sales Team</p>
                  </div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-violet-300">Approved</p>
                </div>
              </div>

              <p className="mt-5 text-center text-sm italic text-emerald-300">
                Thank you for choosing DriveLine Motors.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={handlePrintInvoice}
                  className="rounded-[14px] border border-violet-500/50 bg-violet-500/10 px-4 py-3 text-sm font-semibold text-violet-200 transition hover:bg-violet-500/20"
                >
                  Print
                </button>
                <button
                  type="button"
                  onClick={handleDownloadInvoice}
                  className="rounded-[14px] border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  className="rounded-[14px] bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {(status || error) && (
          <div className="fixed bottom-6 right-6 max-w-sm rounded-[18px] border border-[#30415c] bg-[#091a2d] p-4 shadow-[0_15px_28px_rgba(2,8,23,0.5)]">
            {status && <p className="text-sm font-medium text-emerald-300">{status}</p>}
            {error && <p className="mt-2 text-sm font-medium text-rose-300">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
