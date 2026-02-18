import { AiNarrativeMode, ReportProfile } from "../shared/types.ts";
import type { ReportIssueView } from "./reporting.ts";

interface AiNarrativeIssuePayload {
  key: string;
  title: string;
  state: string;
  bucket: string;
  labels: string[];
  updatedAt: string;
  commentCount: number;
  impactScore: number;
  descriptionSnippet: string;
}

interface AiNarrativeRequest {
  mode: AiNarrativeMode;
  model: string;
  apiKey?: string;
  headlineLead: string;
  topHighlightWording: string[];
  weeklyPointLeads: string[];
  context: {
    startDate: string;
    endDate: string;
    fetchMode: string;
    reportProfile: ReportProfile;
  };
  payload: {
    highlights: ReportIssueView[];
    collaboration: ReportIssueView[];
    risks: ReportIssueView[];
  };
}

export interface AiNarrativeResult {
  headlineLead: string;
  topHighlightWording: string[];
  weeklyPointLeads: string[];
  assisted: {
    headline: boolean;
    highlights: boolean;
    weeklyTalkingPoints: boolean;
  };
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

type AiRewriteTaskKind = "headline" | "highlight" | "weeklyPoint";

interface AiRewriteTask {
  kind: AiRewriteTaskKind;
  sourceText: string;
  index?: number;
  issueContext?: AiNarrativeIssuePayload;
  supportingContext?: Record<string, unknown>;
}

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

const REWRITE_SYSTEM_PROMPT =
  "You rewrite one status-report narrative line. Rewrite wording only. Preserve factual meaning exactly. Do not add new facts, counts, dates, issue keys, providers, or states. Return plain text only with no JSON, no markdown, and no bullet prefix.";

const truncateSnippet = (value: string): string => {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 280) return cleaned;
  return `${cleaned.slice(0, 277)}...`;
};

const toIssuePayload = (issue: ReportIssueView): AiNarrativeIssuePayload => ({
  key: issue.key,
  title: issue.title,
  state: issue.state,
  bucket: issue.bucket,
  labels: issue.labels,
  updatedAt: issue.updatedAt,
  commentCount: issue.userCommentCount,
  impactScore: issue.impactScore,
  descriptionSnippet: truncateSnippet(issue.descriptionSnippet),
});

const fallbackResult = (request: AiNarrativeRequest): AiNarrativeResult => ({
  headlineLead: request.headlineLead,
  topHighlightWording: request.topHighlightWording,
  weeklyPointLeads: request.weeklyPointLeads,
  assisted: {
    headline: false,
    highlights: false,
    weeklyTalkingPoints: false,
  },
});

const extractTextContent = (value: string): string => {
  const trimmed = value.trim();

  const blockMatch = trimmed.match(/```(?:[a-z0-9_-]+)?\s*([\s\S]*?)\s*```/i);
  if (blockMatch?.[1]) {
    return blockMatch[1].trim();
  }

  return trimmed;
};

