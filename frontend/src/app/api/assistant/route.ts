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
import { createAssistantTools, knownSearchResults, type AssistantMessage } from "@/lib/assistant/tools";
import { getViewer } from "@/lib/auth";
import { getTrip } from "@/lib/demo-data";
import { getViewerTrip, toTripViewer } from "@/lib/trips";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Older turns are dropped so long chats stay inside free-model context and rate limits. */
const MAX_HISTORY = 24;

const requestSchema = z.object({
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
  const { tripId } = parsed.data;

  // Same access rules as the trip page: a member's real trip first, then the public demo.
  const realTrip = viewer.demo ? null : await getViewerTrip(tripId, toTripViewer(viewer));
  const trip = realTrip ?? (tripId === "nyc-weekender" || viewer.demo ? getTrip(tripId) : null);
  if (!trip) return Response.json({ error: "You do not have access to this trip." }, { status: 404 });

  const validated = await safeValidateUIMessages<AssistantMessage>({ messages: parsed.data.messages.slice(-MAX_HISTORY) });
  if (!validated.success) return Response.json({ error: "That conversation couldn't be read. Start a new chat." }, { status: 400 });
  const messages = validated.data;

  const tools = createAssistantTools(trip, knownSearchResults(messages));
  const models = assistantModels();
  const openrouter = createOpenRouter({ apiKey, appName: "Tripboard", appUrl: "https://usetripboard.vercel.app" });

  const result = streamText({
    // OpenRouter walks `models` in order when one is rate limited or retired.
    model: openrouter.chat(models[0], { models }),
    instructions: assistantInstructions(trip, new Date().toISOString().slice(0, 10)),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: isStepCount(6),
    abortSignal: request.signal,
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      messageMetadata: ({ part }) => (part.type === "finish-step" ? { model: part.response.modelId } : undefined),
      onError: (error) => {
        console.error("[assistant]", error);
        return friendlyError(error);
      },
    }),
  });
}
