import { assertEquals } from "@std/assert";
import { gitlabIssues } from "../../providers/gitlab.ts";

const makeJsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

Deno.test("gitlabIssues returns contributor issues for all_contributions mode", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;
      const parsed = new URL(url);
      const page = parsed.searchParams.get("page");

      if (url.endsWith("/api/v4/user")) {
        return Promise.resolve(makeJsonResponse({ id: 7, username: "me" }));
      }

      if (
        parsed.pathname === "/api/v4/users/7/contributed_projects" &&
        page === "1"
      ) {
        return Promise.resolve(makeJsonResponse([{ id: 101 }]));
      }

      if (
        parsed.pathname === "/api/v4/users/7/contributed_projects" &&
        page === "2"
      ) {
        return Promise.resolve(makeJsonResponse([]));
      }

      if (
        parsed.pathname === "/api/v4/projects/101/issues" &&
        url.includes("updated_after") &&
        page === "1"
      ) {
        return Promise.resolve(makeJsonResponse([
          {
            id: 5001,
            iid: 12,
            project_id: 101,
            author: { id: 99, username: "other" },
            assignees: [],
          },
        ]));
      }

      if (
        parsed.pathname === "/api/v4/projects/101/issues" &&
        url.includes("updated_after") &&
        page === "2"
      ) {
        return Promise.resolve(makeJsonResponse([]));
      }

      if (
        parsed.pathname === "/api/v4/projects/101/issues/12/notes" &&
        page === "1"
      ) {
        return Promise.resolve(makeJsonResponse([
          { id: 1, author: { id: 7, username: "me" }, body: "contribution" },
        ]));
      }

      if (
        parsed.pathname === "/api/v4/projects/101/issues/12/notes" &&
        page === "2"
      ) {
        return Promise.resolve(makeJsonResponse([]));
      }

      return Promise.resolve(makeJsonResponse({}, 404));
    }) as typeof fetch;

    const issues = await gitlabIssues(
      "https://gitlab.example.com",
      { "PRIVATE-TOKEN": "token" },
      "2026-02-01T00:00:00.000Z",
      "2026-02-16T23:59:59.999Z",
    );

    assertEquals(issues.length, 1);
    assertEquals(issues[0].id, 5001);
    assertEquals(Array.isArray(issues[0].notes), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