const sanitizeRewriteText = (value: string): string => {
  let cleaned = extractTextContent(value);
  cleaned = cleaned.replace(/\r?\n+/g, " ").trim();
  cleaned = cleaned.replace(/^[-*•]\s+/, "").trim();

  const wrappedByQuote = (left: string, right: string) =>
    cleaned.startsWith(left) && cleaned.endsWith(right) && cleaned.length >= 2;

  if (
    wrappedByQuote('"', '"') || wrappedByQuote("'", "'") ||
    wrappedByQuote("`", "`")
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  if (!cleaned) {
    throw new Error("OpenAI response rewrite text was empty.");
  }

  return cleaned;
};

const summarizeIssueKeys = (issues: ReportIssueView[]): string[] =>
  issues.slice(0, 6).map((issue) => issue.key);

const buildRewritePrompt = (
  request: AiNarrativeRequest,
  task: AiRewriteTask,
): string => {
  const shared = {
    context: request.context,
    taskKind: task.kind,
    taskIndex: task.index ?? null,
    sourceText: task.sourceText,
    rules: [
      "Rewrite wording only.",
      "Keep factual meaning unchanged.",
      "Do not add/remove issue references, counts, dates, or state facts.",
      "Keep output concise and executive-friendly.",
      "Return plain text only.",
    ],
  };

  if (task.kind === "headline") {
    return JSON.stringify(
      {
        ...shared,
        supportingContext: {
          topHighlightKeys: summarizeIssueKeys(request.payload.highlights),
          collaborationKeys: summarizeIssueKeys(request.payload.collaboration),
          riskKeys: summarizeIssueKeys(request.payload.risks),
        },
      },
      null,
      2,
    );
  }

  if (task.kind === "highlight") {
    return JSON.stringify(
      {
        ...shared,
        issueContext: task.issueContext,
      },
      null,
      2,
    );
  }

  const payload = {
    ...shared,
    supportingContext: {
      topHighlightKeys: summarizeIssueKeys(request.payload.highlights),
      collaborationKeys: summarizeIssueKeys(request.payload.collaboration),
      riskKeys: summarizeIssueKeys(request.payload.risks),
      ...task.supportingContext,
    },
  };

  return JSON.stringify(payload, null, 2);
};

const taskLabel = (task: AiRewriteTask): string => {
  if (task.index === undefined) {
    return task.kind;
  }
  return `${task.kind}[${task.index + 1}]`;
};

const rewriteTextWithOpenAI = async (
  request: AiNarrativeRequest,
  task: AiRewriteTask,
): Promise<string> => {
  const prompt = buildRewritePrompt(request, task);

  const response = await fetch(OPENAI_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify({
      model: request.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: REWRITE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    let details = "";
    try {
      const errorBody = await response.json() as {
        error?: { message?: string; type?: string; code?: string };
      };
      if (errorBody?.error) {
        const code = errorBody.error.code
          ? ` code=${errorBody.error.code}`
          : "";
        const type = errorBody.error.type
          ? ` type=${errorBody.error.type}`
          : "";
        const message = errorBody.error.message
          ? ` message=${errorBody.error.message}`
          : "";
        details = `${code}${type}${message}`.trim();
      }
    } catch {
      // ignore JSON parsing errors on non-JSON responses
    }

    const suffix = details ? ` ${details}` : "";
    throw new Error(
      `OpenAI request failed (${response.status}) using model "${request.model}".${suffix}`,
    );
  }

  const body = await response.json() as OpenAIChatResponse;
  const content = body.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI response did not include message content.");
  }

  return sanitizeRewriteText(content);
};

const runRewriteTask = async (
  request: AiNarrativeRequest,
  task: AiRewriteTask,
): Promise<string | undefined> => {
  try {
    return await rewriteTextWithOpenAI(request, task);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (request.mode === "on") {
      throw new Error(`AI rewrite failed for ${taskLabel(task)}: ${message}`);
    }

    console.warn(`AI rewrite skipped for ${taskLabel(task)}: ${message}`);
    return undefined;
  }
};

const rewriteWithOpenAI = async (
  request: AiNarrativeRequest,
): Promise<AiNarrativeResult> => {
  let headlineLead = request.headlineLead;
  const topHighlightWording = [...request.topHighlightWording];
  const weeklyPointLeads = [...request.weeklyPointLeads];

  const rewrittenHeadline = await runRewriteTask(request, {
    kind: "headline",
    sourceText: request.headlineLead,
  });
  if (rewrittenHeadline !== undefined) {
    headlineLead = rewrittenHeadline;
  }

  for (let index = 0; index < topHighlightWording.length; index++) {
    const issue = request.payload.highlights[index];
    const rewritten = await runRewriteTask(request, {
      kind: "highlight",
      index,
      sourceText: topHighlightWording[index],
      issueContext: issue ? toIssuePayload(issue) : undefined,
    });
    if (rewritten !== undefined) {
      topHighlightWording[index] = rewritten;
    }
  }

  for (let index = 0; index < weeklyPointLeads.length; index++) {
    const rewritten = await runRewriteTask(request, {
      kind: "weeklyPoint",
      index,
      sourceText: weeklyPointLeads[index],
      supportingContext: {
        relatedHighlightKey: request.payload.highlights[index]?.key ?? null,
        relatedRiskKey: request.payload.risks[index]?.key ?? null,
      },
    });
    if (rewritten !== undefined) {
      weeklyPointLeads[index] = rewritten;
    }
  }

  return {
    headlineLead,
    topHighlightWording,
    weeklyPointLeads,
    assisted: {
      headline: headlineLead !== request.headlineLead,
      highlights: topHighlightWording.some((line, index) =>
        line !== request.topHighlightWording[index]
      ),
      weeklyTalkingPoints: weeklyPointLeads.some((line, index) =>
        line !== request.weeklyPointLeads[index]
      ),
    },
  };
};

export const applyAiNarrativeRewrite = async (
  request: AiNarrativeRequest,
): Promise<AiNarrativeResult> => {
  if (request.mode === "off") {
    return fallbackResult(request);
  }

  if (!request.apiKey) {
    if (request.mode === "on") {
      throw new Error(
        "AI narrative mode is `on` but OPENAI_API_KEY is missing. Set OPENAI_API_KEY or set AI_NARRATIVE=off.",
      );
    }
    return fallbackResult(request);
  }

  try {
    return await rewriteWithOpenAI(request);
  } catch (error) {
    if (request.mode === "on") {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    console.warn(`AI narrative rewrite skipped: ${message}`);
    return fallbackResult(request);
  }
};
