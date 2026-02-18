import { assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { applyAiNarrativeRewrite } from "../../reporting/ai_narrative.ts";

const baseRequest = {
  mode: "off" as const,
  model: "gpt-4o-mini",
  headlineLead: "Deterministic headline lead.",
  topHighlightWording: ["Highlight one.", "Highlight two."],
  weeklyPointLeads: ["Point one.", "Point two."],
  context: {
    startDate: "2026-02-01T00:00:00Z",
    endDate: "2026-02-16T23:59:59Z",
    fetchMode: "all_contributions",
    reportProfile: "activity_retro" as const,
  },
  payload: {
    highlights: [{
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
    }, {
      provider: "gitlab" as const,
      key: "GL-2",
      title: "Title two",
      state: "opened",
      bucket: "blocked" as const,
      impactScore: 14,
      updatedAt: "2026-02-15T10:30:00Z",
      userCommentCount: 0,
      isAuthoredByUser: false,
      isAssignedToUser: true,
      isCommentedByUser: false,
      labels: ["ops"],
      descriptionSnippet: "Snippet two",
    }],
    collaboration: [],
    risks: [{
      provider: "jira" as const,
      key: "J-7",
      title: "Risk issue",
      state: "In Progress",
      bucket: "blocked" as const,
      impactScore: 10,
      updatedAt: "2026-02-14T09:00:00Z",
      userCommentCount: 0,
      isAuthoredByUser: false,
      isAssignedToUser: false,
      isCommentedByUser: false,
      labels: ["risk"],
      descriptionSnippet: "Risk snippet",
    }],
  },
};

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

const parseCallMeta = (
  init: RequestInit | undefined,
): {
  taskKind: string;
  taskIndex: number | null;
  hasResponseFormat: boolean;
} => {
  const body = JSON.parse(String(init?.body ?? "{}")) as {
    messages?: Array<{ content?: string }>;
    response_format?: unknown;
  };

  const userPrompt = body.messages?.[1]?.content;
  const promptPayload = typeof userPrompt === "string"
    ? JSON.parse(userPrompt) as { taskKind?: string; taskIndex?: number | null }
    : {};

  return {
    taskKind: promptPayload.taskKind ?? "unknown",
    taskIndex: promptPayload.taskIndex ?? null,
    hasResponseFormat: body.response_format !== undefined,
  };
};

Deno.test("applyAiNarrativeRewrite returns deterministic text when mode is off", async () => {
  const result = await applyAiNarrativeRewrite(baseRequest);

  assertEquals(result.headlineLead, baseRequest.headlineLead);
  assertEquals(result.topHighlightWording, baseRequest.topHighlightWording);
  assertEquals(result.weeklyPointLeads, baseRequest.weeklyPointLeads);
  assertEquals(result.assisted.headline, false);
  assertEquals(result.assisted.highlights, false);
  assertEquals(result.assisted.weeklyTalkingPoints, false);
});

Deno.test("applyAiNarrativeRewrite requires OPENAI_API_KEY when mode is on", async () => {
  await assertRejects(
    () =>
      applyAiNarrativeRewrite({
        ...baseRequest,
        mode: "on",
      }),
    Error,
    "OPENAI_API_KEY",
  );
});

Deno.test("applyAiNarrativeRewrite performs sequential per-task rewrites with expected call order", async () => {
  const originalFetch = globalThis.fetch;
  const callOrder: string[] = [];

  try {
    const outputs = [
      "AI lead",
      "AI highlight one",
      "AI highlight two",
      "AI point one",
      "AI point two",
    ];

    globalThis.fetch = ((_input, init) => {
      const meta = parseCallMeta(init);
      callOrder.push(`${meta.taskKind}:${meta.taskIndex ?? "null"}`);
      assertEquals(meta.hasResponseFormat, false);

      const current = outputs[callOrder.length - 1];
      return Promise.resolve(aiResponse(current));
    }) as typeof fetch;

    const result = await applyAiNarrativeRewrite({
      ...baseRequest,
      mode: "auto",
      apiKey: "fake-key",
    });

    assertEquals(result.headlineLead, "AI lead");
    assertEquals(result.topHighlightWording, [
      "AI highlight one",
      "AI highlight two",
    ]);
    assertEquals(result.weeklyPointLeads, ["AI point one", "AI point two"]);
    assertEquals(result.assisted.headline, true);
    assertEquals(result.assisted.highlights, true);
    assertEquals(result.assisted.weeklyTalkingPoints, true);

    const expectedCalls = 1 +
      baseRequest.topHighlightWording.length +
      baseRequest.weeklyPointLeads.length;
    assertEquals(callOrder.length, expectedCalls);
    assertEquals(callOrder, [
      "headline:null",
      "highlight:0",
      "highlight:1",
      "weeklyPoint:0",
      "weeklyPoint:1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("applyAiNarrativeRewrite falls back per-item in auto mode when one task fails", async () => {
  const originalFetch = globalThis.fetch;
  const callOrder: string[] = [];

  try {
    globalThis.fetch = ((_input, init) => {
      const meta = parseCallMeta(init);
      callOrder.push(`${meta.taskKind}:${meta.taskIndex ?? "null"}`);

      if (callOrder.length === 1) return Promise.resolve(aiResponse("AI lead"));
      if (callOrder.length === 2) {
        return Promise.resolve(aiResponse("AI highlight one"));
      }
      if (callOrder.length === 3) {
        return Promise.resolve(aiErrorResponse(500, "highlight failure"));
      }
      if (callOrder.length === 4) {
        return Promise.resolve(aiResponse("AI point one"));
      }
      return Promise.resolve(aiResponse("AI point two"));
    }) as typeof fetch;

    const result = await applyAiNarrativeRewrite({
      ...baseRequest,
      mode: "auto",
      apiKey: "fake-key",
    });

    assertEquals(result.headlineLead, "AI lead");
    assertEquals(result.topHighlightWording[0], "AI highlight one");
    assertEquals(
      result.topHighlightWording[1],
      baseRequest.topHighlightWording[1],
    );
    assertEquals(result.weeklyPointLeads, ["AI point one", "AI point two"]);
    assertEquals(result.assisted.headline, true);
    assertEquals(result.assisted.highlights, true);
    assertEquals(result.assisted.weeklyTalkingPoints, true);
    assertEquals(callOrder, [
      "headline:null",
      "highlight:0",
      "highlight:1",
      "weeklyPoint:0",
      "weeklyPoint:1",
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("applyAiNarrativeRewrite fails fast in on mode with task-context error", async () => {
  const originalFetch = globalThis.fetch;
  const callOrder: string[] = [];

  try {
    globalThis.fetch = ((_input, init) => {
      const meta = parseCallMeta(init);
      callOrder.push(`${meta.taskKind}:${meta.taskIndex ?? "null"}`);

      if (callOrder.length === 1) return Promise.resolve(aiResponse("AI lead"));
      if (callOrder.length === 2) {
        return Promise.resolve(aiResponse("AI highlight one"));
      }
      return Promise.resolve(aiErrorResponse(429, "quota exceeded"));
    }) as typeof fetch;

    await assertRejects(
      () =>
        applyAiNarrativeRewrite({
          ...baseRequest,
          mode: "on",
          apiKey: "fake-key",
        }),
      Error,
      "AI rewrite failed for highlight[2]",
    );

    assertEquals(callOrder, ["headline:null", "highlight:0", "highlight:1"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("applyAiNarrativeRewrite sanitizes wrapped output and rejects empty rewrite text", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((_input, init) => {
      const meta = parseCallMeta(init);
      const key = `${meta.taskKind}:${meta.taskIndex ?? "null"}`;

      if (key === "headline:null") {
        return Promise.resolve(aiResponse("```text\nAI lead wrapped\n```"));
      }
      if (key === "highlight:0") {
        return Promise.resolve(aiResponse('"AI highlight one"'));
      }
      if (key === "highlight:1") {
        return Promise.resolve(aiResponse("   \n   "));
      }
      if (key === "weeklyPoint:0") {
        return Promise.resolve(aiResponse("- AI point one"));
      }
      return Promise.resolve(aiResponse("`AI point two`"));
    }) as typeof fetch;

    const result = await applyAiNarrativeRewrite({
      ...baseRequest,
      mode: "auto",
      apiKey: "fake-key",
    });

    assertEquals(result.headlineLead, "AI lead wrapped");
    assertEquals(result.topHighlightWording[0], "AI highlight one");
    assertEquals(
      result.topHighlightWording[1],
      baseRequest.topHighlightWording[1],
    );
    assertEquals(result.weeklyPointLeads, ["AI point one", "AI point two"]);
    assertEquals(result.assisted.headline, true);
    assertEquals(result.assisted.highlights, true);
    assertEquals(result.assisted.weeklyTalkingPoints, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("applyAiNarrativeRewrite includes task information in prompt payload", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = ((_input, init) => {
      const meta = parseCallMeta(init);
      assertStringIncludes(
        ["headline", "highlight", "weeklyPoint"].join(","),
        meta.taskKind,
      );
      return Promise.resolve(aiResponse("same text"));
    }) as typeof fetch;

    await applyAiNarrativeRewrite({
      ...baseRequest,
      mode: "auto",
      apiKey: "fake-key",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
