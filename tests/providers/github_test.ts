import { assertEquals } from "@std/assert";
import { githubIssues } from "../../providers/github.ts";

const makeJsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

Deno.test("githubIssues enriches issues with comments and metadata", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

      if (url.includes("/search/issues")) {
        const parsed = new URL(url);
        const page = parsed.searchParams.get("page");
        const query = parsed.searchParams.get("q") ?? "";

        if (query.includes("involves:mock.user") && page === "1") {
          return Promise.resolve(makeJsonResponse({
            total_count: 1,
            items: [
              {
                id: 8001,
                number: 42,
                title: "Test issue",
                state: "open",
                created_at: "2026-02-10T00:00:00Z",
                updated_at: "2026-02-12T00:00:00Z",
                repository_url: "https://api.github.com/repos/acme/tool",
                labels: [{ name: "bug" }],
                assignees: [{ login: "mock.user" }],
                milestone: { title: "Sprint 1" },
                comments: 1,
                comments_url:
                  "https://api.github.com/repos/acme/tool/issues/42/comments",
              },
            ],
          }));
        }

        return Promise.resolve(makeJsonResponse({ total_count: 1, items: [] }));
      }

      if (url.includes("/issues/42/comments")) {
        const parsed = new URL(url);
        const page = parsed.searchParams.get("page");
        if (page === "1") {
          return Promise.resolve(makeJsonResponse([
            {
              id: 1,
              body: "Looks good",
              user: { login: "mock.user" },
            },
          ]));
        }
        return Promise.resolve(makeJsonResponse([]));
      }

      return Promise.resolve(makeJsonResponse({}, 404));
    }) as typeof fetch;

    const issues = await githubIssues(
      "https://api.github.com",
      {
        "Authorization": "Bearer token",
        "Accept": "application/vnd.github+json",
      },
      "mock.user",
      "2026-02-01T00:00:00.000Z",
      "2026-02-16T23:59:59.999Z",
    );

    assertEquals(issues.length, 1);
    assertEquals(issues[0].number, 42);
    assertEquals(Array.isArray(issues[0].notes), true);
    assertEquals(issues[0].metadata?.repository, "acme/tool");
    assertEquals(issues[0].metadata?.labelNames?.[0], "bug");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
