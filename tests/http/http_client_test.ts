import { assertEquals, assertRejects } from "@std/assert";
import { requestJsonWithRetry } from "../../providers/http_client.ts";

const jsonResponse = (
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response => {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: {
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
};

Deno.test("requestJsonWithRetry retries transient failures then succeeds", async () => {
  let callCount = 0;
  const sleepCalls: number[] = [];

  const data = await requestJsonWithRetry<{ ok: boolean }>(
    "https://api.example.com/test",
    { method: "GET" },
    "test",
    {
      fetchFn: () => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve(
            jsonResponse({ message: "fail" }, { status: 500 }),
          );
        }
        return Promise.resolve(jsonResponse({ ok: true }));
      },
      sleepFn: (ms) => {
        sleepCalls.push(ms);
        return Promise.resolve();
      },
      baseDelayMs: 25,
      maxRetries: 3,
    },
  );

  assertEquals(callCount, 3);
  assertEquals(sleepCalls, [25, 50]);
  assertEquals(data.ok, true);
});

Deno.test("requestJsonWithRetry respects Retry-After for rate limits", async () => {
  const sleepCalls: number[] = [];
  let callCount = 0;

  const data = await requestJsonWithRetry<{ ok: boolean }>(
    "https://api.example.com/rate-limited",
    { method: "GET" },
    "rate-limited-test",
    {
      fetchFn: () => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(
            jsonResponse(
              { message: "slow down" },
              { status: 429, headers: { "retry-after": "2" } },
            ),
          );
        }
        return Promise.resolve(jsonResponse({ ok: true }));
      },
      sleepFn: (ms) => {
        sleepCalls.push(ms);
        return Promise.resolve();
      },
      baseDelayMs: 25,
      maxRetries: 3,
    },
  );

  assertEquals(callCount, 2);
  assertEquals(sleepCalls, [2000]);
  assertEquals(data.ok, true);
});

Deno.test("requestJsonWithRetry throws after retries are exhausted", async () => {
  let callCount = 0;
  const sleepCalls: number[] = [];

  await assertRejects(
    () =>
      requestJsonWithRetry(
        "https://api.example.com/fail",
        { method: "GET" },
        "failure-test",
        {
          fetchFn: () => {
            callCount++;
            return Promise.resolve(
              jsonResponse({ message: "always fail" }, { status: 500 }),
            );
          },
          sleepFn: (ms) => {
            sleepCalls.push(ms);
            return Promise.resolve();
          },
          baseDelayMs: 10,
          maxRetries: 2,
        },
      ),
  );

  assertEquals(callCount, 3);
  assertEquals(sleepCalls, [10, 20]);
});
