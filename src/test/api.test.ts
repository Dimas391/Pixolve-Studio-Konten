import { describe, expect, it } from "vitest";
import { handleApiRequest } from "../server/api";

describe("Pixolve Studio Backend API & SQLite Database", () => {
  it("GET /api/dashboard returns summary stats and status counts", async () => {
    const req = new Request("http://localhost:8080/api/dashboard", { method: "GET" });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty("total_content");
    expect(data).toHaveProperty("published");
    expect(data).toHaveProperty("scheduled");
    expect(data).toHaveProperty("in_review");
    expect(data).toHaveProperty("content_by_status");
    expect(Array.isArray(data.content_by_status)).toBe(true);
    expect(Array.isArray(data.upcoming)).toBe(true);
  });

  it("GET /api/contents returns seeded contents with comments and metrics", async () => {
    const req = new Request("http://localhost:8080/api/contents", { method: "GET" });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(200);

    const contents = await res.json();
    expect(Array.isArray(contents)).toBe(true);
    expect(contents.length).toBeGreaterThan(0);

    const first = contents[0];
    expect(first).toHaveProperty("id");
    expect(first).toHaveProperty("title");
    expect(first).toHaveProperty("platforms");
    expect(first).toHaveProperty("metrics");
    expect(Array.isArray(first.comments)).toBe(true);
  });

  it("GET /api/contents supports filtering by status and pillar", async () => {
    const req = new Request("http://localhost:8080/api/contents?status=published&pillar=all", {
      method: "GET",
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(200);

    const contents = await res.json();
    expect(Array.isArray(contents)).toBe(true);
    for (const item of contents) {
      expect(item.status).toBe("published");
    }
  });

  it("POST, PATCH, and DELETE /api/contents performs full CRUD", async () => {
    // 1. Create
    const createReq = new Request("http://localhost:8080/api/contents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Konten Baru Vitest",
        description: "Deskripsi pengujian sistem backend",
        pillar: "Promosi",
        platforms: ["TikTok", "Instagram Reels"],
        status: "idea",
        caption: "Caption test",
      }),
    });
    const createRes = await handleApiRequest(createReq);
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.title).toBe("Test Konten Baru Vitest");
    expect(created.status).toBe("idea");
    const contentId = created.id;

    // 2. Add Comment
    const commentReq = new Request(`http://localhost:8080/api/contents/${contentId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        author: "Tester",
        message: "Catatan pengujian backend otomatis",
      }),
    });
    const commentRes = await handleApiRequest(commentReq);
    expect(commentRes.status).toBe(200);
    const commented = await commentRes.json();
    expect(commented.comments.length).toBeGreaterThanOrEqual(1);

    // 3. Update (PATCH)
    const patchReq = new Request(`http://localhost:8080/api/contents/${contentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "scheduled",
        scheduled_date: "2026-11-01",
        scheduled_time: "14:00",
      }),
    });
    const patchRes = await handleApiRequest(patchReq);
    expect(patchRes.status).toBe(200);
    const patched = await patchRes.json();
    expect(patched.status).toBe("scheduled");
    expect(patched.scheduled_date).toBe("2026-11-01");

    // 4. Delete
    const deleteReq = new Request(`http://localhost:8080/api/contents/${contentId}`, {
      method: "DELETE",
    });
    const deleteRes = await handleApiRequest(deleteReq);
    expect(deleteRes.status).toBe(204);

    // 5. Verify deleted
    const verifyReq = new Request(`http://localhost:8080/api/contents/${contentId}`, {
      method: "GET",
    });
    const verifyRes = await handleApiRequest(verifyReq);
    expect(verifyRes.status).toBe(404);
  });

  it("GET and POST /api/assets manages media assets", async () => {
    const createReq = new Request("http://localhost:8080/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Test Asset Link",
        url: "https://drive.google.com/test",
        provider: "google_drive",
        kind: "Design",
        notes: "Testing asset",
      }),
    });
    const createRes = await handleApiRequest(createReq);
    expect(createRes.status).toBe(201);
    const asset = await createRes.json();
    expect(asset.title).toBe("Test Asset Link");

    const getReq = new Request("http://localhost:8080/api/assets", { method: "GET" });
    const getRes = await handleApiRequest(getReq);
    expect(getRes.status).toBe(200);
    const assets = await getRes.json();
    expect(assets.some((a: { id: string }) => a.id === asset.id)).toBe(true);

    // Cleanup
    const delReq = new Request(`http://localhost:8080/api/assets/${asset.id}`, {
      method: "DELETE",
    });
    const delRes = await handleApiRequest(delReq);
    expect(delRes.status).toBe(204);
  });

  it("GET /api/exports/content-plan returns valid CSV data", async () => {
    const req = new Request("http://localhost:8080/api/exports/content-plan?format=csv", {
      method: "GET",
    });
    const res = await handleApiRequest(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const csv = await res.text();
    expect(csv).toContain("ID,Title,Pillar");
  });
});
