import { createClient } from "@libsql/client";
import type {
  Asset,
  Content,
  ContentComment,
  ContentStatus,
  DashboardSummary,
  Metrics,
} from "../lib/types";

export const db = createClient({
  url:
    process.env["DATABASE_URL"] ||
    "libsql://manajemen-konten-pixolve.aws-ap-southeast-1.turso.io",
  authToken:
    process.env["DATABASE_AUTH_TOKEN"] ||
    process.env["TURSO_AUTH_TOKEN"] ||
    "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3OTMxOTc0MTksImlkIjoiMDFhMTgyZTQtYzIwMS03Mjc5LTlmZmUtN2U4MjAwZDA5ODZlIiwia2lkIjoiVUxGQUMxODRHR0MyeEVzREQ0UU04X25DRS11WFdxYU9NUlkzeHhPc202byIsInJpZCI6ImQwZDY2NDIzLWY2ZDktNDFiZC1hNWI5LTU4NTM0NmNlNDQ4NiJ9.CEIsQrB5NbEAnzNvH15cmtyxu79ftKphW4JulaLr6enK2eRHY9rTuFgEXWg1-kiNxR_Jttd0dJxyU7TKHzQICw",
});

let dbInitialized = false;

export async function ensureDbInitialized() {
  if (dbInitialized) return;

  await db.execute(`
    CREATE TABLE IF NOT EXISTS contents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      pillar TEXT NOT NULL DEFAULT 'Edukasi',
      platforms TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'idea',
      approval_status TEXT NOT NULL DEFAULT 'not_submitted',
      caption TEXT NOT NULL DEFAULT '',
      hashtags TEXT NOT NULL DEFAULT '',
      cta TEXT NOT NULL DEFAULT '',
      asset_url TEXT NOT NULL DEFAULT '',
      scheduled_date TEXT,
      scheduled_time TEXT,
      metrics TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      author TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'Reference',
      notes TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Linked',
      created_at TEXT NOT NULL
    );
  `);

  // Check if initial seeding is needed
  const countRes = await db.execute("SELECT COUNT(*) as cnt FROM contents");
  const count = Number(countRes.rows[0]?.["cnt"] ?? 0);

  if (count === 0) {
    await seedInitialData();
  }

  dbInitialized = true;
}

