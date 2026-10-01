// server.js
import express from 'express';
import cors from 'cors';
import { pool } from './db.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <-- Ditambahkan agar req.body juga mendukung form-urlencoded

app.get('/kategori', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT id, nama FROM kategori ORDER BY nama'
        );
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ pesan: 'Gagal mengambil kategori' });
    }
});

app.get('/', (req, res) => {
    res.send('API Pengeluaran berjalan');
});

// GET semua data dari MySQL (Langkah 12)
app.get('/pengeluaran', async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.id, p.judul, p.nominal, p.tanggal, k.nama AS kategori
             FROM pengeluaran p
             LEFT JOIN kategori k ON p.id_kategori = k.id
             ORDER BY p.tanggal DESC`
        );
        res.json(rows);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error_asli: e.message, kode_error: e.code });
    }
});

// Get data 
app.get('/pengeluaran/:id', async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM pengeluaran WHERE id = ?', 
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ pesan: 'Data tidak ditemukan' });
        }
        res.json(rows[0]);
    } catch (e) {
        res.status(500).json({ pesan: 'Gagal mengambil data' });
    }
});

// POST tambah data
app.post('/pengeluaran', async (req, res) => {
    const { judul, nominal, id_kategori } = req.body;
    if (!judul || !nominal) {
        return res.status(400).json({ pesan: 'judul & nominal wajib' });
    }
    try {
        const [hasil] = await pool.query(
            `INSERT INTO pengeluaran (judul, nominal, id_kategori)
             VALUES (?, ?, ?)`,
            [judul, Number(nominal), id_kategori ?? null]
        );
        res.status(201).json({ id: hasil.insertId, judul, nominal });
    } catch (e) {
        res.status(500).json({ pesan: 'Gagal menyimpan data' });
    }
});

// PUT ubah data
app.put('/pengeluaran/:id', async (req, res) => {
    const { judul, nominal } = req.body;

    // Validasi input
    if (!judul || nominal === undefined || isNaN(Number(nominal))) {
        return res.status(400).json({ 
            pesan: 'Judul dan nominal harus diisi dengan angka yang valid' 
        });
    }

    try {
        const [hasil] = await pool.query(
            'UPDATE pengeluaran SET judul = ?, nominal = ? WHERE id = ?',
            [judul, Number(nominal), req.params.id]
        );
        if (hasil.affectedRows === 0) {
            return res.status(404).json({ pesan: 'Data tidak ditemukan' });
        }
        res.json({ id: Number(req.params.id), judul, nominal: Number(nominal) });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error_asli: e.message, kode_error: e.code });
    }
});

// DELETE hapus data
app.delete('/pengeluaran/:id', async (req, res) => {
    try {
        const [hasil] = await pool.query(
            'DELETE FROM pengeluaran WHERE id = ?', 
            [req.params.id]
        );
        if (hasil.affectedRows === 0) {
            return res.status(404).json({ pesan: 'Data tidak ditemukan' });
        }
        res.status(204).end();
    } catch (e) {
        res.status(500).json({ pesan: 'Gagal menghapus data' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
});