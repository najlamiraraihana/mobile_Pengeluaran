export function validate(judul, nominal) {
  if (!judul.trim()) return 'Judul wajib diisi';
  if (judul.trim().length > 100) return 'Judul maksimal 100 karakter';
  if (!/^\d+$/.test(nominal)) return 'Nominal harus berupa angka rupiah utuh';

  const nilai = Number(nominal);
  if (!Number.isInteger(nilai) || nilai < 1 || nilai > 2147483647) {
    return 'Nominal harus 1 sampai 2147483647';
  }

  return '';
}

export function rupiah(nilai) {
  const amount = Number(nilai);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `Rp ${String(safeAmount).replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
}

export function tanggalLokal(value) {
  if (!value) return '-';

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value.split('-').reverse().join('/');
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return [date.getDate(), date.getMonth() + 1, date.getFullYear()].join('/');
}