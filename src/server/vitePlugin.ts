import type { Plugin } from "vite";
import { handleApiRequest } from "./api";

export function pixolveApiPlugin(): Plugin {
  return {
    name: "pixolve-api-backend",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const urlString = req.url ?? "";
        if (!urlString.startsWith("/api")) {
          return next();
        }

        try {
          const protocol = req.headers["x-forwarded-proto"] || "http";
          const host = req.headers.host || "localhost:8080";
          const fullUrl = new URL(urlString, `${protocol}://${host}`);

          let bodyBuffer: Buffer | undefined;
          if (req.method !== "GET" && req.method !== "HEAD") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
            }
            if (chunks.length > 0) {
              bodyBuffer = Buffer.concat(chunks);
            }
          }

          const headers = new Headers();
          for (const [key, val] of Object.entries(req.headers)) {
            if (val !== undefined) {
              if (Array.isArray(val)) {
                for (const v of val) headers.append(key, v);
              } else {
                headers.set(key, val);
              }
            }
          }

          const requestInit: RequestInit = {
            method: req.method || "GET",
            headers,
          };
          if (bodyBuffer) {
            requestInit.body = new Uint8Array(bodyBuffer);
          }

          const webRequest = new Request(fullUrl.toString(), requestInit);

          const webResponse = await handleApiRequest(webRequest);

          res.statusCode = webResponse.status;
          webResponse.headers.forEach((val, key) => {
            res.setHeader(key, val);
          });

          if (webResponse.body) {
            const arrayBuffer = await webResponse.arrayBuffer();
            res.end(Buffer.from(arrayBuffer));
          } else {
            res.end();
          }
        } catch (error) {
          console.error("Vite API plugin error:", error);
          if (!res.headersSent) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Internal Server Error", detail: String(error) }));
          } else {
            res.end();
          }
        }
      });
    },
  };
}
