import type { InValue } from "@libsql/client";
import { db, ensureDbInitialized } from "./db";
import type {
  Asset,
  Content,
  ContentComment,
  ContentStatus,
  DashboardSummary,
  Metrics,
} from "../lib/types";

const ALL_STATUSES: ContentStatus[] = [
  "idea",
  "scripting",
  "in_production",
  "pending_approval",
  "scheduled",
  "published",
];

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

function rowToContent(row: Record<string, unknown>, comments: ContentComment[] = []): Content {
  let platforms: string[] = [];
  try {
    platforms = typeof row["platforms"] === "string" ? JSON.parse(row["platforms"]) : [];
  } catch {
    platforms = [];
  }

  let metrics: Metrics = {
    views: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    engagement_rate: 0,
  };
  try {
    metrics = typeof row["metrics"] === "string" ? JSON.parse(row["metrics"]) : metrics;
  } catch {
    // default metrics
  }

  return {
    id: String(row["id"] ?? ""),
    title: String(row["title"] ?? ""),
    description: String(row["description"] ?? ""),
    pillar: String(row["pillar"] ?? "Edukasi"),
    platforms,
    status: (row["status"] as ContentStatus) || "idea",
    approval_status: String(row["approval_status"] ?? "not_submitted"),
    caption: String(row["caption"] ?? ""),
    hashtags: String(row["hashtags"] ?? ""),
    cta: String(row["cta"] ?? ""),
    asset_url: String(row["asset_url"] ?? ""),
    scheduled_date: (row["scheduled_date"] as string | null) || null,
    scheduled_time: (row["scheduled_time"] as string | null) || null,
    metrics,
    comments,
    created_at: String(row["created_at"] ?? new Date().toISOString()),
    updated_at: String(row["updated_at"] ?? new Date().toISOString()),
  };
}

async function getCommentsForContent(contentId: string): Promise<ContentComment[]> {
  const res = await db.execute({
    sql: "SELECT id, author, message, created_at FROM comments WHERE content_id = ? ORDER BY created_at ASC",
    args: [contentId],
  });
  return res.rows.map((r) => ({
    id: String(r["id"]),
    author: String(r["author"]),
    message: String(r["message"]),
    created_at: String(r["created_at"]),
  }));
}

