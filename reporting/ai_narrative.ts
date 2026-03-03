import type { ReportIssueView } from "./reporting.ts";

interface AiHeadlineRequest {
  model: string;
  apiKey?: string;
  headlineLead: string;
  context: {
    startDate: string;
    endDate: string;
  };
  issueKeys: string[];
}

export interface AiHeadlineResult {
  headlineLead: string;
  assisted: boolean;
}

interface OpenAIChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

const OPENAI_CHAT_COMPLETIONS_URL =
  "https://api.openai.com/v1/chat/completions";

const REWRITE_SYSTEM_PROMPT =
  "You rewrite one status-report headline. Rewrite wording only. Preserve factual meaning exactly. Do not add new facts, counts, dates, issue keys, providers, or states. Keep issue references concrete and avoid vague filler. Return plain text only with no JSON, no markdown, and no bullet prefix.";

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

const rewriteHeadlineWithOpenAI = async (
  request: AiHeadlineRequest,
): Promise<string> => {
  const prompt = JSON.stringify(
    {
      context: request.context,
      sourceText: request.headlineLead,
      issueKeys: request.issueKeys,
      rules: [
        "Rewrite wording only.",
        "Keep factual meaning unchanged.",
        "Do not add/remove issue references, counts, dates, or state facts.",
        "Keep output concise and executive-friendly.",
        "Return plain text only.",
      ],
    },
    null,
    2,
  );

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

export const rewriteHeadline = async (
  headlineLead: string,
  options: {
    model: string;
    apiKey?: string;
    startDate: string;
    endDate: string;
    topIssues: ReportIssueView[];
  },
): Promise<AiHeadlineResult> => {
  if (!options.apiKey) {
    return { headlineLead, assisted: false };
  }

  try {
    const rewritten = await rewriteHeadlineWithOpenAI({
      model: options.model,
      apiKey: options.apiKey,
      headlineLead,
      context: {
        startDate: options.startDate,
        endDate: options.endDate,
      },
      issueKeys: options.topIssues.slice(0, 6).map((issue) => issue.key),
    });

    return {
      headlineLead: rewritten,
      assisted: rewritten !== headlineLead,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`AI headline rewrite skipped: ${message}`);
    return { headlineLead, assisted: false };
  }
};
