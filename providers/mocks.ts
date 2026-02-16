type MockProvider = "gitlab" | "jira" | "github";

export const loadMockIssues = async (
  provider: MockProvider,
  mockDataDir?: string,
) => {
  const fixturesDir = mockDataDir ?? "fixtures";
  const path = `${fixturesDir}/${provider}_issues.mock.json`;
  const raw = await Deno.readTextFile(path);
  const data = JSON.parse(raw);

  if (!Array.isArray(data)) {
    throw new Error(`Mock fixture must be an array: ${path}`);
  }

  return data;
};
