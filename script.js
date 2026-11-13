/* ============================================================
   SCRIPT UTAMA DENAH GKU – TELKOM UNIVERSITY
   Mendukung Peta SVG Interaktif, Rute Dinamis, Pencarian Live,
   QR Code Generator, dan Dark Mode
   ============================================================ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const state = {
    lantai: 1,
    ruang: 109, // Default sesuai tampilan utama desain UI/UX (Ruang 109, Lantai 1)
    zoom: 1,
    darkMode: false,
    asal: "tengah", // titik awal rute: "tengah" | "kiri" | "kanan"
    riwayat: [], // kode ruangan terakhir dicari/dipilih (terbaru di depan)
    favorit: []  // kode ruangan yang dibintangi
  };

  /* ---------- Titik awal (lift) ----------
     tengah = lift di lobi tengah.
     kiri / kanan = lift di pojok bawah, bersebelahan dengan WC wanita. */
  const ASAL = {
    tengah: { label: "Lift Tengah", sub: "Lobi lift tengah", x: 500, y: 282 },
    kiri: { label: "Lift Kiri-Bawah", sub: "Samping WC wanita (pojok kiri bawah)", x: 97.5, y: 495 },
    kanan: { label: "Lift Kanan-Bawah", sub: "Samping WC wanita (pojok kanan bawah)", x: 902.5, y: 495 }
  };

  function asalValid(nilai) {
    return typeof nilai === "string" && Object.prototype.hasOwnProperty.call(ASAL, nilai);
  }

  function buatUrlDenah() {
    const p = [`lantai=${state.lantai}`];
    if (state.ruang) p.push(`ruang=${state.ruang}`);
    if (state.asal !== "tengah") p.push(`dari=${state.asal}`);
    return `${GKU.baseUrl}?${p.join("&")}`;
  }

  /* ---------- Penyimpanan lokal (riwayat & favorit) ---------- */
  const KUNCI_RIWAYAT = "gku.riwayat.v1";
  const KUNCI_FAVORIT = "gku.favorit.v1";
  const MAKS_RIWAYAT = 6;
  const MAKS_FAVORIT = 12;

  function bacaDaftar(kunci) {
    try {
      const arr = JSON.parse(window.localStorage.getItem(kunci) || "[]");
      return Array.isArray(arr) ? arr.filter((k) => parseKodeRuang(k)) : [];
    } catch (err) {
      return []; // storage diblokir / data rusak -> mulai kosong
    }
  }

  function simpanDaftar(kunci, daftar) {
    try {
      window.localStorage.setItem(kunci, JSON.stringify(daftar));
    } catch (err) {
      /* Abaikan: fitur tetap jalan untuk sesi ini saja */
    }
  }

  /* Satu-satunya validasi kode ruangan: kode = lantai x 100 + nomor urut.
     Mengembalikan { lantai, urut } bila valid, selain itu null. */
  function parseKodeRuang(nilai) {
    const kode = typeof nilai === "number" ? nilai : parseInt(nilai, 10);
    if (!Number.isInteger(kode)) return null;
    const lantai = Math.floor(kode / 100);
    const urut = kode % 100;
    if (lantai < 1 || lantai > GKU.jumlahLantai) return null;
    if (urut < 1 || urut > GKU.ruangPerLantai) return null;
    return { lantai, urut };
  }

  /* Baca parameter URL ?lantai=...&ruang=... jika dibuka dari hasil scan QR */
  function initFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const dari = params.get("dari");
      if (asalValid(dari)) state.asal = dari;
      const ruang = parseKodeRuang(params.get("ruang"));
      if (ruang) {
        state.lantai = ruang.lantai;
        state.ruang = ruang.lantai * 100 + ruang.urut;
        return;
      }
      const lParam = parseInt(params.get("lantai"), 10);
      if (lParam >= 1 && lParam <= GKU.jumlahLantai) {
        state.lantai = lParam;
        state.ruang = lParam * 100 + 9;
      }
    } catch (err) {
      /* Abaikan jika URLSearchParams tidak tersedia */
    }
  }

  /* Tentukan koordinat dan sisi setiap nomor urut ruangan (1..40) di dalam SVG 1000x560 */
  function getRoomGeometry(urut) {
    // 01-06: Atas Kiri (01 dekat Lobi Lift, 06 dekat Tangga Kiri Atas)
    if (urut >= 1 && urut <= 6) {
      const idxFromLeft = 6 - urut; // urut 6 -> idx 0 (x=145), urut 1 -> idx 5 (x=395)
      const x = 145 + idxFromLeft * 50;
      const y = 30;
      const w = 50;
      const h = 70;
      const lewat = urut - 1;
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w / 2,
        doorY: y + h + 14,
        sisi: "atas-kiri",
        via: "atas",
        kiri: true,
        lewat
      };
    }
    // 07-14: Samping Kiri (07 paling atas, 14 paling bawah)
    if (urut >= 7 && urut <= 14) {
      const idx = urut - 7;
      const x = 50;
      const y = 110 + idx * 42.5;
      const w = 85;
      const h = 42.5;
      const viaAtas = urut <= 10;
      const lewat = viaAtas ? (urut - 7) : (14 - urut);
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w + 16,
        doorY: y + h / 2,
        sisi: "samping-kiri",
        via: viaAtas ? "atas" : "bawah",
        kiri: true,
        lewat
      };
    }
    // 15-20: Bawah Kiri (15 dekat Tangga Kiri Bawah, 20 dekat Lobi Lift)
    if (urut >= 15 && urut <= 20) {
      const idx = urut - 15;
      const x = 145 + idx * 50;
      const y = 460;
      const w = 50;
      const h = 70;
      const lewat = 20 - urut;
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w / 2,
        doorY: y - 14,
        sisi: "bawah-kiri",
        via: "bawah",
        kiri: true,
        lewat
      };
    }
    // 21-26: Atas Kanan (21 dekat Lobi Lift, 26 dekat Tangga Kanan Atas)
    if (urut >= 21 && urut <= 26) {
      const idx = urut - 21;
      const x = 555 + idx * 50;
      const y = 30;
      const w = 50;
      const h = 70;
      const lewat = urut - 21;
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w / 2,
        doorY: y + h + 14,
        sisi: "atas-kanan",
        via: "atas",
        kiri: false,
        lewat
      };
    }
    // 27-34: Samping Kanan (27 paling atas, 34 paling bawah)
    if (urut >= 27 && urut <= 34) {
      const idx = urut - 27;
      const x = 865;
      const y = 110 + idx * 42.5;
      const w = 85;
      const h = 42.5;
      const viaAtas = urut <= 30;
      const lewat = viaAtas ? (urut - 27) : (34 - urut);
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x - 16,
        doorY: y + h / 2,
        sisi: "samping-kanan",
        via: viaAtas ? "atas" : "bawah",
        kiri: false,
        lewat
      };
    }
    // 35-40: Bawah Kanan (40 dekat Lobi Lift, 35 dekat Tangga Kanan Bawah)
    const idxFromRight = 40 - urut; // urut 40 -> idx 0 (x=555), urut 35 -> idx 5 (x=805)
    const x = 555 + idxFromRight * 50;
    const y = 460;
    const w = 50;
    const h = 70;
    const lewat = 40 - urut;
    return {
      urut, x, y, w, h,
      cx: x + w / 2,
      cy: y + h / 2,
      doorX: x + w / 2,
      doorY: y - 14,
      sisi: "bawah-kanan",
      via: "bawah",
      kiri: false,
      lewat
    };
  }

  /* Buat titik-titik jalur (waypoints) dari Lift melewati koridor atas/bawah ke pintu ruangan */
  function buildRoutePoints(urut) {
    const g = getRoomGeometry(urut);
    const liftCenterX = 500;
    const topCorridorY = 128;
    const bottomCorridorY = 432;
    const leftCorridorX = 160;
    const rightCorridorX = 840;

    // Ruangan di koridor atas (01-06 & 21-26)
    if (g.sisi === "atas-kiri" || g.sisi === "atas-kanan") {
      return [
        [liftCenterX, 205],
        [liftCenterX, topCorridorY],
        [g.doorX, topCorridorY],
        [g.doorX, g.doorY]
      ];
    }

    // Ruangan di koridor bawah (15-20 & 35-40)
    if (g.sisi === "bawah-kiri" || g.sisi === "bawah-kanan") {
      return [
        [liftCenterX, 341],
        [liftCenterX, bottomCorridorY],
        [g.doorX, bottomCorridorY],
        [g.doorX, g.doorY]
      ];
    }

    // Ruangan di koridor samping kiri (07-14)
    if (g.sisi === "samping-kiri") {
      if (g.via === "atas") {
        // Sesuai foto referensi 2: Keluar lift ke atas -> lurus kiri di koridor atas -> belok turun ke koridor samping kiri
        return [
          [liftCenterX, 205],
          [liftCenterX, topCorridorY],
          [leftCorridorX, topCorridorY],
          [leftCorridorX, g.doorY],
          [g.doorX, g.doorY]
        ];
      }
      // 11-14 via koridor bawah
      return [
        [liftCenterX, 341],
        [liftCenterX, bottomCorridorY],
        [leftCorridorX, bottomCorridorY],
        [leftCorridorX, g.doorY],
        [g.doorX, g.doorY]
      ];
    }

    // Ruangan di koridor samping kanan (27-34)
    if (g.via === "atas") {
      return [
        [liftCenterX, 205],
        [liftCenterX, topCorridorY],
        [rightCorridorX, topCorridorY],
        [rightCorridorX, g.doorY],
        [g.doorX, g.doorY]
      ];
    }
    return [
      [liftCenterX, 341],
      [liftCenterX, bottomCorridorY],
      [rightCorridorX, bottomCorridorY],
      [rightCorridorX, g.doorY],
      [g.doorX, g.doorY]
    ];
  }

  /* ---------- Rute dari lift pojok (graf koridor) ----------
     Koridor membentuk cincin: atas (y=128), bawah (y=432), kiri (x=160), kanan (x=840).
     Simpul = persimpangan. Rute = jalur terpendek di cincin, lalu masuk ke pintu ruangan. */
  const SIMPUL = {
    TL: [160, 128], TC: [500, 128], TR: [840, 128],
    BL: [160, 432], BC: [500, 432], BR: [840, 432]
  };
  const RUAS = [
    ["TL", "TC", "atas"], ["TC", "TR", "atas"],
    ["BL", "BC", "bawah"], ["BC", "BR", "bawah"],
    ["TL", "BL", "kiri"], ["TR", "BR", "kanan"]
  ];
  const AWAL_LIFT = {
    kiri: { simpul: "BL", pintu: [[97.5, 495], [97.5, 455], [160, 455]] },
    kanan: { simpul: "BR", pintu: [[902.5, 495], [902.5, 455], [840, 455]] }
  };
  const jarakManhattan = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);

  function jalurTerpendek(dari, ke) {
    const dist = {};
    const prev = {};
    const belum = new Set(Object.keys(SIMPUL));
    belum.forEach((k) => { dist[k] = Infinity; });
    dist[dari] = 0;
    while (belum.size) {
      let u = null;
      belum.forEach((k) => { if (u === null || dist[k] < dist[u]) u = k; });
      belum.delete(u);
      RUAS.forEach(([a, b]) => {
        const v = a === u ? b : (b === u ? a : null);
        if (!v) return;
        const d = dist[u] + jarakManhattan(SIMPUL[a], SIMPUL[b]);
        if (d < dist[v]) { dist[v] = d; prev[v] = u; }
      });
    }
    const path = [ke];
    while (path[0] !== dari) path.unshift(prev[path[0]]);
    return { path, jarak: dist[ke] };
  }

  /* Titik tempat pintu ruangan "menempel" ke koridor + ruas koridor yang dipakainya */
  function titikTempel(g) {
    if (g.sisi === "atas-kiri") return { a: [g.doorX, 128], ruas: ["TL", "TC"] };
    if (g.sisi === "atas-kanan") return { a: [g.doorX, 128], ruas: ["TC", "TR"] };
    if (g.sisi === "bawah-kiri") return { a: [g.doorX, 432], ruas: ["BL", "BC"] };
    if (g.sisi === "bawah-kanan") return { a: [g.doorX, 432], ruas: ["BC", "BR"] };
    if (g.sisi === "samping-kiri") return { a: [160, g.doorY], ruas: ["TL", "BL"] };
    return { a: [840, g.doorY], ruas: ["TR", "BR"] };
  }

  function namaRuas(a, b) {
    const r = RUAS.find(([p, q]) => (p === a && q === b) || (p === b && q === a));
    return r ? r[2] : "atas";
  }

  function arahGerak(dari, ke) {
    const dx = ke[0] - dari[0];
    const dy = ke[1] - dari[1];
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? "→" : "←";
    return dy >= 0 ? "↓" : "↑";
  }

  /* Hitung rute dari lift pojok ("kiri"/"kanan") ke ruangan: { points, moves } */
  function hitungRuteDariPojok(urut, asal) {
    const g = getRoomGeometry(urut);
    const awal = AWAL_LIFT[asal];
    const { a, ruas } = titikTempel(g);

    let terbaik = null;
    ruas.forEach((ujung) => {
      const j = jalurTerpendek(awal.simpul, ujung);
      const total = j.jarak + jarakManhattan(SIMPUL[ujung], a);
      if (!terbaik || total < terbaik.total) terbaik = { total, path: j.path, ujung };
    });

    const koordinat = terbaik.path.map((k) => SIMPUL[k]);
    const points = [...awal.pintu, ...koordinat];
    const moves = [];
    for (let i = 1; i < terbaik.path.length; i++) {
      moves.push({
        kor: namaRuas(terbaik.path[i - 1], terbaik.path[i]),
        arah: arahGerak(SIMPUL[terbaik.path[i - 1]], SIMPUL[terbaik.path[i]]),
        dari: SIMPUL[terbaik.path[i - 1]],
        ke: SIMPUL[terbaik.path[i]]
      });
    }
    if (jarakManhattan(SIMPUL[terbaik.ujung], a) > 0.5) {
      points.push(a);
      moves.push({
        kor: namaRuas(ruas[0], ruas[1]),
        arah: arahGerak(SIMPUL[terbaik.ujung], a),
        dari: SIMPUL[terbaik.ujung],
        ke: a,
        terakhir: true
      });
    }
    points.push([g.doorX, g.doorY]);
    const arahPintu = arahGerak(a, [g.doorX, g.doorY]);

    // buang titik kembar berurutan
    const bersih = points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
    return { points: bersih, moves, arahPintu, g };
  }

  const NAMA_KORIDOR = {
    atas: "koridor atas",
    bawah: "koridor bawah",
    kiri: "koridor samping kiri",
    kanan: "koridor samping kanan"
  };
  const KATA_ARAH = { "→": "ke kanan", "←": "ke kiri", "↑": "ke atas (utara)", "↓": "ke bawah (selatan)" };
  const KATA_SISI = { "→": "kanan", "←": "kiri", "↑": "atas", "↓": "bawah" };
  const NAMA_SISI_RUANG = {
    "atas-kiri": "koridor atas sisi kiri",
    "atas-kanan": "koridor atas sisi kanan",
    "bawah-kiri": "koridor bawah sisi kiri",
    "bawah-kanan": "koridor bawah sisi kanan",
    "samping-kiri": "koridor samping kiri",
    "samping-kanan": "koridor samping kanan"
  };

  /* Petunjuk teks untuk rute dari lift pojok */
  function arahTimelineDariPojok(kodeRuang, asal) {
    const urut = kodeRuang % 100;
    const { moves, arahPintu, g } = hitungRuteDariPojok(urut, asal);
    const sisiLift = asal === "kiri" ? "kiri" : "kanan";

    // gabungkan gerakan berurutan yang searah di koridor yang sama
    const gabung = [];
    moves.forEach((m) => {
      const akhir = gabung[gabung.length - 1];
      if (akhir && akhir.kor === m.kor && akhir.arah === m.arah) {
        akhir.ke = m.ke;
        akhir.terakhir = akhir.terakhir || m.terakhir;
      } else {
        gabung.push({ ...m });
      }
    });

    const langkah = [{
      icon: asal === "kiri" ? "↗" : "↖",
      judul: `Keluar dari ${ASAL[asal].label}`,
      desc: `Lift pojok ${sisiLift}-bawah, di samping WC wanita. Menuju persimpangan koridor ${sisiLift} dan koridor bawah.`
    }];

    gabung.forEach((m) => {
      const melewatiLobi = (m.kor === "atas" || m.kor === "bawah") &&
        Math.min(m.dari[0], m.ke[0]) < 500 && Math.max(m.dari[0], m.ke[0]) > 500;
      let desc = m.terakhir
        ? `Terus sampai sejajar dengan pintu Ruang ${kodeRuang}.`
        : "Ikuti koridor sampai persimpangan berikutnya.";
      if (melewatiLobi) desc = `Anda akan melewati lobi lift tengah. ${desc}`;
      langkah.push({
        icon: m.arah,
        judul: `Lurus ${KATA_ARAH[m.arah]} di ${NAMA_KORIDOR[m.kor]}`,
        desc
      });
    });

    langkah.push({
      icon: "◎",
      isTarget: true,
      judul: `Ruang ${kodeRuang}`,
      desc: `Pintu ada di sisi ${KATA_SISI[arahPintu]} koridor (${NAMA_SISI_RUANG[g.sisi]}).`
    });
    return langkah;
  }

  /* Titik-titik rute sesuai titik awal yang dipilih */
  function buatRute(urut, asal) {
    if (asal === "kiri" || asal === "kanan") return hitungRuteDariPojok(urut, asal).points;
    return buildRoutePoints(urut);
  }

  /* Susun langkah-langkah Petunjuk Arah sesuai jalur koridor atas/bawah */
  function arahTimeline(kodeRuang) {
    const urut = kodeRuang % 100;
    const g = getRoomGeometry(urut);
    const arahUtama = g.kiri ? "kiri" : "kanan";
    const panahHorizontal = g.kiri ? "←" : "→";

    // Ruangan di koridor samping kiri (07-14) atau kanan (27-34)
    if (g.sisi === "samping-kiri" || g.sisi === "samping-kanan") {
      const viaAtas = g.via === "atas";
      const arahLobi = viaAtas ? "utara (atas)" : "selatan (bawah)";
      const panahKeluar = viaAtas ? "↑" : "↓";
      const panahBelok = viaAtas ? "↓" : "↑";
      const tangan = g.kiri
        ? (viaAtas ? "kanan" : "kiri")
        : (viaAtas ? "kiri" : "kanan");

      return [
        {
          icon: panahKeluar,
          judul: "Keluar dari lift",
          desc: `Menuju lobi ${arahLobi} lalu ambil koridor arah ${arahUtama}.`
        },
        {
          icon: panahHorizontal,
          judul: `Lurus di koridor ${viaAtas ? "atas" : "bawah"}`,
          desc: `Ikuti koridor ke arah ${arahUtama} hingga mendekati tangga pojok.`
        },
        {
          icon: panahBelok,
          judul: `Belok ke koridor samping ${arahUtama}`,
          desc: g.lewat > 0
            ? `Masuk ke koridor sisi ${arahUtama} dan lewati ${g.lewat} ruangan.`
            : `Masuk ke koridor sisi ${arahUtama} (ruangan pertama di dekat tangga).`
        },
        {
          icon: "◎",
          isTarget: true,
          judul: `Ruang ${kodeRuang}`,
          desc: `Berada di sisi ${tangan} Anda pada koridor samping ${arahUtama}.`
        }
      ];
    }

    // Ruangan di koridor atas (01-06, 21-26) atau bawah (15-20, 35-40)
    const viaAtas = g.via === "atas";
    const koridorPos = viaAtas ? "atas" : "bawah";
    const panahKeluar = viaAtas ? "↑" : "↓";
    const tangan = viaAtas
      ? (g.kiri ? "kanan" : "kiri")
      : (g.kiri ? "kiri" : "kanan");

    return [
      {
        icon: panahKeluar,
        judul: "Keluar dari lift",
        desc: `Menuju lobi ${koridorPos} lalu belok ${arahUtama}.`
      },
      {
        icon: panahHorizontal,
        judul: g.lewat > 0 ? `Lurus, lewati ${g.lewat} ruangan` : "Lurus sedikit saja",
        desc: g.lewat > 0
          ? `Ikuti koridor ${koridorPos} ke arah ${arahUtama} dan lewati ${g.lewat} ruangan.`
          : `Ruangan berada persis di sebelah lobi lift.`
      },
      {
        icon: panahHorizontal,
        judul: "Perhatikan plang nomor ruangan",
        desc: `Cari pintu Ruang ${kodeRuang} di sisi ${tangan} koridor.`
      },
      {
        icon: "◎",
        isTarget: true,
        judul: `Ruang ${kodeRuang}`,
        desc: `Berada di koridor ${koridorPos} sisi ${arahUtama}.`
      }
    ];
  }

  /* Render SVG Denah Lantai secara lengkap (Tanpa 4 kotak tengah) */
  function gambarDenah() {
    const svg = $("denah");
    if (!svg) return;

    const lantai = state.lantai;
    const judulEl = $("judulLantai");
    const subEl = $("ketLantai");
    if (judulEl) judulEl.textContent = `Denah Lantai ${lantai}`;
    if (subEl) subEl.textContent = GKU.keteranganLantai[lantai] || "Gedung Kuliah Umum";

    // Helper menggambar tangga pojok dengan garis anak tangga
    function renderStair(x, y, w, h) {
      let lines = "";
      for (let ly = y + 10; ly < y + h - 4; ly += 8) {
        lines += `<line x1="${x + 8}" y1="${ly}" x2="${x + w - 8}" y2="${ly}" stroke="var(--stair-step)" stroke-width="2" opacity="0.75"/>`;
      }
      return `
        <g class="stair-group">
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" class="svg-stair-box"/>
          ${lines}
        </g>
      `;
    }

    // Helper panah kecil petunjuk koridor abu-abu
    function renderGuideArrow(x1, y1, x2, y2) {
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="var(--arrow-guide)" stroke-width="1.3" marker-end="url(#guideArrowHead)" opacity="0.75"/>`;
    }

    // Badge WC di pojok bingkai gedung
    function renderWC(x, y, jenis) {
      const nama = jenis === "pria" ? "Toilet Pria" : "Toilet Wanita";
      return `
        <g class="wc-badge" role="img" aria-label="${nama}">
          <title>${nama}</title>
          <rect x="${x}" y="${y}" width="46" height="32" rx="4" class="svg-wc-${jenis}"/>
          <text x="${x + 23}" y="${y + 16}" class="svg-wc-text">WC</text>
        </g>
      `;
    }

    // Titik penanda "Anda di sini" (titik biru berdenyut + label) di dalam kotak lift
    function renderPosisiAnda(cx, cy, labelY, lebar, kecil) {
      const r = kecil ? 5.5 : 9.5;
      const tinggi = kecil ? 14 : 20;
      return `
        <circle cx="${cx}" cy="${cy}" r="${kecil ? 9 : 14}" class="you-pulse" style="transform-origin:${cx}px ${cy}px"/>
        <circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--you-fill)" stroke="#ffffff" stroke-width="${kecil ? 2 : 3}"/>
        <rect x="${cx - lebar / 2}" y="${labelY}" width="${lebar}" height="${tinggi}" rx="4" fill="#0f172a" stroke="#334155" stroke-width="1"/>
        <text x="${cx}" y="${labelY + (kecil ? 10 : 14)}" fill="#ffffff" font-family="Inter, sans-serif" font-size="${kecil ? 8 : 9.5}" font-weight="600" text-anchor="middle">Anda di sini</text>
      `;
    }

    // Satu kotak lift yang bisa diklik untuk memilih titik awal
    function renderLift(kunci, x, y, w, h) {
      const aktif = state.asal === kunci;
      const cx = x + w / 2;
      const cy = kunci === "tengah" ? 282 : y + 29;
      const pusat = kunci === "tengah"
        ? renderPosisiAnda(cx, cy, 304, 68)
        : renderPosisiAnda(cx, cy, y + h - 19, 54, true);
      return `
        <g class="lift-pick ${aktif ? "active" : ""}" data-asal="${kunci}" role="button" tabindex="0"
           aria-pressed="${aktif}" aria-label="Mulai dari ${ASAL[kunci].label}">
          <title>${ASAL[kunci].label} – ${ASAL[kunci].sub}</title>
          <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="9" fill="var(--lift-fill)" stroke="var(--lift-stroke)" stroke-width="1.5"/>
          <text x="${cx}" y="${y + (kunci === "tengah" ? 31 : 15)}" fill="#ffffff" font-family="Inter, sans-serif" font-size="${kunci === "tengah" ? 13 : 9.5}" font-weight="700" text-anchor="middle" letter-spacing="0.06em">LIFT</text>
          ${aktif ? pusat : `<circle cx="${cx}" cy="${cy}" r="${kunci === "tengah" ? 10 : 7}" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.7"/><circle cx="${cx}" cy="${cy}" r="${kunci === "tengah" ? 3.5 : 2.5}" fill="#ffffff" opacity="0.7"/>`}
        </g>
      `;
    }

    // Bangun elemen ruangan 01..40
    let roomsMarkup = "";
    for (let u = 1; u <= GKU.ruangPerLantai; u++) {
      const kode = lantai * 100 + u;
      const g = getRoomGeometry(u);
      const isSelected = state.ruang === kode;
      const namaKhusus = GKU.namaRuang[String(kode)] || `Ruang ${kode}`;
      roomsMarkup += `
        <g class="room-group ${isSelected ? "selected" : ""}" data-room="${kode}" role="button" tabindex="0" aria-label="${namaKhusus}">
          <title>${namaKhusus} (Lantai ${lantai})</title>
          <rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" class="room-rect"/>
          <text x="${g.cx}" y="${g.cy}" class="room-label">${kode}</text>
        </g>
      `;
    }

    // Bangun jalur rute merah putus-putus + pin tujuan jika ada ruangan terpilih di lantai ini
    let routeMarkup = "";
    if (state.ruang && Math.floor(state.ruang / 100) === lantai) {
      const urut = state.ruang % 100;
      const g = getRoomGeometry(urut);
      const pts = buatRute(urut, state.asal);
      const ptsStr = pts.map((p) => `${p[0]},${p[1]}`).join(" ");

      // Panah arah merah di koridor utama (atas atau bawah)
      const arrowY = g.via === "atas" ? 128 : 432;
      const midArrowDir = g.kiri
        ? `M 316,${arrowY - 6} L 304,${arrowY} L 316,${arrowY + 6} Z`
        : `M 684,${arrowY - 6} L 696,${arrowY} L 684,${arrowY + 6} Z`;
      const showMidArrow = state.asal === "tengah" && (g.sisi === "samping-kiri" || g.sisi === "samping-kanan" || g.lewat >= 2);

      routeMarkup = `
        <g class="route-layer">
          <polyline points="${ptsStr}" class="route-path"/>
          ${showMidArrow ? `<path d="${midArrowDir}" fill="var(--sel-fill)"/>` : ""}
          <circle cx="${g.doorX}" cy="${g.doorY}" r="5.5" fill="var(--sel-fill)" stroke="#ffffff" stroke-width="2"/>
          <!-- Pin Merah Tujuan -->
          <g transform="translate(${g.doorX}, ${g.doorY - 6})">
            <path d="M0 -24 C-7 -24 -12 -19 -12 -12 C-12 -4 0 4 0 4 C0 4 12 -4 12 -12 C12 -19 7 -24 0 -24 Z" fill="var(--sel-fill)" stroke="#ffffff" stroke-width="1.5"/>
            <circle cx="0" cy="-13" r="4" fill="#ffffff"/>
          </g>
        </g>
      `;
    }

    svg.innerHTML = `
      <defs>
        <marker id="guideArrowHead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0.5 L5,3 L0,5.5 Z" fill="var(--arrow-guide)"/>
        </marker>
        <filter id="liftShadow" x="-15%" y="-15%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.25"/>
        </filter>
      </defs>

      <!-- Bingkai Gedung Luar -->
      <rect x="42" y="22" width="916" height="516" rx="16" class="svg-outer-border"/>
      <rect x="48" y="28" width="904" height="504" rx="12" fill="none" stroke="var(--room-stroke)" stroke-width="1"/>

      <!-- Area Lobi Lift Tengah -->
      <rect x="445" y="30" width="110" height="500" class="svg-lobi-zone"/>
      <text x="500" y="68" class="svg-lobi-label">LOBI LIFT</text>

      <!-- Garis Panah Panduan Koridor -->
      ${renderGuideArrow(395, 118, 225, 118)}
      ${renderGuideArrow(395, 138, 225, 138)}
      ${renderGuideArrow(605, 118, 775, 118)}
      ${renderGuideArrow(605, 138, 775, 138)}
      ${renderGuideArrow(395, 422, 225, 422)}
      ${renderGuideArrow(395, 442, 225, 442)}
      ${renderGuideArrow(605, 422, 775, 422)}
      ${renderGuideArrow(605, 442, 775, 442)}
      ${renderGuideArrow(174, 165, 174, 390)}
      ${renderGuideArrow(826, 165, 826, 390)}

      <!-- 4 Tangga Pojok -->
      ${renderStair(50, 30, 95, 70)}
      ${renderStair(855, 30, 95, 70)}
      ${renderStair(50, 460, 95, 70)}
      ${renderStair(855, 460, 95, 70)}

      <!-- Toilet di 4 pojok: biru = pria (atas), merah muda = wanita (bawah) -->
      ${renderWC(4, 14, "pria")}
      ${renderWC(950, 14, "pria")}
      ${renderWC(4, 514, "wanita")}
      ${renderWC(950, 514, "wanita")}

      <!-- Label rentang nomor ruangan -->
      <text x="290" y="288" class="svg-zone-label">← ${lantai * 100 + 1}-${lantai * 100 + 20}</text>
      <text x="710" y="288" class="svg-zone-label">${lantai * 100 + 21}-${lantai * 100 + 40} →</text>

      <!-- 40 Ruangan Lantai Ini -->
      ${roomsMarkup}

      <!-- Rute dari Lift ke Ruangan Tujuan -->
      ${routeMarkup}

      <!-- Tiga lift: tengah, dan dua lift pojok bawah (samping WC wanita) -->
      <g filter="url(#liftShadow)">
        ${renderLift("tengah", 462, 205, 76, 136)}
      </g>
      ${renderLift("kiri", 66.5, 464, 62, 58)}
      ${renderLift("kanan", 871.5, 464, 62, 58)}
    `;

    // Klik lift = pilih titik awal
    svg.querySelectorAll(".lift-pick").forEach((node) => {
      const pilih = () => setAsal(node.getAttribute("data-asal"));
      node.addEventListener("click", pilih);
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pilih(); }
      });
    });

    // Pasang event listener klik pada setiap ruangan di SVG
    svg.querySelectorAll(".room-group").forEach((node) => {
      node.addEventListener("click", () => {
        const kode = parseInt(node.getAttribute("data-room"), 10);
        pilihRuang(kode);
      });
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          const kode = parseInt(node.getAttribute("data-room"), 10);
          pilihRuang(kode);
        }
      });
    });
  }

  /* Render Panel Petunjuk Arah */
  function tampilPanel() {
    const pContent = $("panelContent");
    if (!pContent) return;

    if (!state.ruang) {
      pContent.innerHTML = `
        <div class="not-found-box" style="padding: 36px 12px;">
          <svg viewBox="0 0 64 64" fill="none">
            <ellipse cx="32" cy="54" rx="18" ry="4" fill="#e2e8f0"/>
            <circle cx="28" cy="26" r="14" stroke="#94a3b8" stroke-width="4" fill="#f8fafc"/>
            <line x1="38" y1="36" x2="50" y2="48" stroke="#94a3b8" stroke-width="4" stroke-linecap="round"/>
          </svg>
          <h4>Belum Ada Ruangan Dipilih</h4>
          <p>Klik salah satu ruangan pada denah atau gunakan kotak pencarian di atas untuk menampilkan rute dari lift.</p>
        </div>
      `;
      return;
    }

    const kode = state.ruang;
    const lantai = Math.floor(kode / 100);
    const namaKhusus = GKU.namaRuang[String(kode)];
    const labelRuang = namaKhusus && namaKhusus !== `Ruang ${kode}`
      ? `Ruang ${kode} (${namaKhusus})`
      : `Ruang ${kode}`;

    const langkahRute = state.asal === "tengah" ? arahTimeline(kode) : arahTimelineDariPojok(kode, state.asal);
    const timelineHtml = langkahRute.map((step, idx) => `
      <div class="tl-item">
        <div class="tl-badge">${idx + 1}</div>
        <div class="tl-dir-icon ${step.isTarget ? "target-ring" : ""}">${step.icon}</div>
        <div class="tl-content">
          <h4>${step.judul}</h4>
          <p>${step.desc}</p>
        </div>
      </div>
    `).join("");

    pContent.innerHTML = `
      <div class="dest-card">
        <div class="dest-pin-wrap">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
          </svg>
        </div>
        <div class="dest-meta">
          <div class="meta-label">Tujuan</div>
          <div class="meta-title">${labelRuang}</div>
          <div class="meta-sub">Lantai ${lantai}</div>
        </div>
        <button type="button" id="btnFavorit" class="fav-btn" aria-pressed="${adaFavorit(kode)}"
                aria-label="Simpan Ruang ${kode} ke favorit" title="Simpan ke favorit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">
            <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/>
          </svg>
        </button>
      </div>

      <div class="origin-row">
        <div class="origin-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="8"/>
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
          </svg>
        </div>
        <div class="origin-text">
          <div class="meta-label">Mulai dari</div>
          <div class="meta-title">${ASAL[state.asal].label}</div>
          <div class="meta-sub">${ASAL[state.asal].sub} • Lantai ${lantai}</div>
          <div class="origin-switch" role="radiogroup" aria-label="Pilih titik awal">
            ${["kiri", "tengah", "kanan"].map((k) => `
              <button type="button" role="radio" class="origin-chip ${state.asal === k ? "active" : ""}"
                      data-asal="${k}" aria-checked="${state.asal === k}">${ASAL[k].label.replace("Lift ", "")}</button>
            `).join("")}
          </div>
          <div class="origin-hint">Datang lewat lift samping WC wanita? Pilih Kiri-Bawah atau Kanan-Bawah.</div>
        </div>
      </div>

      <div class="timeline">
        ${timelineHtml}
      </div>

      <button type="button" id="btnCariLain" class="btn primary-btn cari-lain-btn">
        Cari Ruangan Lain
      </button>
    `;

    pContent.querySelectorAll(".origin-chip").forEach((chip) => {
      chip.addEventListener("click", () => setAsal(chip.getAttribute("data-asal")));
    });

    const btnFavorit = $("btnFavorit");
    if (btnFavorit) btnFavorit.addEventListener("click", () => toggleFavorit(kode));

    const btnCariLain = $("btnCariLain");
    if (btnCariLain) {
      btnCariLain.addEventListener("click", () => {
        const input = $("q");
        if (input) {
          input.focus();
          input.select();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    }
  }

  /* Render Tab Pilihan Lantai 1..10 */
  function renderTabs() {
    const nav = $("tabLantai");
    if (!nav) return;
    nav.innerHTML = "";
    for (let l = 1; l <= GKU.jumlahLantai; l++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tab";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(l === state.lantai));
      btn.textContent = `Lantai ${l}`;
      btn.addEventListener("click", () => {
        pilihLantai(l, true);
      });
      nav.appendChild(btn);
    }
  }

  /* Ganti titik awal rute (lift tengah / lift pojok kiri / lift pojok kanan) */
  function setAsal(asal) {
    if (!asalValid(asal) || asal === state.asal) return;
    state.asal = asal;
    gambarDenah();
    tampilPanel();
    showToast(`Titik awal: ${ASAL[asal].label}`);
  }

  /* Pilih Lantai */
  function pilihLantai(lantaiBaru, pilihDefaultRuang) {
    state.lantai = lantaiBaru;
    if (pilihDefaultRuang) {
      if (!state.ruang || Math.floor(state.ruang / 100) !== lantaiBaru) {
        state.ruang = lantaiBaru * 100 + 9;
      }
    }
    renderTabs();
    gambarDenah();
    tampilPanel();
    updateChipHighlight();
  }

  /* Pilih Ruangan Tertentu */
  function pilihRuang(kodeRuang, catat = true) {
    const valid = parseKodeRuang(kodeRuang);
    if (!valid) return false;
    if (catat) catatRiwayat(kodeRuang);
    state.lantai = valid.lantai;
    state.ruang = kodeRuang;
    renderTabs();
    gambarDenah();
    tampilPanel();
    updateChipHighlight();
    return true;
  }

  /* ---------- Riwayat Pencarian ---------- */
  function catatRiwayat(kode) {
    state.riwayat = [kode, ...state.riwayat.filter((k) => k !== kode)].slice(0, MAKS_RIWAYAT);
    simpanDaftar(KUNCI_RIWAYAT, state.riwayat);
    renderRiwayat();
  }

  /* ---------- Ruangan Favorit ---------- */
  function adaFavorit(kode) {
    return state.favorit.includes(kode);
  }

  function toggleFavorit(kode) {
    if (adaFavorit(kode)) {
      state.favorit = state.favorit.filter((k) => k !== kode);
      showToast(`Ruang ${kode} dihapus dari favorit`);
    } else {
      if (state.favorit.length >= MAKS_FAVORIT) {
        showToast(`Favorit penuh (maks. ${MAKS_FAVORIT}). Hapus salah satu dulu.`);
        return;
      }
      state.favorit = [kode, ...state.favorit];
      showToast(`Ruang ${kode} disimpan ke favorit`);
    }
    simpanDaftar(KUNCI_FAVORIT, state.favorit);
    renderFavorit();
    const btn = $("btnFavorit");
    if (btn) btn.setAttribute("aria-pressed", String(adaFavorit(kode)));
  }

  /* Render satu daftar tersimpan (dipakai kartu Riwayat dan Favorit) */
  function renderDaftarTersimpan(elId, daftar, kosongJudul, kosongTeks, onHapus) {
    const el = $(elId);
    if (!el) return;
    if (daftar.length === 0) {
      el.innerHTML = `<div class="saved-empty"><strong>${kosongJudul}</strong>${kosongTeks}</div>`;
      return;
    }
    el.innerHTML = daftar.map((kode) => {
      const item = buatHasil(kode, 0);
      return `
        <div class="saved-item">
          <button type="button" class="search-result-item ${kode === state.ruang ? "active" : ""}" data-room="${kode}">
            <svg class="res-pin" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
            </svg>
            <div>
              <span class="res-title">${item.judul}</span>
              <span class="res-sub">${item.sub}</span>
            </div>
          </button>
          <button type="button" class="saved-remove" data-hapus="${kode}" aria-label="Hapus Ruang ${kode}" title="Hapus">&times;</button>
        </div>`;
    }).join("");

    el.querySelectorAll(".search-result-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kode = parseInt(btn.getAttribute("data-room"), 10);
        pilihRuang(kode);
        window.scrollTo({ top: 0, behavior: "smooth" });
        showToast(`Menampilkan rute ke Ruang ${kode} (Lantai ${Math.floor(kode / 100)})`);
      });
    });
    el.querySelectorAll(".saved-remove").forEach((btn) => {
      btn.addEventListener("click", () => onHapus(parseInt(btn.getAttribute("data-hapus"), 10)));
    });
  }

  function renderRiwayat() {
    renderDaftarTersimpan(
      "riwayatList", state.riwayat,
      "Belum ada riwayat",
      "Ruangan yang kamu cari atau klik akan muncul di sini.",
      (kode) => {
        state.riwayat = state.riwayat.filter((k) => k !== kode);
        simpanDaftar(KUNCI_RIWAYAT, state.riwayat);
        renderRiwayat();
      }
    );
    const btn = $("btnHapusRiwayat");
    if (btn) btn.hidden = state.riwayat.length === 0;
  }

  function renderFavorit() {
    renderDaftarTersimpan(
      "favoritList", state.favorit,
      "Belum ada favorit",
      "Tekan ikon bintang di kartu tujuan untuk menyimpan ruangan yang sering kamu datangi.",
      (kode) => {
        state.favorit = state.favorit.filter((k) => k !== kode);
        simpanDaftar(KUNCI_FAVORIT, state.favorit);
        renderFavorit();
        const btn = $("btnFavorit");
        if (btn && state.ruang === kode) btn.setAttribute("aria-pressed", "false");
      }
    );
    const btn = $("btnHapusFavorit");
    if (btn) btn.hidden = state.favorit.length === 0;
  }

  /* Highlight chip pencarian populer yang aktif */
  function updateChipHighlight() {
    document.querySelectorAll(".saved-list .search-result-item").forEach((btn) => {
      btn.classList.toggle("active", parseInt(btn.getAttribute("data-room"), 10) === state.ruang);
    });
    document.querySelectorAll(".chip[data-room]").forEach((chip) => {
      const r = parseInt(chip.getAttribute("data-room"), 10);
      chip.classList.toggle("active", r === state.ruang);
    });
  }

  /* Normalisasi teks pencarian: huruf kecil, spasi ganda dirapikan,
     dan awalan "ruang"/"r" dibuang supaya "Ruang 909", "r909", "909" sama. */
  function normalisasi(teks) {
    return String(teks || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function labelRuang(kode) {
    return GKU.namaRuang[String(kode)] || `Ruang ${kode}`;
  }

  function buatHasil(kode, prioritas) {
    const lantai = Math.floor(kode / 100);
    const nama = GKU.namaRuang[String(kode)];
    const adaNama = nama && nama !== `Ruang ${kode}`;
    return {
      kode,
      lantai,
      judul: adaNama && !nama.startsWith("Ruang Kelas") ? nama : `Ruang ${kode}`,
      sub: adaNama ? `Lantai ${lantai} • ${nama}` : `Lantai ${lantai}`,
      prioritas
    };
  }

  /* Sistem Pencarian Ruangan (nomor & nama).
     - Tidak peduli huruf besar/kecil dan spasi ganda.
     - Kata kunci banyak kata dicocokkan tanpa peduli urutan ("lab komputer" = "komputer lab").
     - Jika query persis sebuah nomor ruangan, ruangan di sebelahnya ikut disarankan. */
  function cariDaftarRuangan(rawQuery) {
    const q = normalisasi(rawQuery).replace(/^(ruang|r)\s*(?=\d)/, "");
    if (!q) return [];
    const tokens = q.split(" ");

    const hasil = [];
    for (let l = 1; l <= GKU.jumlahLantai; l++) {
      for (let u = 1; u <= GKU.ruangPerLantai; u++) {
        const kode = l * 100 + u;
        const kodeStr = String(kode);
        const nama = normalisasi(labelRuang(kode));
        const target = `${kodeStr} ${nama}`;

        if (!tokens.every((t) => target.includes(t))) continue;

        let prioritas = 3;
        if (kodeStr === q || nama === q) prioritas = 0;
        else if (kodeStr.startsWith(q)) prioritas = 1;
        else if (GKU.namaRuang[kodeStr] && nama.includes(q)) prioritas = 2;
        hasil.push(buatHasil(kode, prioritas));
      }
    }

    hasil.sort((a, b) => a.prioritas - b.prioritas || a.kode - b.kode);
    const unggulan = hasil.slice(0, 6);

    // Query = nomor ruangan persis: tambahkan ruangan di kiri/kanannya sebagai saran.
    const persis = parseKodeRuang(q);
    if (persis && /^\d+$/.test(q)) {
      const kode = parseInt(q, 10);
      [kode - 1, kode + 1].forEach((tetangga) => {
        if (parseKodeRuang(tetangga) && !unggulan.some((h) => h.kode === tetangga)) {
          unggulan.push(buatHasil(tetangga, 1));
        }
      });
    }
    return unggulan.slice(0, 6);
  }

  /* Render Dropdown Hasil Pencarian / State Tidak Ditemukan */
  function updateSearchDropdown(queryText) {
    const dd = $("searchDropdown");
    const listEl = $("searchResultsList");
    const titleEl = $("dropdownHeaderTitle");
    if (!dd || !listEl) return;

    const trimmed = (queryText || "").trim();
    if (!trimmed) {
      dd.classList.remove("open");
      return;
    }

    const matches = cariDaftarRuangan(trimmed);
    dd.classList.add("open");

    if (matches.length === 0) {
      if (titleEl) titleEl.textContent = "Ruangan Tidak Ditemukan";
      listEl.innerHTML = `
        <div class="not-found-box">
          <svg viewBox="0 0 80 80" fill="none">
            <ellipse cx="40" cy="68" rx="24" ry="5" fill="#e2e8f0"/>
            <circle cx="36" cy="34" r="16" stroke="#94a3b8" stroke-width="4.5" fill="#f8fafc"/>
            <line x1="48" y1="46" x2="62" y2="60" stroke="#94a3b8" stroke-width="5" stroke-linecap="round"/>
          </svg>
          <h4>Ruangan Tidak Ditemukan</h4>
          <p>Coba gunakan nomor ruangan yang benar atau pilih dari daftar saran.</p>
        </div>
      `;
      return;
    }

    if (titleEl) titleEl.textContent = "Hasil Pencarian";
    listEl.innerHTML = matches.map((item, idx) => `
      <button type="button" class="search-result-item ${idx === 0 ? "active" : ""}" data-room="${item.kode}">
        <svg class="res-pin" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 0 1 0-5 2.5 2.5 0 0 1 0 5z"/>
        </svg>
        <div>
          <span class="res-title">${item.judul}</span>
          <span class="res-sub">Lantai ${item.lantai}</span>
        </div>
      </button>
    `).join("");

    listEl.querySelectorAll(".search-result-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const kode = parseInt(btn.getAttribute("data-room"), 10);
        pilihRuang(kode);
        dd.classList.remove("open");
        showToast(`Menampilkan rute ke Ruang ${kode} (Lantai ${Math.floor(kode / 100)})`);
      });
    });
  }

  /* Zoom & Kontrol Peta */
  function setMapZoom(newZoom) {
    state.zoom = Math.max(0.75, Math.min(2.2, Number(newZoom.toFixed(2))));
    const svg = $("denah");
    if (svg) {
      svg.style.transform = `scale(${state.zoom})`;
    }
  }

  /* Toggle Dark Mode */
  function toggleDarkMode(forceValue) {
    state.darkMode = typeof forceValue === "boolean" ? forceValue : !state.darkMode;
    document.body.classList.toggle("dark-mode", state.darkMode);
    const label = $("themeBtnLabel");
    if (label) {
      label.textContent = state.darkMode ? "Light Mode" : "Dark Mode";
    }
  }

  /* Tampilkan Toast Notifikasi */
  let toastTimer = null;
  function showToast(msg) {
    const t = $("toastMsg");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove("show");
    }, 2600);
  }

  /* Buat & Tampilkan Modal QR Code */
  function bukaModalQR() {
    const modal = $("qrModalBackdrop");
    const qrBox = $("qrBox");
    const qrUrlEl = $("qrUrl");
    if (!modal || !qrBox || !qrUrlEl) return;

    const url = buatUrlDenah();
    qrUrlEl.textContent = url;
    qrBox.innerHTML = "";

    if (typeof window.QRCode === "function") {
      new window.QRCode(qrBox, {
        text: url,
        width: 142,
        height: 142,
        colorDark: "#0f172a",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.H
      });
    } else {
      qrBox.innerHTML = renderFallbackQrSvg();
    }

    modal.classList.add("open");
  }

  function renderFallbackQrSvg() {
    return `
      <svg width="142" height="142" viewBox="0 0 120 120" fill="#0f172a">
        <rect width="120" height="120" fill="#ffffff"/>
        <path d="M8,8 h32 v32 h-32 z M14,14 v20 h20 v-20 z M20,20 h8 v8 h-8 z"/>
        <path d="M80,8 h32 v32 h-32 z M86,14 v20 h20 v-20 z M92,20 h8 v8 h-8 z"/>
        <path d="M8,80 h32 v32 h-32 z M14,86 v20 h20 v-20 z M20,92 h8 v8 h-8 z"/>
        <rect x="48" y="10" width="8" height="8"/><rect x="62" y="10" width="8" height="16"/>
        <rect x="48" y="26" width="10" height="8"/><rect x="12" y="48" width="16" height="8"/>
        <rect x="34" y="48" width="8" height="14"/><rect x="76" y="48" width="12" height="8"/>
        <rect x="96" y="48" width="14" height="14"/><rect x="48" y="78" width="14" height="8"/>
        <rect x="70" y="74" width="8" height="18"/><rect x="86" y="84" width="18" height="8"/>
        <rect x="82" y="98" width="12" height="12"/><rect x="52" y="96" width="12" height="14"/>
      </svg>
    `;
  }

  /* Salin Teks ke Clipboard (Aman untuk Sandbox Iframe) */
  function salinKeClipboard(teks) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(teks).then(() => {
        showToast("Link denah berhasil disalin!");
      }).catch(() => {
        fallbackCopy(teks);
      });
    } else {
      fallbackCopy(teks);
    }
  }

  function fallbackCopy(teks) {
    const ta = document.createElement("textarea");
    ta.value = teks;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      showToast("Link denah berhasil disalin!");
    } catch (err) {
      showToast("Salin manual: " + teks);
    }
    document.body.removeChild(ta);
  }

  /* Download QR Code sebagai Gambar PNG */
  function downloadQRImage() {
    const qrBox = $("qrBox");
    if (!qrBox) return;
    const canvas = qrBox.querySelector("canvas");
    const img = qrBox.querySelector("img");
    let dataUrl = "";
    if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
    } else if (img && img.src) {
      dataUrl = img.src;
    }
    if (dataUrl) {
      const a = document.createElement("a");
      a.href = dataUrl;
      const akhiran = state.asal !== "tengah" ? `-dari-${state.asal}` : "";
      a.download = state.ruang
        ? `QR-GKU-Ruang-${state.ruang}${akhiran}.png`
        : `QR-GKU-Lantai-${state.lantai}${akhiran}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("QR Code berhasil diunduh!");
    } else {
      showToast("QR Code siap disimpan.");
    }
  }

  /* Inisialisasi Seluruh Event Listener */
  function initEvents() {
    const formCari = $("formCari");
    const inputQ = $("q");
    const btnClear = $("btnClearSearch");
    const dd = $("searchDropdown");

    if (inputQ) {
      inputQ.addEventListener("input", () => {
        updateSearchDropdown(inputQ.value);
      });
      inputQ.addEventListener("focus", () => {
        if (inputQ.value.trim()) {
          updateSearchDropdown(inputQ.value);
        }
      });
    }

    if (btnClear && inputQ) {
      btnClear.addEventListener("click", () => {
        inputQ.value = "";
        if (dd) dd.classList.remove("open");
        inputQ.focus();
      });
    }

    if (formCari && inputQ) {
      formCari.addEventListener("submit", (e) => {
        e.preventDefault();
        const qVal = inputQ.value.trim();
        if (!qVal) return;
        const matches = cariDaftarRuangan(qVal);
        if (matches.length > 0) {
          pilihRuang(matches[0].kode);
          if (dd) dd.classList.remove("open");
          showToast(`Menampilkan rute ke ${matches[0].judul} (Lantai ${matches[0].lantai})`);
        } else {
          updateSearchDropdown(qVal);
        }
      });
    }

    // Tutup dropdown saat klik di luar area pencarian
    document.addEventListener("click", (e) => {
      const searchSec = document.querySelector(".search-section");
      if (dd && searchSec && !searchSec.contains(e.target)) {
        dd.classList.remove("open");
      }
    });

    // Chip Pencarian Populer
    document.querySelectorAll(".chip[data-room]").forEach((chip) => {
      chip.addEventListener("click", () => {
        const kode = parseInt(chip.getAttribute("data-room"), 10);
        const label = chip.getAttribute("data-query") || String(kode);
        if (inputQ) inputQ.value = label;
        if (dd) dd.classList.remove("open");
        pilihRuang(kode);
        showToast(`Menampilkan rute ke Ruang ${kode}`);
      });
    });

    // Tombol Scroll Tab Lantai Kiri & Kanan
    const navTabs = $("tabLantai");
    const btnLeft = $("scrollLeftBtn");
    const btnRight = $("scrollRightBtn");
    if (btnLeft && navTabs) {
      btnLeft.addEventListener("click", () => {
        if (state.lantai > 1) pilihLantai(state.lantai - 1, true);
        navTabs.scrollBy({ left: -160, behavior: "smooth" });
      });
    }
    if (btnRight && navTabs) {
      btnRight.addEventListener("click", () => {
        if (state.lantai < GKU.jumlahLantai) pilihLantai(state.lantai + 1, true);
        navTabs.scrollBy({ left: 160, behavior: "smooth" });
      });
    }

    // Kontrol Peta (+, -, Fullscreen, Reset Lokasi)
    const btnZoomIn = $("btnZoomIn");
    const btnZoomOut = $("btnZoomOut");
    const btnFullscreen = $("btnFullscreen");
    const btnCenterMap = $("btnCenterMap");
    if (btnZoomIn) btnZoomIn.addEventListener("click", () => setMapZoom(state.zoom + 0.2));
    if (btnZoomOut) btnZoomOut.addEventListener("click", () => setMapZoom(state.zoom - 0.2));
    if (btnCenterMap) {
      btnCenterMap.addEventListener("click", () => {
        setMapZoom(1);
        showToast("Posisi peta dikembalikan ke tengah (Lobi Lift)");
      });
    }
    if (btnFullscreen) {
      btnFullscreen.addEventListener("click", () => {
        const mapCard = $("mapContainerBox");
        if (mapCard && mapCard.requestFullscreen) {
          if (!document.fullscreenElement) {
            mapCard.requestFullscreen().catch(() => {
              showToast("Mode layar penuh diaktifkan");
            });
          } else {
            document.exitFullscreen();
          }
        } else {
          showToast("Gunakan tombol + / - untuk memperbesar denah");
        }
      });
    }

    // Tombol Reset & Back di Panel Petunjuk Arah
    const btnResetRoute = $("btnResetRoute");
    const btnBackPanel = $("btnBackPanel");
    if (btnResetRoute) {
      btnResetRoute.addEventListener("click", () => {
        state.ruang = null;
        if (inputQ) inputQ.value = "";
        gambarDenah();
        tampilPanel();
        updateChipHighlight();
        showToast("Rute direset. Silakan pilih ruangan pada denah.");
      });
    }
    if (btnBackPanel) {
      btnBackPanel.addEventListener("click", () => {
        pilihRuang(state.lantai * 100 + 9, false);
      });
    }

    // Tombol Dark Mode
    const btnTheme = $("btnTheme");
    const showcaseDarkCard = $("showcaseDarkCard");
    if (btnTheme) {
      btnTheme.addEventListener("click", () => toggleDarkMode());
    }
    if (showcaseDarkCard) {
      showcaseDarkCard.addEventListener("click", () => {
        toggleDarkMode();
        window.scrollTo({ top: 0, behavior: "smooth" });
        showToast(state.darkMode ? "Dark Mode diaktifkan" : "Light Mode diaktifkan");
      });
    }

    // Hapus semua riwayat / favorit
    const btnHapusRiwayat = $("btnHapusRiwayat");
    const btnHapusFavorit = $("btnHapusFavorit");
    if (btnHapusRiwayat) {
      btnHapusRiwayat.addEventListener("click", () => {
        state.riwayat = [];
        simpanDaftar(KUNCI_RIWAYAT, state.riwayat);
        renderRiwayat();
        showToast("Riwayat pencarian dihapus");
      });
    }
    if (btnHapusFavorit) {
      btnHapusFavorit.addEventListener("click", () => {
        state.favorit = [];
        simpanDaftar(KUNCI_FAVORIT, state.favorit);
        renderFavorit();
        const btn = $("btnFavorit");
        if (btn) btn.setAttribute("aria-pressed", "false");
        showToast("Semua favorit dihapus");
      });
    }

    // Modal QR Code
    const btnQR = $("btnQR");
    const btnCloseQR = $("btnCloseQR");
    const qrBackdrop = $("qrModalBackdrop");
    const btnCopyUrl = $("btnCopyUrl");
    const btnSalinLink = $("btnSalinLink");
    const btnDownloadQR = $("btnDownloadQR");
    const btnShowcaseCopy = $("btnShowcaseCopy");
    const btnShowcaseDownload = $("btnShowcaseDownload");

    if (btnQR) btnQR.addEventListener("click", bukaModalQR);
    if (btnCloseQR && qrBackdrop) {
      btnCloseQR.addEventListener("click", () => qrBackdrop.classList.remove("open"));
      qrBackdrop.addEventListener("click", (e) => {
        if (e.target === qrBackdrop) qrBackdrop.classList.remove("open");
      });
    }
    if (btnCopyUrl) {
      btnCopyUrl.addEventListener("click", () => {
        const url = $("qrUrl") ? $("qrUrl").textContent : GKU.baseUrl;
        salinKeClipboard(url);
      });
    }
    if (btnSalinLink) {
      btnSalinLink.addEventListener("click", () => {
        const url = $("qrUrl") ? $("qrUrl").textContent : GKU.baseUrl;
        salinKeClipboard(url);
      });
    }
    if (btnDownloadQR) {
      btnDownloadQR.addEventListener("click", downloadQRImage);
    }
    if (btnShowcaseCopy) {
      btnShowcaseCopy.addEventListener("click", () => {
        salinKeClipboard(buatUrlDenah());
      });
    }
    if (btnShowcaseDownload) {
      btnShowcaseDownload.addEventListener("click", bukaModalQR);
    }
  }

  /* Jalankan Saat DOM Siap */
  function init() {
    state.riwayat = bacaDaftar(KUNCI_RIWAYAT);
    state.favorit = bacaDaftar(KUNCI_FAVORIT);
    initFromUrl();
    renderTabs();
    gambarDenah();
    tampilPanel();
    updateChipHighlight();
    renderRiwayat();
    renderFavorit();
    initEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();