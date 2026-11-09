import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  RetryError,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { assistantInstructions } from "@/lib/assistant/context";
import { getApiKey } from "@/lib/assistant/api-keys";
import { assistantModels } from "@/lib/assistant/models";
import { ownKeyModel, portableHistory } from "@/lib/assistant/own-key-model";
import { ASSISTANT_PROVIDERS, PROVIDER_INFO, resolveModel, type AssistantProvider, type OwnKeyProvider } from "@/lib/assistant/providers";
import { getSaveConversations, recordUsage, saveConversation } from "@/lib/assistant/store";
import { createAssistantTools, knownSearchResults, type AssistantMessage } from "@/lib/assistant/tools";
import { getViewer } from "@/lib/auth";
import { getTrip } from "@/lib/demo-data";
import { getViewerTrip, toTripViewer } from "@/lib/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Older turns are dropped from the prompt so long chats stay inside free-model context and rate limits. */
const MAX_HISTORY = 24;

const requestSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  tripId: z.string().min(1).max(64),
  provider: z.enum(ASSISTANT_PROVIDERS).default("free"),
  model: z.string().max(80).optional(),
  messages: z.array(z.unknown()).min(1).max(200),
});

/** Retried calls that keep failing arrive wrapped; the last attempt holds the real status. */
function underlyingError(error: unknown) {
  return RetryError.isInstance(error) ? error.lastError : error;
}

function isTimeout(error: unknown) {
  return error instanceof Error && /timeout|timed out|aborted/i.test(`${error.name} ${error.message}`);
}

function friendlyFreeError(error: unknown) {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return "The free AI models are busy right now. Give it a minute and try again.";
    if (error.statusCode === 401 || error.statusCode === 403) return "The assistant's OpenRouter key was rejected. Check OPENROUTER_API_KEY.";
    if (error.statusCode === 404) return "None of the configured AI models are available any more. Update OPENROUTER_MODELS.";
    if (error.statusCode === 402) return "The OpenRouter account is out of free credits for today.";
  }
  if (isTimeout(error)) return "The free model took too long to answer. Try again, or ask something a little narrower.";
  return "The assistant hit a snag. Try again in a moment.";
}

function friendlyOwnKeyError(error: unknown, provider: OwnKeyProvider, modelId: string) {
  const { name, company } = PROVIDER_INFO[provider];
  if (APICallError.isInstance(error)) {
    const status = error.statusCode;
    if (status === 401 || status === 403 || (status === 400 && /api.?key/i.test(error.message))) return `${company} rejected your ${name} key. Check it on your account page.`;
    if (status === 402 || (status === 400 && /credit balance/i.test(error.message))) return `Your ${company} account is out of credit.`;
    if (status === 429) return `${company} is limiting your key. It may be out of credit, or you can wait a minute and try again.`;
    if (status === 404) return `Your ${company} key can't use ${modelId}. Check which models it has access to.`;
  }
  if (isTimeout(error)) return `${name} took too long to answer. Try again, or ask something a little narrower.`;
  return `${name} hit a snag. Try again in a moment.`;
}

function friendlyError(error: unknown, provider: AssistantProvider, modelId: string) {
  const cause = underlyingError(error);
  return provider === "free" ? friendlyFreeError(cause) : friendlyOwnKeyError(cause, provider, modelId);
}

async function chooseModel(provider: AssistantProvider, modelId: string, userId: string) {
  if (provider === "free") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return { error: "The trip assistant isn't set up yet. Add OPENROUTER_API_KEY.", status: 503 };
    const models = assistantModels();
    const openrouter = createOpenRouter({ apiKey, appName: "Tripboard", appUrl: "https://usetripboard.vercel.app" });
    // OpenRouter walks `models` in order when one is rate limited or retired.
    return { languageModel: openrouter.chat(models[0], { models }) };
  }
  const apiKey = await getApiKey(userId, provider);
  if (!apiKey) return { error: `Add your ${PROVIDER_INFO[provider].name} key on your account page, or switch to the free models.`, status: 400 };
  return { languageModel: ownKeyModel(provider, apiKey, modelId) };
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Sign in to use the trip assistant." }, { status: 401 });
  if (viewer.restricted) return Response.json({ error: "Your account has been restricted." }, { status: 403 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "That request didn't look right." }, { status: 400 });
  const { tripId, id: conversationId } = parsed.data;

  // Same access rules as the trip page: a member's real trip first, then the public demo.
  const [realTrip, saving] = await Promise.all([
    viewer.demo ? null : getViewerTrip(tripId, toTripViewer(viewer)),
    viewer.demo ? false : getSaveConversations(viewer.id),
  ]);
  const trip = realTrip ?? (tripId === "nyc-weekender" || viewer.demo ? getTrip(tripId) : null);
  if (!trip) return Response.json({ error: "You do not have access to this trip." }, { status: 404 });

  const validated = await safeValidateUIMessages<AssistantMessage>({ messages: parsed.data.messages });
  if (!validated.success) return Response.json({ error: "That conversation couldn't be read. Start a new chat." }, { status: 400 });
  const messages = validated.data;

  // Demo sessions have no account to hold a key, so they stay on the free models.
  const provider: AssistantProvider = viewer.demo ? "free" : parsed.data.provider;
  const modelId = provider === "free" ? "" : resolveModel(provider, parsed.data.model);
  const model = await chooseModel(provider, modelId, viewer.id);
  if ("error" in model) return Response.json({ error: model.error }, { status: model.status });

  const tools = createAssistantTools(trip, knownSearchResults(messages));

  const result = streamText({
    model: model.languageModel,
    instructions: assistantInstructions(trip, new Date().toISOString().slice(0, 10)),
    messages: portableHistory(await convertToModelMessages(messages.slice(-MAX_HISTORY), { ignoreIncompleteToolCalls: true })),
    tools,
    // Pasted itineraries need a search per venue before the draft, so allow a few more steps.
    stopWhen: isStepCount(10),
    // Free models sometimes stall mid-answer; fail inside the function limit with a clear message instead.
    timeout: { totalMs: 55_000, chunkMs: 30_000 },
    abortSignal: request.signal,
  });

  let answeredBy = "";
  let usage = { inputTokens: 0, outputTokens: 0 };

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      messageMetadata: ({ part }) => {
        if (part.type === "finish-step") {
          answeredBy = part.response.modelId || answeredBy;
          return { model: answeredBy };
        }
        if (part.type === "finish") {
          usage = { inputTokens: part.totalUsage.inputTokens ?? 0, outputTokens: part.totalUsage.outputTokens ?? 0 };
        }
        return undefined;
      },
      onError: (error) => {
        // Provider responses can echo part of a user's key, so own-key failures log the status only.
        const cause = underlyingError(error);
        console.error("[assistant]", provider === "free" ? error : `${provider} request failed: ${APICallError.isInstance(cause) ? cause.statusCode : "no status"}`);
        return friendlyError(error, provider, modelId);
      },
      onEnd: async ({ messages: updated, isAborted }) => {
        if (viewer.demo) return;
        try {
          if (answeredBy) await recordUsage({ userId: viewer.id, tripId: trip.id, model: answeredBy, ...usage });
          if (saving && conversationId && !isAborted) {
            await saveConversation({ id: conversationId, userId: viewer.id, tripId: trip.id, messages: updated });
          }
        } catch (error) {
          // Bookkeeping must never break a reply the user already received.
          console.error("[assistant] could not record the reply", error);
        }
      },
    }),
  });
}
