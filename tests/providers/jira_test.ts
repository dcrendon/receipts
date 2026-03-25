import { assertEquals, assertRejects } from "@std/assert";
import { jiraIssues } from "../../providers/jira.ts";

const makeJsonResponse = (body: unknown, status = 200): Response => {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
};

Deno.test("jiraIssues returns filtered contribution issues with comments", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

      if (url.includes("/rest/api/2/search")) {
        return Promise.resolve(makeJsonResponse({
          total: 2,
          issues: [
            {
              key: "ABC-1",
              fields: {
                assignee: { displayName: "nobody" },
                reporter: { displayName: "nobody" },
              },
            },
            {
              key: "ABC-2",
              fields: {
                assignee: { displayName: "my.user" },
                reporter: { displayName: "nobody" },
              },
            },
          ],
        }));
      }

      if (url.includes("/rest/api/2/issue/ABC-1/comment")) {
        return Promise.resolve(makeJsonResponse({
          comments: [{
            author: { displayName: "my.user" },
            body: "I touched this",
          }],
        }));
      }

      if (url.includes("/rest/api/2/issue/ABC-2/comment")) {
        return Promise.resolve(makeJsonResponse({
          comments: [{
            author: { displayName: "someone.else" },
            body: "other",
          }],
        }));
      }

      return Promise.resolve(makeJsonResponse({}, 404));
    }) as typeof fetch;

    const issues = await jiraIssues(
      "https://jira.example.com",
      { Authorization: "Bearer token", "Content-Type": "application/json" },
      "my.user",
      "2026-02-01T00:00:00.000Z",
      "2026-02-16T23:59:59.999Z",
    );

    assertEquals(issues.length, 2);
    assertEquals(Array.isArray(issues[0].notes), true);
    assertEquals(Array.isArray(issues[1].notes), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("jiraIssues throws when search request fails", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((input: string | URL | Request) => {
      const url = typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : input.url;

      if (url.includes("/rest/api/2/search")) {
        return Promise.resolve(makeJsonResponse({ message: "error" }, 500));
      }

      return Promise.resolve(makeJsonResponse({}, 404));
    }) as typeof fetch;

    await assertRejects(
      () =>
        jiraIssues(
          "https://jira.example.com",
          { Authorization: "Bearer token", "Content-Type": "application/json" },
          "my.user",
          "2026-02-01T00:00:00.000Z",
          "2026-02-16T23:59:59.999Z",
        ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
