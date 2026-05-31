CREATE TABLE IF NOT EXISTS transaksi (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tanggal DATE NOT NULL,
    keterangan VARCHAR(255) NOT NULL,
    tipe ENUM('Pemasukan', 'Pengeluaran') NOT NULL,
    jumlah DECIMAL(15, 2) NOT NULL
);