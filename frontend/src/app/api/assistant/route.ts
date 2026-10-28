import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  APICallError,
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  safeValidateUIMessages,
  streamText,
  toUIMessageStream,
} from "ai";
import { z } from "zod";
import { assistantInstructions } from "@/lib/assistant/context";
import { assistantModels } from "@/lib/assistant/models";
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
  messages: z.array(z.unknown()).min(1).max(200),
});

function friendlyError(error: unknown) {
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 429) return "The free AI models are busy right now. Give it a minute and try again.";
    if (error.statusCode === 401 || error.statusCode === 403) return "The assistant's OpenRouter key was rejected. Check OPENROUTER_API_KEY.";
    if (error.statusCode === 404) return "None of the configured AI models are available any more. Update OPENROUTER_MODELS.";
    if (error.statusCode === 402) return "The OpenRouter account is out of free credits for today.";
  }
  if (error instanceof Error && /timeout|timed out|aborted/i.test(`${error.name} ${error.message}`)) {
    return "The free model took too long to answer. Try again, or ask something a little narrower.";
  }
  return "The assistant hit a snag. Try again in a moment.";
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Sign in to use the trip assistant." }, { status: 401 });
  if (viewer.restricted) return Response.json({ error: "Your account has been restricted." }, { status: 403 });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return Response.json({ error: "The trip assistant isn't set up yet. Add OPENROUTER_API_KEY." }, { status: 503 });

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

  const tools = createAssistantTools(trip, knownSearchResults(messages));
  const models = assistantModels();
  const openrouter = createOpenRouter({ apiKey, appName: "Tripboard", appUrl: "https://usetripboard.vercel.app" });

  const result = streamText({
    // OpenRouter walks `models` in order when one is rate limited or retired.
    model: openrouter.chat(models[0], { models }),
    instructions: assistantInstructions(trip, new Date().toISOString().slice(0, 10)),
    messages: await convertToModelMessages(messages.slice(-MAX_HISTORY)),
    tools,
    stopWhen: isStepCount(6),
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
        console.error("[assistant]", error);
        return friendlyError(error);
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
