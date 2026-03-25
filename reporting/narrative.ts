import { NormalizedIssue, ReportSummary } from "./normalizer.ts";

export interface NarrativeResult {
  themes: string[];
  accomplishments: string[];
  summary: string;
}

interface NarrativeContext {
  startDate: string;
  endDate: string;
}

interface IssuePayloadItem {
  key: string;
  title: string;
  state: string;
  bucket: string;
  labels: string[];
  descriptionSnippet: string;
  userCommentCount: number;
  isAuthoredByUser: boolean;
  isAssignedToUser: boolean;
  project: string;
}

const buildPrompt = (
  items: IssuePayloadItem[],
  summary: ReportSummary,
  context: NarrativeContext,
): string => {
  const statsLine =
    `Total: ${summary.totalIssues} issues — completed: ${summary.byBucket.completed}, active: ${summary.byBucket.active}, blocked: ${summary.byBucket.blocked}.`;

  return `You are a work activity summarizer. Given a developer's issue activity, return ONLY valid JSON with exactly three fields:
- "themes": array of 2-3 short theme strings (e.g. "Auth system refactor", "Bug triage")
- "accomplishments": array of up to 6 bullet-point strings describing key achievements
- "summary": a single short paragraph (2-4 sentences max) suitable for a standup or performance review

Base everything only on the provided data. Be specific — use issue titles, project names, and actual counts. Do not invent or embellish.

Period: ${context.startDate} to ${context.endDate}
${statsLine}

Issues (top ${items.length} by recency):
${JSON.stringify(items, null, 2)}

Return ONLY the JSON object, no markdown, no prose outside the JSON.`;
};

const extractJson = (text: string): string => {
  // Try to extract JSON from markdown code block if present
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  // Try to find raw JSON object
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];

  return text.trim();
};

export const generateNarrative = async (
  issues: NormalizedIssue[],
  summary: ReportSummary,
  context: NarrativeContext,
  geminiApiKey: string,
): Promise<NarrativeResult> => {
  // Sort by recency, take top 50
  const sorted = [...issues].sort((a, b) => {
    const aMs = Date.parse(a.updatedAt) || 0;
    const bMs = Date.parse(b.updatedAt) || 0;
    return bMs - aMs;
  });

  const items: IssuePayloadItem[] = sorted.slice(0, 50).map((issue) => ({
    key: issue.key,
    title: issue.title,
    state: issue.state,
    bucket: issue.bucket,
    labels: issue.labels,
    descriptionSnippet: issue.descriptionSnippet,
    userCommentCount: issue.userCommentCount,
    isAuthoredByUser: issue.isAuthoredByUser,
    isAssignedToUser: issue.isAssignedToUser,
    project: issue.project,
  }));

  const model = "gemini-3-flash-preview";
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": geminiApiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: buildPrompt(items, summary, context) }],
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Gemini API error ${response.status}: ${body}`,
    );
  }

  const data = await response.json() as {
    candidates: Array<{
      content: { parts: Array<{ text: string }> };
    }>;
  };

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const jsonStr = extractJson(rawText);
  const parsed = JSON.parse(jsonStr) as NarrativeResult;

  return {
    themes: Array.isArray(parsed.themes) ? parsed.themes : [],
    accomplishments: Array.isArray(parsed.accomplishments)
      ? parsed.accomplishments
      : [],
    summary: typeof parsed.summary === "string" ? parsed.summary : "",
  };
};