async function seedInitialData() {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const nextWeek = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const nextTwoWeeks = new Date(now.getTime() + 9 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const initialContents: Array<{
    id: string;
    title: string;
    description: string;
    pillar: string;
    platforms: string[];
    status: ContentStatus;
    approval_status: string;
    caption: string;
    hashtags: string;
    cta: string;
    asset_url: string;
    scheduled_date: string | null;
    scheduled_time: string | null;
    metrics: Metrics;
    comments: Array<{ id: string; author: string; message: string; created_at: string }>;
  }> = [
    {
      id: "cont-1",
      title: "Tips Fotografi Produk UMKM Hanya Pakai Smartphone",
      description:
        "Panduan praktis pencahayaan alami dan komposisi foto produk agar terlihat profesional.",
      pillar: "Edukasi",
      platforms: ["Instagram Feed", "TikTok"],
      status: "published",
      approval_status: "approved",
      caption:
        "Siapa bilang foto katalog produk harus pakai kamera mahal? Cukup maksimalkan cahaya jendela dan grid HP kamu! Cek 4 langkah mudahnya di slide ini 📸✨",
      hashtags: "#tipsfotografi #fotoproduk #umkmindonesia #pixolvestudio #kontenkreator",
      cta: "Save postingan ini biar nggak lupa pas mau foto produk besok!",
      asset_url: "https://drive.google.com/drive/folders/sample-umkm-photos",
      scheduled_date: todayStr,
      scheduled_time: "10:00",
      metrics: {
        views: 12450,
        likes: 890,
        comments: 46,
        shares: 120,
        saves: 340,
        engagement_rate: 11.2,
      },
      comments: [
        {
          id: "cm-1",
          author: "Dimas",
          message: "Visual slide pertama sangat tajam dan eye-catching!",
          created_at: new Date(now.getTime() - 86400000).toISOString(),
        },
        {
          id: "cm-2",
          author: "Editor",
          message: "Versi reel pendeknya sudah siap juga di drive.",
          created_at: new Date(now.getTime() - 43200000).toISOString(),
        },
      ],
    },
    {
      id: "cont-2",
      title: "Behind The Scenes: Setup Lighting Studio Konten Pixolve",
      description:
        "Menunjukkan proses di balik layar produksi video reels untuk klien bisnis fashion.",
      pillar: "Soft Sell",
      platforms: ["Instagram Reels", "TikTok"],
      status: "scheduled",
      approval_status: "approved",
      caption:
        "Dapur rekaman Pixolve Studio hari ini! Dari ruangan biasa disulap jadi set visual elegan untuk klien fashion lokal.",
      hashtags: "#behindthescenes #productionstudio #studiokonten #contentcreator",
      cta: "Butuh bantuan produksi konten video bisnismu? Kirim pesan DM sekarang ya!",
      asset_url: "https://www.canva.com/design/sample-bts",
      scheduled_date: nextWeek,
      scheduled_time: "15:30",
      metrics: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement_rate: 0 },
      comments: [
        {
          id: "cm-3",
          author: "Dina",
          message: "Musik latar sudah dilisensikan bebas royalti.",
          created_at: new Date(now.getTime() - 20000000).toISOString(),
        },
      ],
    },
    {
      id: "cont-3",
      title: "Promo Paket Manajemen Konten Bulanan Pixolve Studio",
      description:
        "Peluncuran promo bundling: 20 postingan feed + 8 video reels + copywriting gratis.",
      pillar: "Promosi",
      platforms: ["Instagram Feed", "Instagram Stories"],
      status: "pending_approval",
      approval_status: "in_review",
      caption:
        "Biar kamu fokus kembangkan produk, biar urusan konten tim Pixolve yang urus dari riset hingga tayang. Dapatkan bonus gratis 2 video khusus minggu ini!",
      hashtags: "#promobisnis #jasakonten #socialmediamanagement #digitalmarketing",
      cta: "Klik link di bio untuk klaim kuota promo terbatas!",
      asset_url: "https://www.figma.com/file/sample-promo-banners",
      scheduled_date: nextTwoWeeks,
      scheduled_time: "19:00",
      metrics: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement_rate: 0 },
      comments: [
        {
          id: "cm-4",
          author: "Rian",
          message: "Mohon review penulisan diskon sebelum kami publish.",
          created_at: new Date().toISOString(),
        },
      ],
    },
    {
      id: "cont-4",
      title: "Kesalahan Fatal Algoritma Media Sosial yang Sering Dilakukan",
      description:
        "Edukasi mengenai pentingnya konsistensi dan engagement dua arah di akun bisnis.",
      pillar: "Edukasi",
      platforms: ["LinkedIn", "YouTube Shorts"],
      status: "scripting",
      approval_status: "not_submitted",
      caption:
        "Posting tiap hari tapi kok sepi interaksi? Mungkin akunmu terjebak di 3 kesalahan fatal ini.",
      hashtags: "#socialmediatips #algoritmamedsos #contentstrategy",
      cta: "Komen di bawah kendala terbesar akun medsomu saat ini!",
      asset_url: "",
      scheduled_date: null,
      scheduled_time: null,
      metrics: { views: 0, likes: 0, comments: 0, shares: 0, saves: 0, engagement_rate: 0 },
      comments: [],
    },
  ];

  for (const item of initialContents) {
    await db.execute({
      sql: `INSERT INTO contents (
        id, title, description, pillar, platforms, status, approval_status,
        caption, hashtags, cta, asset_url, scheduled_date, scheduled_time, metrics, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.id,
        item.title,
        item.description,
        item.pillar,
        JSON.stringify(item.platforms),
        item.status,
        item.approval_status,
        item.caption,
        item.hashtags,
        item.cta,
        item.asset_url,
        item.scheduled_date,
        item.scheduled_time,
        JSON.stringify(item.metrics),
        now.toISOString(),
        now.toISOString(),
      ],
    });

    for (const c of item.comments) {
      await db.execute({
        sql: `INSERT INTO comments (id, content_id, author, message, created_at) VALUES (?, ?, ?, ?, ?)`,
        args: [c.id, item.id, c.author, c.message, c.created_at],
      });
    }
  }

  const initialAssets: Asset[] = [
    {
      id: "ast-1",
      title: "Brand Guideline & Palet Warna Pixolve",
      url: "https://www.figma.com/design/pixolve-brand-kit",
      provider: "figma",
      kind: "Brand Kit",
      notes: "Acuan warna utama Kinsta / Warm Studio tone dan typografi Inter & Serif.",
      status: "Active",
    },
    {
      id: "ast-2",
      title: "Template Desain Carousel Instagram Edukasi",
      url: "https://www.canva.com/folder/pixolve-carousel-templates",
      provider: "canva",
      kind: "Canva Template",
      notes: "Desain master untuk postingan 5 slide edukasi mingguan.",
      status: "Active",
    },
    {
      id: "ast-3",
      title: "Drive Master Foto & Video Produk Klien",
      url: "https://drive.google.com/drive/folders/pixolve-media-master",
      provider: "google_drive",
      kind: "Cloud Storage",
      notes: "Arsip foto RAW resolusi tinggi dan rekaman 4K.",
      status: "Active",
    },
  ];

  for (const ast of initialAssets) {
    await db.execute({
      sql: `INSERT INTO assets (id, title, url, provider, kind, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        ast.id,
        ast.title,
        ast.url,
        ast.provider,
        ast.kind,
        ast.notes,
        ast.status,
        now.toISOString(),
      ],
    });
  }
}
