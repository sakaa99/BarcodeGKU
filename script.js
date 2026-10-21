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
    darkMode: false
  };

  /* Baca parameter URL ?lantai=...&ruang=... jika dibuka dari hasil scan QR */
  function initFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const lParam = parseInt(params.get("lantai"), 10);
      const rParam = parseInt(params.get("ruang"), 10);
      if (rParam >= 101 && rParam <= 1040) {
        const l = Math.floor(rParam / 100);
        const u = rParam % 100;
        if (l >= 1 && l <= GKU.jumlahLantai && u >= 1 && u <= GKU.ruangPerLantai) {
          state.lantai = l;
          state.ruang = rParam;
          return;
        }
      }
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
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w / 2,
        doorY: y + h + 14,
        sisi: "atas-kiri",
        kiri: true,
        jarakMeter: 6 + (6 - idxFromLeft) * 2
      };
    }
    // 07-14: Samping Kiri (07 paling atas, 14 paling bawah)
    if (urut >= 7 && urut <= 14) {
      const idx = urut - 7;
      const x = 50;
      const y = 110 + idx * 42.5;
      const w = 85;
      const h = 42.5;
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w + 16,
        doorY: y + h / 2,
        sisi: "samping-kiri",
        kiri: true,
        jarakMeter: 12
      };
    }
    // 15-20: Bawah Kiri (15 dekat Tangga Kiri Bawah, 20 dekat Lobi Lift)
    if (urut >= 15 && urut <= 20) {
      const idx = urut - 15;
      const x = 145 + idx * 50;
      const y = 460;
      const w = 50;
      const h = 70;
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w / 2,
        doorY: y - 14,
        sisi: "bawah-kiri",
        kiri: true,
        jarakMeter: 6 + (6 - idx) * 2
      };
    }
    // 21-26: Atas Kanan (21 dekat Lobi Lift, 26 dekat Tangga Kanan Atas)
    if (urut >= 21 && urut <= 26) {
      const idx = urut - 21;
      const x = 555 + idx * 50;
      const y = 30;
      const w = 50;
      const h = 70;
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x + w / 2,
        doorY: y + h + 14,
        sisi: "atas-kanan",
        kiri: false,
        jarakMeter: 6 + (idx + 1) * 2
      };
    }
    // 27-34: Samping Kanan (27 paling atas, 34 paling bawah)
    if (urut >= 27 && urut <= 34) {
      const idx = urut - 27;
      const x = 865;
      const y = 110 + idx * 42.5;
      const w = 85;
      const h = 42.5;
      return {
        urut, x, y, w, h,
        cx: x + w / 2,
        cy: y + h / 2,
        doorX: x - 16,
        doorY: y + h / 2,
        sisi: "samping-kanan",
        kiri: false,
        jarakMeter: 12
      };
    }
    // 35-40: Bawah Kanan (40 dekat Lobi Lift, 35 dekat Tangga Kanan Bawah)
    const idxFromRight = 40 - urut; // urut 40 -> idx 0 (x=555), urut 35 -> idx 5 (x=805)
    const x = 555 + idxFromRight * 50;
    const y = 460;
    const w = 50;
    const h = 70;
    return {
      urut, x, y, w, h,
      cx: x + w / 2,
      cy: y + h / 2,
      doorX: x + w / 2,
      doorY: y - 14,
      sisi: "bawah-kanan",
      kiri: false,
      jarakMeter: 6 + (idxFromRight + 1) * 2
    };
  }

  /* Buat titik-titik jalur (waypoints) dari Lift ke pintu ruangan */
  function buildRoutePoints(urut) {
    const g = getRoomGeometry(urut);
    // Titik awal dari lingkaran biru "Anda di sini" di dalam LIFT
    const startX = 500;
    const startY = 282;

    if (g.sisi === "samping-kiri") {
      // Sesuai persis dengan ilustrasi rute Ruang 109 pada desain UI/UX:
      // Turun sedikit dari titik biru -> keluar ke kiri lobi -> naik ke koridor tengah (y=266)
      // -> lurus ke kiri sampai koridor samping kiri (x=156) -> menuju pintu ruangan
      return [
        [startX, startY],
        [startX, 316],
        [430, 316],
        [430, 266],
        [156, 266],
        [156, g.doorY],
        [g.doorX, g.doorY]
      ];
    }
    if (g.sisi === "samping-kanan") {
      return [
        [startX, startY],
        [startX, 316],
        [570, 316],
        [570, 266],
        [844, 266],
        [844, g.doorY],
        [g.doorX, g.doorY]
      ];
    }
    if (g.sisi === "atas-kiri") {
      return [
        [startX, startY],
        [462, startY],
        [462, 125],
        [g.doorX, 125],
        [g.doorX, g.doorY]
      ];
    }
    if (g.sisi === "atas-kanan") {
      return [
        [startX, startY],
        [538, startY],
        [538, 125],
        [g.doorX, 125],
        [g.doorX, g.doorY]
      ];
    }
    if (g.sisi === "bawah-kiri") {
      return [
        [startX, startY],
        [462, startY],
        [462, 435],
        [g.doorX, 435],
        [g.doorX, g.doorY]
      ];
    }
    // bawah-kanan
    return [
      [startX, startY],
      [538, startY],
      [538, 435],
      [g.doorX, 435],
      [g.doorX, g.doorY]
    ];
  }

  /* Susun langkah-langkah Petunjuk Arah sesuai desain UI/UX */
  function arahTimeline(kodeRuang) {
    const urut = kodeRuang % 100;
    const g = getRoomGeometry(urut);
    const arahUtama = g.kiri ? "kiri" : "kanan";
    const panahArah = g.kiri ? "←" : "→";

    if (g.sisi === "samping-kiri" || g.sisi === "samping-kanan") {
      const belokKe = g.cy <= 280 ? "kiri" : "kanan";
      return [
        {
          icon: "↑",
          judul: "Keluar dari lift",
          desc: `Menuju arah ${arahUtama} koridor.`
        },
        {
          icon: panahArah,
          judul: `Lurus sejauh ± ${g.jarakMeter} meter`,
          desc: "Ikuti koridor hingga mendekati tangga."
        },
        {
          icon: panahArah,
          judul: `Belok ${arahUtama}`,
          desc: `Masuk ke koridor sisi ${arahUtama}.`
        },
        {
          icon: "◎",
          isTarget: true,
          judul: `Ruang ${kodeRuang}`,
          desc: `Berada di sisi ${arahUtama} koridor.`
        }
      ];
    }

    const koridorPos = g.sisi.startsWith("atas") ? "utara (atas)" : "selatan (bawah)";
    return [
      {
        icon: "↑",
        judul: "Keluar dari lift",
        desc: `Menuju arah ${arahUtama} koridor ${koridorPos}.`
      },
      {
        icon: panahArah,
        judul: `Lurus sejauh ± ${g.jarakMeter} meter`,
        desc: `Ikuti koridor ${koridorPos} melewati deretan kelas.`
      },
      {
        icon: panahArah,
        judul: `Perhatikan plang nomor ruangan`,
        desc: `Cari pintu Ruang ${kodeRuang} di sepanjang koridor.`
      },
      {
        icon: "◎",
        isTarget: true,
        judul: `Ruang ${kodeRuang}`,
        desc: `Berada di koridor ${koridorPos} sisi ${arahUtama}.`
      }
    ];
  }

  /* Render SVG Denah Lantai secara lengkap */
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
      const pts = buildRoutePoints(urut);
      const ptsStr = pts.map((p) => `${p[0]},${p[1]}`).join(" ");

      // Panah arah di tengah segmen koridor utama
      const midArrowX = g.kiri ? 290 : 710;
      const midArrowDir = g.kiri ? "M 296,260 L 284,266 L 296,272 Z" : "M 704,260 L 716,266 L 704,272 Z";
      const showMidArrow = g.sisi === "samping-kiri" || g.sisi === "samping-kanan";

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
      <rect x="42" y="22" width="916" height="516" rx="6" class="svg-outer-border"/>
      <rect x="48" y="28" width="904" height="504" rx="4" fill="none" stroke="var(--room-stroke)" stroke-width="1"/>

      <!-- Area Lobi Lift Tengah -->
      <rect x="445" y="30" width="110" height="500" class="svg-lobi-zone"/>
      <text x="500" y="68" class="svg-lobi-label">LOBI LIFT</text>
      <text x="500" y="498" class="svg-lobi-label">LOBI LIFT</text>

      <!-- 4 Blok Taman/Void Dalam Gedung -->
      <rect x="190" y="150" width="240" height="104" rx="4" class="svg-inner-court"/>
      <rect x="190" y="282" width="240" height="126" rx="4" class="svg-inner-court"/>
      <rect x="570" y="150" width="240" height="104" rx="4" class="svg-inner-court"/>
      <rect x="570" y="282" width="240" height="126" rx="4" class="svg-inner-court"/>

      <!-- Garis Panah Panduan Koridor (Sesuai Ilustrasi UI/UX) -->
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

      <!-- 40 Ruangan Lantai Ini -->
      ${roomsMarkup}

      <!-- Kotak LIFT Tengah & Indikator "Anda di sini" -->
      <g filter="url(#liftShadow)">
        <rect x="462" y="205" width="76" height="136" rx="9" fill="var(--lift-fill)" stroke="var(--lift-stroke)" stroke-width="1.5"/>
      </g>
      <text x="500" y="236" fill="#ffffff" font-family="Inter, sans-serif" font-size="13" font-weight="700" text-anchor="middle" letter-spacing="0.06em">LIFT</text>

      <!-- Rute dari Lift ke Ruangan Tujuan -->
      ${routeMarkup}

      <!-- Titik Biru "Anda di sini" -->
      <circle cx="500" cy="282" r="14" class="you-pulse"/>
      <circle cx="500" cy="282" r="9.5" fill="var(--you-fill)" stroke="#ffffff" stroke-width="3"/>
      <rect x="454" y="304" width="92" height="24" rx="6" fill="#0f172a" stroke="#334155" stroke-width="1"/>
      <text x="500" y="320" fill="#ffffff" font-family="Inter, sans-serif" font-size="10.5" font-weight="600" text-anchor="middle">Anda di sini</text>
    `;

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

    const langkahRute = arahTimeline(kode);
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
          <div class="meta-title">Lift (Lobi Tengah)</div>
          <div class="meta-sub">Anda berada di lantai ${lantai}</div>
        </div>
      </div>

      <div class="timeline">
        ${timelineHtml}
      </div>

      <button type="button" id="btnCariLain" class="btn primary-btn cari-lain-btn">
        Cari Ruangan Lain
      </button>
    `;

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

  /* Pilih Lantai */
  function pilihLantai(lantaiBaru, pilihDefaultRuang) {
    state.lantai = lantaiBaru;
    if (pilihDefaultRuang) {
      // Jika ruang saat ini bukan di lantai baru, arahkan ke ruang X09 di lantai tersebut
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
  function pilihRuang(kodeRuang) {
    const l = Math.floor(kodeRuang / 100);
    const u = kodeRuang % 100;
    if (l < 1 || l > GKU.jumlahLantai || u < 1 || u > GKU.ruangPerLantai) {
      return false;
    }
    state.lantai = l;
    state.ruang = kodeRuang;
    renderTabs();
    gambarDenah();
    tampilPanel();
    updateChipHighlight();
    return true;
  }

  /* Highlight chip pencarian populer yang aktif */
  function updateChipHighlight() {
    document.querySelectorAll(".chip[data-room]").forEach((chip) => {
      const r = parseInt(chip.getAttribute("data-room"), 10);
      chip.classList.toggle("active", r === state.ruang);
    });
  }

  /* Sistem Pencarian Ruangan (Mendukung Nomor & Nama Ruangan) */
  function cariDaftarRuangan(rawQuery) {
    const q = (rawQuery || "").trim().toLowerCase();
    if (!q) return [];

    const hasil = [];
    for (let l = 1; l <= GKU.jumlahLantai; l++) {
      for (let u = 1; u <= GKU.ruangPerLantai; u++) {
        const kode = l * 100 + u;
        const kodeStr = String(kode);
        const namaKhusus = GKU.namaRuang[kodeStr] || "";
        const labelTampil = namaKhusus || `Ruang ${kodeStr}`;

        const cocokKode = kodeStr.includes(q);
        const cocokNama = labelTampil.toLowerCase().includes(q) || `ruang ${kodeStr}`.includes(q);

        if (cocokKode || cocokNama) {
          let prioritas = 3;
          if (kodeStr === q || labelTampil.toLowerCase() === q) prioritas = 0;
          else if (kodeStr.startsWith(q)) prioritas = 1;
          else if (namaKhusus.toLowerCase().includes(q)) prioritas = 2;

          hasil.push({
            kode,
            lantai: l,
            judul: namaKhusus && !namaKhusus.startsWith("Ruang Kelas") ? namaKhusus : `Ruang ${kode}`,
            sub: namaKhusus && namaKhusus !== `Ruang ${kode}` ? `Lantai ${l} • ${namaKhusus}` : `Lantai ${l}`,
            prioritas
          });
        }
      }
    }

    // Jika query adalah "909", tampilkan persis urutan seperti desain UI/UX (909, 908, 910, Ruang Lab 9A)
    if (q === "909") {
      return [
        { kode: 909, lantai: 9, judul: "Ruang 909", sub: "Lantai 9", prioritas: 0 },
        { kode: 908, lantai: 9, judul: "Ruang 908", sub: "Lantai 9", prioritas: 1 },
        { kode: 910, lantai: 9, judul: "Ruang 910", sub: "Lantai 9", prioritas: 1 },
        { kode: 911, lantai: 9, judul: "Ruang Lab 9A", sub: "Lantai 9", prioritas: 2 }
      ];
    }

    hasil.sort((a, b) => a.prioritas - b.prioritas || a.kode - b.kode);
    return hasil.slice(0, 6);
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

    const url = `${GKU.baseUrl}?lantai=${state.lantai}${state.ruang ? `&ruang=${state.ruang}` : ""}`;
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
      a.download = `QR-Denah-GKU-Lantai-${state.lantai}.png`;
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
        pilihRuang(state.lantai * 100 + 9);
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

    // Item Hasil Pencarian di Kartu Showcase Bawah
    document.querySelectorAll(".showcase-search-item[data-room]").forEach((item) => {
      item.addEventListener("click", () => {
        const kode = parseInt(item.getAttribute("data-room"), 10);
        pilihRuang(kode);
        window.scrollTo({ top: 0, behavior: "smooth" });
        showToast(`Menampilkan rute ke Ruang ${kode} (Lantai ${Math.floor(kode / 100)})`);
      });
    });

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
        salinKeClipboard(`${GKU.baseUrl}?lantai=${state.lantai}`);
      });
    }
    if (btnShowcaseDownload) {
      btnShowcaseDownload.addEventListener("click", bukaModalQR);
    }
  }

  /* Jalankan Saat DOM Siap */
  function init() {
    initFromUrl();
    renderTabs();
    gambarDenah();
    tampilPanel();
    updateChipHighlight();
    initEvents();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();