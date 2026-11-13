/* ============================================================
   DATA DENAH GKU – TELKOM UNIVERSITY
   Nomor ruangan = lantai x 100 + nomor urut (01–40).
   Contoh: lantai 1 nomor 09 -> ruang 109
   01–20 = separuh kiri, 21–40 = separuh kanan.
   - 01–06 : Koridor Atas Kiri (dari dekat Lobi Lift ke Tangga Kiri Atas)
   - 07–14 : Koridor Samping Kiri (dari atas ke bawah)
   - 15–20 : Koridor Bawah Kiri (dari Tangga Kiri Bawah ke Lobi Lift)
   - 21–26 : Koridor Atas Kanan (dari dekat Lobi Lift ke Tangga Kanan Atas)
   - 27–34 : Koridor Samping Kanan (dari atas ke bawah)
   - 35–40 : Koridor Bawah Kanan (dari Tangga Kanan Bawah ke Lobi Lift)
   ============================================================ */
const GKU = {
  nama: "Gedung Kuliah Umum (GKU)",
  kampus: "Telkom University",
  jumlahLantai: 11,
  ruangPerLantai: 40,
  baseUrl: "https://sakaa99.github.io/BarcodeGKU/",

  /* TODO(data): isi di bawah ini MASIH CONTOH. Ganti dengan nama ruangan asli
     hasil survei GKU sebelum dipakai sungguhan. Ruangan yang tidak tercantum
     otomatis tampil sebagai "Ruang <nomor>". */
  namaRuang: {
    "101": "Ruang Kelas 101",
    "105": "Ruang Administrasi GKU",
    "109": "Ruang 109",
    "121": "Ruang Sidang 121",
    "201": "Ruang Kelas 201",
    "209": "Ruang Dosen Lantai 2",
    "301": "Ruang Kelas 301",
    "310": "Ruang Lab Komputer 3A",
    "401": "Ruang Kelas 401",
    "412": "Ruang Lab Jaringan 4B",
    "501": "Ruang Kelas 501",
    "509": "Ruang Dosen",
    "510": "Ruang Dosen 2",
    "601": "Ruang Kelas 601",
    "615": "Ruang Lab Multimedia 6A",
    "701": "Ruang Kelas 701",
    "709": "Ruang Dosen Lantai 7",
    "801": "Ruang Kelas 801",
    "820": "Ruang Lab Riset 8A",
    "908": "Ruang 908",
    "909": "Ruang 909",
    "910": "Ruang 910",
    "911": "Ruang Lab 9A",
    "912": "Ruang Lab 9B",
    "1001": "Aula GKU Lantai 10",
    "1009": "Ruang Seminar 1009"
  },

  /* Daftar chip pencarian populer sesuai desain UI/UX */
  pencarianPopuler: [
    { label: "101", query: "101", targetRoom: 101 },
    { label: "201", query: "201", targetRoom: 201 },
    { label: "301", query: "301", targetRoom: 301 },
    { label: "401", query: "401", targetRoom: 401 },
    { label: "509", query: "509", targetRoom: 509 },
    { label: "909", query: "909", targetRoom: 909 },
    { label: "Ruang Dosen", query: "Ruang Dosen", targetRoom: 509 },
    { label: "Ruang Lab", query: "Ruang Lab", targetRoom: 911 }
  ],

  /* Keterangan tambahan per lantai */
  keteranganLantai: {
    1: "Lobi Utama & Pusat Informasi GKU",
    2: "Ruang Perkuliahan Umum & Dosen",
    3: "Ruang Perkuliahan & Laboratorium Dasar",
    4: "Ruang Perkuliahan & Lab Jaringan",
    5: "Ruang Dosen & Akademik Fakultas",
    6: "Ruang Perkuliahan & Lab Multimedia",
    7: "Ruang Perkuliahan & Ruang Dosen",
    8: "Ruang Kelas Reguler & Lab Riset",
    9: "Ruang Perkuliahan & Laboratorium Lanjut",
    10: "Aula Utama & Ruang Seminar GKU"
  }
};