export async function handleApiRequest(request: Request): Promise<Response> {
  await ensureDbInitialized();

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  try {
    // 1. GET /api/dashboard
    if (method === "GET" && path === "/api/dashboard") {
      const countsRes = await db.execute(`
        SELECT status, COUNT(*) as count FROM contents GROUP BY status
      `);
      const statusMap = new Map<string, number>();
      for (const row of countsRes.rows) {
        statusMap.set(String(row["status"]), Number(row["count"]));
      }

      const contentByStatus = ALL_STATUSES.map((status) => ({
        status,
        count: statusMap.get(status) ?? 0,
      }));

      const totalContent = Array.from(statusMap.values()).reduce((a, b) => a + b, 0);
      const published = statusMap.get("published") ?? 0;
      const scheduled = statusMap.get("scheduled") ?? 0;
      const inReview = statusMap.get("pending_approval") ?? 0;

      const assetsCountRes = await db.execute("SELECT COUNT(*) as cnt FROM assets");
      const mediaAssets = Number(assetsCountRes.rows[0]?.["cnt"] ?? 0);

      const upcomingRes = await db.execute(`
        SELECT * FROM contents 
        WHERE scheduled_date IS NOT NULL 
        ORDER BY scheduled_date ASC, scheduled_time ASC 
        LIMIT 4
      `);

      const upcoming: Content[] = [];
      for (const row of upcomingRes.rows) {
        const comments = await getCommentsForContent(String(row["id"]));
        upcoming.push(rowToContent(row, comments));
      }

      const summary: DashboardSummary = {
        published,
        scheduled,
        in_review: inReview,
        total_content: totalContent,
        media_assets: mediaAssets,
        upcoming,
        content_by_status: contentByStatus,
      };

      return jsonResponse(summary);
    }

    // 2. GET /api/contents (with filters)
    if (method === "GET" && path === "/api/contents") {
      const status = url.searchParams.get("status");
      const pillar = url.searchParams.get("pillar");
      const search = url.searchParams.get("search");

      let query = "SELECT * FROM contents WHERE 1=1";
      const args: InValue[] = [];

      if (status && status !== "all") {
        query += " AND status = ?";
        args.push(status);
      }
      if (pillar && pillar !== "all") {
        query += " AND pillar = ?";
        args.push(pillar);
      }
      if (search && search.trim() !== "") {
        query += " AND (title LIKE ? OR description LIKE ? OR caption LIKE ? OR hashtags LIKE ?)";
        const wildcard = `%${search.trim()}%`;
        args.push(wildcard, wildcard, wildcard, wildcard);
      }

      query +=
        " ORDER BY CASE WHEN scheduled_date IS NULL THEN 1 ELSE 0 END, scheduled_date ASC, created_at DESC";

      const res = await db.execute({ sql: query, args });
      const contents: Content[] = [];
      for (const row of res.rows) {
        const comments = await getCommentsForContent(String(row["id"]));
        contents.push(rowToContent(row, comments));
      }

      return jsonResponse(contents);
    }

    // 3. POST /api/contents
    if (method === "POST" && path === "/api/contents") {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const id = "cont-" + crypto.randomUUID().slice(0, 8);
      const now = new Date().toISOString();

      const title = String(body["title"] ?? "Untitled Content");
      const description = String(body["description"] ?? "");
      const pillar = String(body["pillar"] ?? "Edukasi");
      const platforms = JSON.stringify(
        Array.isArray(body["platforms"]) ? body["platforms"] : ["Instagram Feed"],
      );
      const status = String(body["status"] ?? "idea");
      const approvalStatus = String(body["approval_status"] ?? "not_submitted");
      const caption = String(body["caption"] ?? "");
      const hashtags = String(body["hashtags"] ?? "");
      const cta = String(body["cta"] ?? "");
      const assetUrl = String(body["asset_url"] ?? "");
      const scheduledDate = (body["scheduled_date"] as string | null) || null;
      const scheduledTime = (body["scheduled_time"] as string | null) || null;
      const metrics = JSON.stringify(
        body["metrics"] ?? {
          views: 0,
          likes: 0,
          comments: 0,
          shares: 0,
          saves: 0,
          engagement_rate: 0,
        },
      );

      await db.execute({
        sql: `INSERT INTO contents (
          id, title, description, pillar, platforms, status, approval_status,
          caption, hashtags, cta, asset_url, scheduled_date, scheduled_time, metrics, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          title,
          description,
          pillar,
          platforms,
          status,
          approvalStatus,
          caption,
          hashtags,
          cta,
          assetUrl,
          scheduledDate,
          scheduledTime,
          metrics,
          now,
          now,
        ],
      });

      const inserted = await db.execute({ sql: "SELECT * FROM contents WHERE id = ?", args: [id] });
      const firstRow = inserted.rows[0];
      if (!firstRow) return jsonResponse({ error: "Creation failed" }, 500);

      return jsonResponse(rowToContent(firstRow, []), 201);
    }

    // 4. POST /api/contents/:id/comments
    const commentMatch = path.match(/^\/api\/contents\/([^/]+)\/comments$/);
    if (method === "POST" && commentMatch && commentMatch[1]) {
      const contentId = commentMatch[1];
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const commentId = "cm-" + crypto.randomUUID().slice(0, 8);
      const author = String(body["author"] || "Team Member");
      const message = String(body["message"] || "").trim();
      const now = new Date().toISOString();

      if (!message) {
        return jsonResponse({ error: "Comment message cannot be empty" }, 400);
      }

      await db.execute({
        sql: "INSERT INTO comments (id, content_id, author, message, created_at) VALUES (?, ?, ?, ?, ?)",
        args: [commentId, contentId, author, message, now],
      });

      const updatedContentRes = await db.execute({
        sql: "SELECT * FROM contents WHERE id = ?",
        args: [contentId],
      });
      const firstRow = updatedContentRes.rows[0];
      if (!firstRow) return jsonResponse({ error: "Content not found" }, 404);

      const comments = await getCommentsForContent(contentId);
      return jsonResponse(rowToContent(firstRow, comments));
    }

    // 5. GET / PATCH / DELETE for /api/contents/:id
    const contentItemMatch = path.match(/^\/api\/contents\/([^/]+)$/);
    if (contentItemMatch && contentItemMatch[1]) {
      const id = contentItemMatch[1];

      if (method === "GET") {
        const res = await db.execute({ sql: "SELECT * FROM contents WHERE id = ?", args: [id] });
        const row = res.rows[0];
        if (!row) return jsonResponse({ error: "Not found" }, 404);
        const comments = await getCommentsForContent(id);
        return jsonResponse(rowToContent(row, comments));
      }

      if (method === "PATCH") {
        const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        const now = new Date().toISOString();

        const updates: string[] = ["updated_at = ?"];
        const args: InValue[] = [now];

        const allowedFields = [
          "title",
          "description",
          "pillar",
          "status",
          "approval_status",
          "caption",
          "hashtags",
          "cta",
          "asset_url",
          "scheduled_date",
          "scheduled_time",
        ];

        for (const field of allowedFields) {
          if (field in body) {
            updates.push(`${field} = ?`);
            args.push((body[field] as InValue) ?? null);
          }
        }

        if ("platforms" in body) {
          updates.push("platforms = ?");
          args.push(JSON.stringify(body["platforms"]));
        }

        if ("metrics" in body) {
          updates.push("metrics = ?");
          args.push(JSON.stringify(body["metrics"]));
        }

        args.push(id);
        await db.execute({
          sql: `UPDATE contents SET ${updates.join(", ")} WHERE id = ?`,
          args,
        });

        const res = await db.execute({ sql: "SELECT * FROM contents WHERE id = ?", args: [id] });
        const row = res.rows[0];
        if (!row) return jsonResponse({ error: "Not found" }, 404);
        const comments = await getCommentsForContent(id);
        return jsonResponse(rowToContent(row, comments));
      }

      if (method === "DELETE") {
        await db.execute({ sql: "DELETE FROM comments WHERE content_id = ?", args: [id] });
        await db.execute({ sql: "DELETE FROM contents WHERE id = ?", args: [id] });
        return new Response(null, { status: 204 });
      }
    }

    // 6. GET /api/assets
    if (method === "GET" && path === "/api/assets") {
      const res = await db.execute("SELECT * FROM assets ORDER BY created_at DESC");
      const assets: Asset[] = res.rows.map((r) => ({
        id: String(r["id"]),
        title: String(r["title"]),
        url: String(r["url"]),
        provider: (r["provider"] as Asset["provider"]) || "google_drive",
        kind: String(r["kind"] ?? "Reference"),
        notes: String(r["notes"] ?? ""),
        status: String(r["status"] ?? "Linked"),
      }));
      return jsonResponse(assets);
    }

    // 7. POST /api/assets
    if (method === "POST" && path === "/api/assets") {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      const id = "ast-" + crypto.randomUUID().slice(0, 8);
      const title = String(body["title"] ?? "Untitled Asset");
      const urlStr = String(body["url"] ?? "");
      const provider = String(body["provider"] ?? "google_drive");
      const kind = String(body["kind"] ?? "Reference");
      const notes = String(body["notes"] ?? "");
      const now = new Date().toISOString();

      await db.execute({
        sql: "INSERT INTO assets (id, title, url, provider, kind, notes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        args: [id, title, urlStr, provider, kind, notes, "Active", now],
      });

      const newAsset: Asset = {
        id,
        title,
        url: urlStr,
        provider: provider as Asset["provider"],
        kind,
        notes,
        status: "Active",
      };
      return jsonResponse(newAsset, 201);
    }

    // 8. DELETE /api/assets/:id
    const assetItemMatch = path.match(/^\/api\/assets\/([^/]+)$/);
    if (method === "DELETE" && assetItemMatch && assetItemMatch[1]) {
      const id = assetItemMatch[1];
      await db.execute({ sql: "DELETE FROM assets WHERE id = ?", args: [id] });
      return new Response(null, { status: 204 });
    }

    // 9. GET /api/exports/content-plan (CSV / Spreadsheet export)
    if (method === "GET" && path === "/api/exports/content-plan") {
      const res = await db.execute(
        "SELECT * FROM contents ORDER BY scheduled_date ASC, created_at DESC",
      );
      const header = [
        "ID",
        "Title",
        "Pillar",
        "Platforms",
        "Status",
        "Scheduled Date",
        "Scheduled Time",
        "Caption",
        "Hashtags",
        "CTA",
      ];
      const escapeCsv = (val: unknown) => {
        const str = String(val ?? "");
        return `"${str.replaceAll('"', '""')}"`;
      };

      const rows: string[] = [header.join(",")];
      for (const row of res.rows) {
        let platformsStr = "";
        try {
          const parsed = JSON.parse(String(row["platforms"] ?? "[]"));
          platformsStr = Array.isArray(parsed) ? parsed.join("; ") : "";
        } catch {
          platformsStr = "";
        }

        const cols = [
          escapeCsv(row["id"]),
          escapeCsv(row["title"]),
          escapeCsv(row["pillar"]),
          escapeCsv(platformsStr),
          escapeCsv(row["status"]),
          escapeCsv(row["scheduled_date"]),
          escapeCsv(row["scheduled_time"]),
          escapeCsv(row["caption"]),
          escapeCsv(row["hashtags"]),
          escapeCsv(row["cta"]),
        ];
        rows.push(cols.join(","));
      }

      const csvContent = rows.join("\r\n");
      return new Response(csvContent, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="pixolve-content-plan.csv"',
        },
      });
    }

    return jsonResponse({ error: "Endpoint not found" }, 404);
  } catch (error) {
    console.error("API Router Error:", error);
    return jsonResponse({ error: "Internal Server Error", detail: String(error) }, 500);
  }
}
