import { assertEquals, assertStringIncludes } from "@std/assert";
import { rewriteHeadline } from "../../reporting/ai_narrative.ts";

const aiResponse = (content: string): Response => {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    {
      status: 200,
      headers: { "content-type": "application/json" },
    },
  );
};

const aiErrorResponse = (status: number, message: string): Response => {
  return new Response(
    JSON.stringify({ error: { message } }),
    {
      status,
      headers: { "content-type": "application/json" },
    },
  );
};

Deno.test("rewriteHeadline returns unchanged text when no API key is provided", async () => {
  const result = await rewriteHeadline("Deterministic headline lead.", {
    model: "gpt-4o-mini",
    apiKey: undefined,
    startDate: "2026-02-01T00:00:00Z",
    endDate: "2026-02-16T23:59:59Z",
    topIssues: [],
  });

  assertEquals(result.headlineLead, "Deterministic headline lead.");
  assertEquals(result.assisted, false);
});

Deno.test("rewriteHeadline rewrites when API key is provided", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (() => {
      return Promise.resolve(aiResponse("AI rewritten headline"));
    }) as typeof fetch;

    const result = await rewriteHeadline("Deterministic headline lead.", {
      model: "gpt-4o-mini",
      apiKey: "fake-key",
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-16T23:59:59Z",
      topIssues: [{
        provider: "github" as const,
        key: "GH-1",
        title: "Title one",
        state: "open",
        bucket: "active" as const,
        impactScore: 20,
        updatedAt: "2026-02-16T00:00:00Z",
        userCommentCount: 1,
        isAuthoredByUser: true,
        isAssignedToUser: false,
        isCommentedByUser: true,
        labels: ["p1"],
        descriptionSnippet: "Snippet one",
      }],
    });

    assertEquals(result.headlineLead, "AI rewritten headline");
    assertEquals(result.assisted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("rewriteHeadline falls back gracefully on API error", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (() => {
      return Promise.resolve(aiErrorResponse(500, "server error"));
    }) as typeof fetch;

    const result = await rewriteHeadline("Deterministic headline lead.", {
      model: "gpt-4o-mini",
      apiKey: "fake-key",
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-16T23:59:59Z",
      topIssues: [],
    });

    assertEquals(result.headlineLead, "Deterministic headline lead.");
    assertEquals(result.assisted, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("rewriteHeadline sanitizes wrapped output", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (() => {
      return Promise.resolve(aiResponse("```text\nAI lead wrapped\n```"));
    }) as typeof fetch;

    const result = await rewriteHeadline("Original headline.", {
      model: "gpt-4o-mini",
      apiKey: "fake-key",
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-16T23:59:59Z",
      topIssues: [],
    });

    assertEquals(result.headlineLead, "AI lead wrapped");
    assertEquals(result.assisted, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("rewriteHeadline includes context in prompt payload", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((_input, init) => {
      const rawBody = (init as Record<string, unknown>)?.body;
      const body = JSON.parse(String(rawBody ?? "{}")) as {
        messages?: Array<{ content?: string }>;
      };
      const userPrompt = body.messages?.[1]?.content ?? "";
      assertStringIncludes(userPrompt, "sourceText");
      assertStringIncludes(userPrompt, "issueKeys");
      return Promise.resolve(aiResponse("same text"));
    }) as typeof fetch;

    await rewriteHeadline("Test headline.", {
      model: "gpt-4o-mini",
      apiKey: "fake-key",
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-16T23:59:59Z",
      topIssues: [],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
