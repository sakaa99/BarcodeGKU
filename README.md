# Denah GKU – Telkom University

Web app statis (HTML/CSS/JS, tanpa build) untuk mencari ruangan di Gedung Kuliah Umum, melihat rute dari lift, dan membuat QR Code per ruangan.

Live: https://sakaa99.github.io/BarcodeGKU/

## Cara pakai
- Buka `index.html` (atau lewat GitHub Pages). Tidak perlu instalasi.
- Cari ruangan lewat nomor (`909`, `r909`, `Ruang 909`) atau nama (`ruang dosen`, `lab komputer`).
- **Riwayat Pencarian**: 6 ruangan terakhir yang dicari/diklik tersimpan otomatis di browser.
- **Ruangan Favorit**: tekan ikon bintang di kartu tujuan untuk menyimpan ruangan (maks. 12).
- **Titik awal**: pilih Lift Tengah, Kiri-Bawah, atau Kanan-Bawah lewat chip di panel atau klik lift di denah. Dua lift pojok ada di samping WC wanita.
- Klik **Buat QR** untuk membuat QR Code ke lantai/ruangan yang sedang dipilih.

Riwayat dan favorit disimpan di `localStorage` browser masing-masing (tidak dikirim ke server). Membuka lewat link QR tidak dicatat sebagai riwayat.

## Link langsung (untuk QR)
| URL | Hasil |
|-----|-------|
| `?lantai=5` | Denah lantai 5 (ruang 509 terpilih) |
| `?ruang=1038` | Denah lantai 10 + rute ke ruang 1038 |
| `?ruang=1038&dari=kiri` | Sama, tapi rute mulai dari lift pojok kiri-bawah (samping WC wanita) |

`dari` bernilai `tengah` (default), `kiri`, atau `kanan`. Cocok untuk QR yang ditempel di lift samping WC.

Kode ruangan = `lantai × 100 + nomor urut (01–40)`. Kode yang tidak valid (mis. `?ruang=1099`) diabaikan dan halaman kembali ke Lantai 1.

## Struktur
```
index.html     halaman + modal QR
style.css      tema (light/dark)
data.js        konfigurasi gedung & nama ruangan  <- edit di sini
script.js      denah SVG, rute, pencarian, QR
vendor/        qrcode.js (qrcodejs 1.0.0, MIT) di-host lokal
favicon.png    ikon tab
```

## Cara mengganti nama ruangan
Edit `namaRuang` di `data.js`:
```js
"509": "Ruang Dosen",
```
Data di file itu saat ini **masih contoh** dan perlu divalidasi dengan kondisi asli gedung.

## Batasan saat ini
- Layout semua lantai sama (dibuat dari rumus).
- Rute dari lift tengah berbasis aturan per koridor; rute dari lift pojok memakai graf koridor (jalur terpendek).
- Belum ada rute antar lantai.
