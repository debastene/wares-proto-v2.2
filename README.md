# WARES — Warehouse Request System

WARES mendigitalisasi pencatatan **Surat Pengambilan Barang** untuk Departemen Pergudangan & Pengantongan, PT Petrokimia Gresik, serta menyediakan halaman pemantauan dan perencanaan persediaan sparepart.

Dokumentasi ini disesuaikan dengan implementasi pada [commit a919a96](https://github.com/debastene/wares-proto-v2.2/commit/a919a96ecaa9d1e49b1117aa2646ca6caffd8d9c), 15 November 2026. Kesesuaian source tidak membuktikan bahwa konfigurasi Vercel, migrasi database, atau deployment Apps Script yang sedang digunakan sudah sama.

## Gambaran aplikasi

Aplikasi mempunyai dua kelompok fungsi:

- **Pencatatan operasional:** permintaan/pengambilan barang, stok masuk, informasi stok, Master Data material, riwayat, serta pratinjau dan unduh PDF surat.
- **Informasi inventori:** Detail SKU, Proyeksi Stok, Jadwal PM & Overhaul, Rencana Pesanan, dan Biaya & Evaluasi. Perhitungan utama reliability, ROP/safety stock, kebijakan persediaan (R,S), dan proyeksi berasal dari hasil model workbook; website membaca hasilnya dan mengolah tampilan/agregat yang diperlukan.

Pencatatan permintaan saat ini **tidak memiliki alur persetujuan**. Kolom `requests.status` merupakan penanda legacy, bukan workflow approval.

Implementasi masih memuat bagian lama dan baru. Definisi tiga peran sudah tersedia, tetapi pemeriksaan akses belum seragam. Halaman `/dashboard` juga memakai jalur integrasi tersendiri; lihat [Dashboard aktif dan kontrak integrasi](#dashboard-aktif-dan-kontrak-integrasi).

## Teknologi

| Bagian | Teknologi |
|---|---|
| Web dan API | Next.js 15.5.22, React 18, TypeScript |
| Tampilan | Tailwind CSS, Radix UI, Lucide, Recharts |
| Formulir dan validasi | React Hook Form, Zod |
| Login dan database | Supabase Auth, PostgreSQL, RLS |
| Integrasi workbook | Google Apps Script dan Google Sheets |
| PDF | `@react-pdf/renderer`, dimuat di browser |
| Runtime Node.js | `>=20.9.0 <25`, sesuai `package.json` |

## Halaman dan akses yang diterapkan

Tabel ini menjelaskan pemeriksaan yang ada pada halaman/API, bukan matriks peran yang baru direncanakan.

| Halaman | Fungsi | Akses saat ini pada mode normal |
|---|---|---|
| `/home` | Portal layanan setelah login | Pengguna login; kartu menu masih memakai `is_admin` |
| `/dashboard` | Ringkasan Total SKU, Status Kritis, dan Pesan Sekarang | Layout aplikasi meminta login; halaman tidak mempunyai guard admin khusus |
| `/detail-sku` | Status SKU, ROP/SS, pola dan riwayat demand | Pengguna login |
| `/proyeksi-stok` | Deret proyeksi stok dan ringkasan persediaan | Pengguna login |
| `/jadwal-pm` | Kebutuhan sparepart dari jadwal PM/overhaul | Pengguna login |
| `/rencana-pesanan` | Rencana pemesanan per periode review | Pengguna login |
| `/biaya` | Parameter dan evaluasi biaya kebijakan persediaan | Halaman hanya meminta login; menu disembunyikan untuk Maintenance |
| `/stok` | Informasi ketersediaan dan lokasi material | Pengguna login |
| `/buat-permintaan` | Formulir pencatatan pengambilan barang | Pengguna login |
| `/riwayat` dan `/riwayat/[id]` | Daftar/detail permintaan serta dokumen surat | Pengguna membaca miliknya; admin dapat membaca seluruhnya melalui RLS |
| `/riwayat/[id]/edit` | Koreksi permintaan tersimpan | Admin berdasarkan `is_admin` |
| `/input-stok` | Pencatatan material masuk | Formulir dan API khusus admin berdasarkan `is_admin` |
| `/master-data` | Tambah, ubah, nonaktifkan, dan aktifkan material | Editor dan API khusus admin berdasarkan `is_admin` |
| `/login`, `/signup` | Masuk dan pendaftaran akun | Halaman autentikasi |
| `/setup` | Petunjuk saat konfigurasi Supabase belum tersedia | Ditentukan middleware |

### Peran dan batasan akses

[`src/lib/roles.ts`](src/lib/roles.ts) mendefinisikan `maintenance`, `warehouse`, dan `admin`. Peran efektif memakai `profile.role` jika tersedia; jika tidak, aplikasi menurunkannya dari `is_admin`.

Namun, [`supabase/schema.sql`](supabase/schema.sql) masih mendefinisikan profil berbasis `is_admin`, tanpa kolom `role`. Guard Master Data, Input Stok, dan edit permintaan juga masih memeriksa flag ini. Predikat pada `roles.ts` tidak otomatis berarti semua halaman/API sudah menerapkan matriks tiga peran.

Perbedaan lain yang perlu diketahui:

- Kartu Dashboard pada Beranda masih ditandai khusus admin, tetapi navigasi utama menawarkannya kepada semua peran dan halaman aktif hanya dilindungi login pada layout.
- Menu Biaya & Evaluasi disembunyikan untuk Maintenance, tetapi membuka `/biaya` secara langsung hanya melewati pemeriksaan login. Menyembunyikan menu belum merupakan pembatasan akses halaman.
- Helper bernama `bisaUbahStatusRequest` belum membentuk workflow persetujuan pada API permintaan yang ada.

## Sumber data dan arsitektur

Sumber identitas material, angka stok operasional, dan hasil model inventori dipilih secara terpisah.

| Data | Pemilih | Perilaku |
|---|---|---|
| Identitas material | `MASTER_SOURCE=sheets` | Baca/tulis melalui Apps Script dan tab `MASTER DATA` |
| Identitas material | `MASTER_SOURCE=postgres` | `master_items` menjadi sumber utama; perubahan dimirror ke Sheets |
| Stok operasional | `STOCK_SOURCE=sheets` | Baca/tulis stok melalui Apps Script dan jurnal Sheets |
| Stok operasional | `STOCK_SOURCE=postgres` | Saldo dari `stock_ledger`; Sheets menerima mirror transaksi |
| Hasil model inventori | `INVENTORY_SOURCE=sheets` **dan** URL/secret Sheets terisi | Baca hasil model lewat action `inv.*` |
| Hasil model inventori | Kondisi selain di atas | Baca JSON fixture dari `src/lib/inventory/data/` |
| Dashboard aktif | `GAS_WEBAPP_URL` | Jalur khusus `/api/wares-sync`; terpisah dari pemilih inventori |
| Profil dan sebagian data demo | `NEXT_PUBLIC_WARES_LOCAL=1` | Profil sintetis, pengalih peran, serta beberapa endpoint baca fixture |

`MASTER_SOURCE` wajib eksplisit: nilai kosong atau selain `sheets`/`postgres` dianggap salah konfigurasi. `STOCK_SOURCE` memilih Sheets secara default, kecuali nilainya `postgres`.

Fixture inventori berisi snapshot 99 SKU. Angka fixture tidak otomatis berubah ketika stok operasional atau spreadsheet diubah.

```text
Browser
  ├─ Supabase Auth: login
  └─ Next.js
       ├─ Supabase Postgres
       │    ├─ profiles, requests, request_items
       │    ├─ master_items, bila MASTER_SOURCE=postgres
       │    └─ stock_ledger, bila STOCK_SOURCE=postgres
       ├─ Adapter Google Sheets: GOOGLE_SHEETS_API_URL + SECRET
       │    └─ Apps Script → jurnal, master, laporan, hasil model dan KPI
       ├─ Fixture JSON: alternatif pembacaan hasil model inventori
       └─ /api/wares-sync → GAS_WEBAPP_URL: integrasi dashboard aktif
```

### Struktur database

Skema native aplikasi adalah PostgreSQL/Supabase.

| Tabel | Fungsi |
|---|---|
| `profiles` | Profil pengguna, terhubung ke `auth.users` milik Supabase |
| `catalog_items` | Katalog lama untuk kompatibilitas data historis |
| `requests` | Header pencatatan pengambilan barang |
| `request_items` | Detail barang, jumlah diminta, dan jumlah diberikan |
| `stock_ledger` | Jurnal masuk/keluar untuk sumber stok Postgres |
| `master_items` | Identitas material serta status mirror ke Sheets |

`stock_current` adalah view saldo dari ledger, bukan tabel transaksi tambahan. `master_items` dan `stock_ledger` belum memiliki FK langsung ke tabel lain pada skema repositori; pencocokan material serta referensi jurnal dikelola oleh kode dan fungsi database. Halaman proyeksi, PM, dan hasil model tidak mempunyai tabel PostgreSQL tersendiri pada skema ini.

## Alur operasional

### Permintaan dan pengambilan barang

- Pengguna mengisi pekerjaan, lokasi, kategori, **nama penyerah manual**, dan **nama penerima/PIC manual**. Nama yang tercetak pada surat tidak otomatis mengikuti nama akun login.
- Tiap barang mempunyai `jumlah_permintaan` dan `jumlah_diberikan` yang terpisah. Berlaku `jumlah_permintaan > 0` dan `0 <= jumlah_diberikan <= jumlah_permintaan`.
- Formulir memeriksa jumlah diberikan terhadap snapshot stok, termasuk akumulasi bila material yang sama muncul beberapa kali. Pada jalur Sheets, Apps Script juga memeriksa ketersediaan saat transaksi diproses.
- Mutasi keluar menggunakan **jumlah diberikan**, bukan jumlah diminta. Nilai `jumlah` tetap dipertahankan sebagai alias legacy jumlah permintaan.
- API mengambil identitas akun dari sesi. UI mengirim `Idempotency-Key` untuk permintaan baru dan `X-Sync-Token` untuk versi sinkronisasi.
- Koreksi permintaan tersimpan hanya untuk admin. Pada Postgres, trigger menyelaraskan baris `request_items` dengan jurnal keluar.

### Perbedaan konfirmasi transaksi

| Mode stok | Penyimpanan utama dan arti sukses |
|---|---|
| `sheets` | Jurnal Sheets ditulis/dikonfirmasi, lalu riwayat Supabase disimpan. Respons yang belum pasti dapat berstatus `pending` atau `pending_database`. |
| `postgres` | Transaksi database disimpan dahulu dan dapat langsung mengembalikan `confirmed`. Mirror Sheets dijadwalkan melalui `after()` dan kegagalannya dicatat di log; sukses database belum membuktikan mirror Sheets sudah selesai. |

Pada jalur Sheets, UI memeriksa status memakai ID/token lama ketika respons terlambat, tanpa POST/PATCH ulang otomatis. Pemulihan operasi tertunda disimpan di browser hingga 24 jam dan dipisahkan berdasarkan akun. Status ini adalah status teknis sinkronisasi, bukan status persetujuan permintaan.

Mirror transaksi Postgres saat ini bersifat best-effort; belum ada durable outbox atau jaminan bahwa seluruh mirror yang gagal akan dikirim ulang otomatis.

### Input Stok dan Master Data

Input Stok meminta tanggal, material, Rack, Area, jumlah masuk, dan keterangan. Keterangan dibaca dari riwayat masuk dan menyediakan pilihan **Lainnya** untuk teks manual.

- `/api/racks` mengembalikan `CANONICAL_RACKS` dari [`src/lib/racks/canonical.ts`](src/lib/racks/canonical.ts), yaitu referensi 50 Rack yang disalin dari `RACK GUDANG.xlsx`.
- Memilih Rack mengisi Area, tetapi pengguna dapat memilih Area resmi lain. API memvalidasi Rack dan Area terhadap daftar kanonik tersebut.
- Dropdown website tidak membaca ulang tab Sheets saat dibuka. Apps Script mempunyai pembaca referensi Rack sendiri; perubahan referensi perlu diselaraskan dengan konstanta website.

Master Data memakai material number sebagai identitas unik. Material dinonaktifkan dengan `STATUS=NONAKTIF` tanpa menghapus baris; dapat diaktifkan kembali.

Pada Sheets, CRUD Master Data hanya menulis `A:H` dan `P`. Kolom `I:O` serta posisi baris dipertahankan untuk formula dan laporan. Pada mode Postgres, status mirror dicatat sebagai `pending`, `synced`, atau `failed` dan diperiksa melalui endpoint status ringan.

## Dashboard aktif dan kontrak integrasi

Halaman `/dashboard` saat ini memakai [`src/app/api/wares-sync/route.ts`](src/app/api/wares-sync/route.ts), yang meneruskan GET ke `GAS_WEBAPP_URL`. Halaman mengharapkan bentuk respons berikut; seluruh angka di bawah hanya ilustrasi bentuk data:

```json
{
  "status": "success",
  "data": {
    "total_sku": 0,
    "kritis": 0,
    "pesan_sekarang": 0,
    "cukup": 0,
    "persentase_cukup": 0,
    "nilai_pesanan": 0
  }
}
```

Jalur ini belum sama dengan adapter utama Apps Script:

- `google-apps-script/Code.gs` yang disertakan memiliki `doGet()` untuk health check, dengan respons `{ "ok": true, "data": { ... } }`, bukan statistik dashboard di atas.
- Action `inv.dashboard` tersedia melalui POST ber-secret dan menghasilkan `{ ringkasan, perMesin, items }`. Adapter serta komponen `DashboardInventoryView` tersedia, tetapi tidak dipakai oleh route `/dashboard` saat ini.
- Karena itu, mengisi `GAS_WEBAPP_URL` dengan URL script bawaan saja tidak membuat kedua kontrak tersebut cocok. Diperlukan endpoint dengan kontrak yang sesuai atau perubahan integrasi pada kode.
- Handler `/api/wares-sync` menyediakan GET/POST tetapi belum memeriksa sesi/peran sendiri. Middleware melewatkan validasi sesi untuk route `/api/`; proteksi layout halaman tidak otomatis melindungi handler ini.
- Route dashboard saat ini hanya menampilkan error di console dan dapat tetap menampilkan indikator sinkronisasi ketika respons tidak sesuai.

Komponen analitik pengeluaran/KPI lama masih ada pada `src/components/dashboard/`, tetapi tidak dirender oleh route dashboard aktif. `/api/kpi` tetap tersedia untuk admin; angka mentah dibaca dari tab `Dashboard KPI` dan diolah dengan definisi pada `src/lib/kpi/definitions.ts`.

## Menjalankan aplikasi dengan layanan sebenarnya

### 1. Instal dependency

Gunakan Node.js `>=20.9.0 <25`, kemudian:

```bash
npm install
```

### 2. Siapkan Supabase dan urutan migrasi

1. Buat/buka project Supabase.
2. Pada **Authentication → Sign In / Providers → Email**, matikan konfirmasi email untuk alur akun internal yang ada. Username diawali `PG` dan dipetakan menjadi email sintetis `username@wares.local`.
3. Jalankan berkas berikut di SQL Editor dalam urutan ini:

| Urutan | Berkas | Tujuan |
|---|---|---|
| 1 | [`supabase/schema.sql`](supabase/schema.sql) | Tabel, view, fungsi dasar, trigger, dan RLS |
| 2 | [`2026-08-04-penyerah-penerima.sql`](supabase/migrations/2026-08-04-penyerah-penerima.sql) | Fungsi transaksi yang menerima nama penyerah dan penerima terpisah |
| 3 | [`2026-08-09-master-data-rack.sql`](supabase/migrations/2026-08-09-master-data-rack.sql) | Metadata Rack/Area dan RPC Input Stok |
| 4 | [`2026-08-10-master-items-postgres.sql`](supabase/migrations/2026-08-10-master-items-postgres.sql) | Sumber Master Data Postgres, normalisasi identitas, dan status mirror |

Jangan berhenti pada `schema.sql`: API saat ini mengirim `p_nama_penerima`, sedangkan definisi RPC yang menerima parameter tersebut ada pada migrasi 4 Agustus. Jika `schema.sql` dijalankan ulang, ikuti kembali urutan migrasi di atas.

Migrasi awal [`2026-08-03-stock-ledger.sql`](supabase/migrations/2026-08-03-stock-ledger.sql) tersedia sebagai riwayat penambahan ledger; definisinya sudah tercakup dalam `schema.sql`. Daftar di atas adalah urutan penyiapan, bukan instruksi untuk menjalankan semua file migrasi secara sembarang.

### 3. Deploy Apps Script dan siapkan workbook

Gunakan workbook pengembangan/dummy yang sudah diverifikasi. Integrasi utama membaca spreadsheet tempat Apps Script terpasang.

1. Siapkan tab operasional `MASTER DATA`, `RACK GUDANG`, `MASUK`, `KELUAR`, serta template `Juli 2026 - DATA BASE LAPORAN HARIAN` dengan tata letak/header yang diharapkan kode.
2. Pasang [`google-apps-script/Code.gs`](google-apps-script/Code.gs) dan [manifest](google-apps-script/appsscript.json). Zona waktu yang dipakai adalah `Asia/Jakarta`.
3. Buat Script Property `WARES_API_SECRET` dengan nilai acak panjang, minimal 32 karakter. Nilai yang sama digunakan pada `GOOGLE_SHEETS_API_SECRET` di server.
4. Untuk penyiapan data Rack lama, jalankan `migrateLegacyRackDataSafely()`. Jalankan `installMonthlyTrigger()` untuk memasang rollover laporan awal bulan beserta fallback pada akses pertama.
5. Jika memakai KPI, jalankan `setupDashboardKpi()` untuk menyiapkan tab input/panel `Dashboard KPI`.
6. Deploy sebagai **Web app**, dijalankan oleh pemilik workbook. Konfigurasi integrasi yang ada membutuhkan akses yang dapat dipanggil server tanpa sesi Google, dengan secret pada body POST. Jika kebijakan Workspace tidak mengizinkannya, autentikasi integrasi perlu disesuaikan.
7. Simpan URL deployment yang berakhir `/exec`. Setelah mengubah script, terbitkan versi deployment baru agar URL tersebut menjalankan kode yang sesuai.

Untuk membaca seluruh modul inventori secara live, siapkan delapan tab model pada workbook target dengan nama dan header yang sesuai parser:

| Tab model | Action Apps Script |
|---|---|
| `DASHBOARD` | `inv.dashboard` |
| `RM_HASIL` | `inv.rmhasil` |
| `DATA_DEMAND (RM)` | `inv.demand` |
| `OP_STOK` | `inv.proyeksi` |
| `DATA_SKU TERPAKAI` | `inv.pola` |
| `OP_ORDER` | `inv.oporder` |
| `OP_RENCANA` | `inv.oprencana` |
| `PM_OVERHAUL` | `inv.pm` |

Action inventori membaca hasil sel/model dan tidak menghitung ulang seluruh model di website. Parser bergantung pada teks header workbook. Adapter inventori yang ada memakai URL/secret integrasi utama; belum ada adapter terpisah untuk `INVENTORY_SHEETS_API_URL`.

### 4. Isi environment

Salin [`.env.local.example`](.env.local.example) menjadi `.env.local`. Template tersebut belum memuat semua flag modul baru; contoh lengkap untuk kebutuhan yang didokumentasikan di sini:

```dotenv
# Login dan database aplikasi
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Hanya untuk seed/backfill lokal, bukan kebutuhan runtime web
SUPABASE_SERVICE_ROLE_KEY=

# Adapter utama Apps Script, hanya di server
GOOGLE_SHEETS_API_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
GOOGLE_SHEETS_API_SECRET=
# Pengaman target workbook pada backfill Master Data
GOOGLE_SHEETS_SPREADSHEET_ID=

# Pilih sumber operasional secara sadar
MASTER_SOURCE=sheets
STOCK_SOURCE=sheets

# Fixture lokal; ganti menjadi sheets setelah tab/model/integrasi siap
INVENTORY_SOURCE=fixture

# Endpoint khusus dashboard aktif; lihat kontrak integrasi di atas
GAS_WEBAPP_URL=

# 0 untuk penggunaan dengan autentikasi sebenarnya
NEXT_PUBLIC_WARES_LOCAL=0

# Akun admin untuk npm run seed
ADMIN_USERNAME=PGADMIN
ADMIN_PASSWORD=
ADMIN_NAMA=Administrator WARES
ADMIN_EMAIL=
```

Jangan memakai awalan `NEXT_PUBLIC_` untuk secret Apps Script atau service-role key. `GOOGLE_SHEETS_SPREADSHEET_ID` adalah pengaman backfill Master Data; mengganti nilainya tidak memindahkan workbook tempat script berjalan.

### 5. Siapkan akun admin

Isi `ADMIN_PASSWORD` unik minimal 12 karakter, lalu:

```bash
npm run seed
```

Seed mengisi katalog kompatibilitas dan membuat/memperbarui akun serta profil admin. Menjalankannya kembali juga merotasi password admin sesuai environment. Seed tidak menggantikan backfill Master Data atau saldo stok.

### 6. Jika menggunakan Master Data Postgres

Pastikan migrasi selesai dan Apps Script menunjuk workbook yang benar, lalu:

```bash
npm run backfill:master
```

Skrip memeriksa identitas workbook dan kesiapan sumber sebelum melakukan upsert material, termasuk penyimpanan `sheet_row`. Periksa jumlah dan status hasilnya terhadap workbook target:

```sql
select
  count(*) as total,
  count(*) filter (where status = 'AKTIF') as aktif,
  count(*) filter (where sheet_row is not null) as punya_sheet_row,
  count(*) filter (where sheet_sync_status = 'synced') as mirror_tersinkron
from public.master_items;
```

Baru setelah hasil diverifikasi, ubah `MASTER_SOURCE=postgres` dan deploy ulang. Katalog Postgres kosong diperlakukan sebagai penyiapan yang belum selesai. Backfill mengambil data dari Sheets dan dapat memperbarui material yang sudah ada; jangan menjalankannya sebagai sinkronisasi rutin tanpa menentukan sumber yang berwenang.

### 7. Jika memindahkan sumber stok ke Postgres

`npm run backfill:stock` mengambil snapshot Sheets, mengganti baris `ref_type='saldo_awal'`, dan mempertahankan transaksi ledger lainnya.

Sebelum menjalankannya, hentikan sementara pencatatan dan cocokkan keadaan ledger dengan snapshot sumber. Skrip menambahkan snapshot sebagai saldo awal tanpa mengurangi transaksi lain yang dipertahankan; menjalankannya pada ledger yang sudah berisi mutasi tercakup dalam snapshot dapat menghitung mutasi tersebut lagi. Jangan menganggap pengulangan backfill otomatis menghasilkan saldo yang benar.

Setelah saldo diverifikasi dan tidak ada transaksi yang terhitung ganda, ubah `STOCK_SOURCE=postgres` dan deploy ulang. Mengembalikan flag ke `sheets` juga memerlukan pemeriksaan kesesuaian kedua sumber karena mirror Postgres bersifat best-effort.

### 8. Jalankan aplikasi

```bash
npm run dev
```

Buka `http://localhost:3000`. Login normal menuju `/home` atau path internal `next` yang valid. Root `/` sendiri mengarahkan ke `/dashboard`. Konfigurasi Supabase yang belum lengkap mengarahkan ke `/setup` pada mode normal.

## Review UI dengan fixture lokal

Untuk mereview sebagian UI tanpa login Supabase, set:

```dotenv
NEXT_PUBLIC_WARES_LOCAL=1
INVENTORY_SOURCE=fixture
```

Mode ini menyediakan profil sintetis dari cookie `wares-peran`, pengalih peran, pembacaan hasil model JSON, serta fixture untuk beberapa endpoint seperti stok dan daftar Master Data. Default peran demo adalah Maintenance.

Mode lokal **bukan simulasi seluruh operasi aplikasi**: transaksi tulis, riwayat, login/logout, dan dashboard khusus `GAS_WEBAPP_URL` masih mempunyai ketergantungan layanan sebenarnya. Jangan menilai keberhasilan CRUD dari tampilan fixture.

Flag ini melewati autentikasi middleware dan `requireProfile`; kode tidak membatasi aktivasi flag berdasarkan `NODE_ENV`. Gunakan untuk review lokal dan pastikan `NEXT_PUBLIC_WARES_LOCAL` tidak bernilai `1` pada deployment yang seharusnya memakai login sebenarnya.

## Konfigurasi Vercel

Isi variabel pada environment Production/Preview yang sesuai, lalu deploy ulang:

- Supabase: `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Sumber operasional: `MASTER_SOURCE` dan `STOCK_SOURCE`, setelah penyiapan sumber terkait selesai.
- Adapter Sheets/mirror: `GOOGLE_SHEETS_API_URL` dan `GOOGLE_SHEETS_API_SECRET`.
- Model inventori: `INVENTORY_SOURCE=sheets` untuk data workbook live, atau fixture untuk snapshot lokal.
- Dashboard aktif: `GAS_WEBAPP_URL` dengan kontrak respons yang sesuai.
- Autentikasi normal: `NEXT_PUBLIC_WARES_LOCAL=0` atau tidak diaktifkan.

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_*`, dan pengaman workbook backfill dipakai oleh skrip lokal; runtime web saat ini tidak memerlukan service-role key. Status deployment serta isi environment aktif harus diverifikasi di project Vercel yang digunakan.

## Perintah pengembangan dan verifikasi

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` | Build produksi |
| `npm run start` | Menjalankan hasil build |
| `npm run typecheck` | Pemeriksaan tipe TypeScript |
| `npm run lint` | ESLint |
| `npm run test:unit` | Tes konfigurasi Master Data, Rack kanonik, perhitungan KPI, kesesuaian KPI Apps Script, dan parser inventori Apps Script |
| `npm run seed` | Katalog kompatibilitas dan akun admin |
| `npm run backfill:master` | Backfill identitas material Sheets → Postgres |
| `npm run backfill:stock` | Penyiapan saldo awal ledger dengan ketentuan pada bagian perpindahan stok |
| `npm audit` | Pemeriksaan advisori dependency |

Tes parser Apps Script memakai `node:vm` dan grid sintetis. Tes unit yang lulus tidak membuktikan workbook, API, atau deployment live telah sesuai.

## Struktur repositori

```text
src/app/
  (app)/
    home/                       portal layanan
    dashboard/                  dashboard aktif melalui /api/wares-sync
    detail-sku/                 detail SKU dan demand/reliability
    proyeksi-stok/               proyeksi persediaan
    jadwal-pm/                  kebutuhan PM/overhaul
    rencana-pesanan/             rencana pemesanan per review
    biaya/                      parameter dan evaluasi biaya
    stok/                       informasi stok operasional
    buat-permintaan/             formulir pengambilan barang
    riwayat/                    daftar, detail, dan edit permintaan
    input-stok/                 formulir stok masuk admin
    master-data/                editor identitas material admin
  api/
    wares-sync/                 proxy dashboard/transaksi dengan jalur khusus
    requests/                   pencatatan, edit, dan pemulihan sinkronisasi
    stock/                      stok, keterangan, input, dan status transaksi
    master-data/                CRUD, migrasi Rack, dan status mirror
    racks/                      referensi Rack kanonik
    kpi/                        pembacaan KPI untuk admin
  login/, signup/, setup/       autentikasi dan petunjuk konfigurasi
src/components/
  inventory/                    tampilan hasil model inventori
  dashboard/                    komponen analitik/KPI yang belum dipakai route dashboard aktif
  pdf/                          pratinjau dan unduh surat
  ui/                           komponen UI dasar
src/lib/
  inventory/                    pemilih Sheets/fixture, tipe, dan JSON model
  stock/                        pemilih Sheets/Postgres dan penggabungan master
  master-data/                  sumber, validasi konfigurasi, dan mirror
  google-sheets/                adapter server dan cache
  kpi/                          definisi dan pengolahan KPI
  local/                        fixture stok dan Master Data
  racks/                        daftar Rack/Area kanonik
  supabase/                     client, sesi, dan retry
  auth.ts, roles.ts, schemas.ts  autentikasi, definisi akses, dan validasi
google-apps-script/              API workbook dan otomasi laporan
supabase/                       skema PostgreSQL dan migrasi
scripts/                        seed dan backfill
public/brand/                   aset identitas visual
```

## Catatan operasional dan dokumen pendukung

- Secret dan kredensial tidak boleh masuk source control. Username internal harus diawali `PG`; self-signup masih tersedia pada implementasi ini.
- Jangan menghapus kolom teknis `_WARES_*` pada jurnal: ID transaksi, request, dan token diperlukan untuk konfirmasi serta idempotensi.
- Jangan menyisipkan, menghapus, atau mengurutkan baris fisik Master Data yang dirujuk formula laporan. Material baru memakai slot template; penonaktifan mempertahankan riwayat.
- Laporan bulan baru mengikuti template dan membawa **Stok Akhir** bulan sebelumnya sebagai stok awal. Rollover dijadwalkan pada awal bulan dengan fallback akses; zona waktu manifest adalah `Asia/Jakarta`.
- Jalur Sheets memakai `LockService` untuk transaksi. Pengendalian edit serentak lintas Sheets dan Postgres serta retry mirror bukan jaminan transaksi atomik di kedua sistem.
- Definisi peran tiga tingkat, guard `is_admin`, navigasi, dan integrasi dashboard perlu diselaraskan sebelum dianggap sebagai satu implementasi yang seragam.

Dokumen tambahan yang tersedia:

- [Integrasi operasional Apps Script](google-apps-script/README.md).
- [Rollout stok Postgres](STOCK_POSTGRES_ROLLOUT.md).
- [Deploy modul inventori](INVENTORY_APPS_SCRIPT_DEPLOY.md).
- [Catatan keputusan historis](WARES_PROJECT_MEMORY.md).
- [Laporan audit historis](WARES_AUDIT_REPORT.md).

Sebagian dokumen pendukung masih merujuk baseline lama. Khusus panduan inventori, daftar lima tab dan petunjuk badge `/dashboard` belum mencerminkan seluruh delapan parser serta route dashboard aktif. Gunakan kode pada commit yang sedang ditinjau dan batasan di README ini ketika terdapat perbedaan.
