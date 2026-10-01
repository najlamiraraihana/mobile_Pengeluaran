const BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ||
  'http://192.168.1.31:3000';

export async function request(path, options = {}) {
  if (!BASE_URL) {
    throw new Error('Isi EXPO_PUBLIC_API_URL pada file .env');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (response.status === 204) return null;

    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error(`Respons bukan JSON (HTTP ${response.status})`);
    }

    if (!response.ok) {
      const error = new Error(
        data?.pesan || data?.error_asli || `Permintaan gagal (HTTP ${response.status})`,
      );
      error.status = response.status;
      throw error;
    }

    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Waktu tunggu habis. Periksa data sebelum mengulang.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  list: () => request('/pengeluaran'),
  detail: (id) => request(`/pengeluaran/${id}`),
  categories: () => request('/kategori'),
  create: (body) => request('/pengeluaran', {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  update: (id, body) => request(`/pengeluaran/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  }),
  remove: (id) => request(`/pengeluaran/${id}`, { method: 'DELETE' }),
};