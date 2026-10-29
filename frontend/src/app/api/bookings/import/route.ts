import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, generateText } from "ai";
import { z } from "zod";
import { assistantModels } from "@/lib/assistant/models";
import { getViewer } from "@/lib/auth";
import { bookingPrompt, parseBookingReply } from "@/lib/booking-import";
import { envValue } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const requestSchema = z.object({
  text: z.string().trim().min(20).max(20_000),
  tripStart: z.iso.date().optional().or(z.literal("")),
});

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "Sign in to import bookings." }, { status: 401 });
  if (viewer.restricted) return Response.json({ error: "Your account has been restricted." }, { status: 403 });

  const apiKey = envValue("OPENROUTER_API_KEY");
  if (!apiKey) return Response.json({ error: "Booking import isn't set up yet. Add OPENROUTER_API_KEY." }, { status: 503 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Paste the full confirmation email, at least a couple of lines." }, { status: 400 });

  const models = assistantModels();
  const openrouter = createOpenRouter({ apiKey, appName: "Tripboard", appUrl: "https://usetripboard.vercel.app" });
  try {
    const result = await generateText({
      model: openrouter.chat(models[0], { models }),
      prompt: bookingPrompt(parsed.data.text, parsed.data.tripStart || undefined),
      temperature: 0,
      timeout: { totalMs: 50_000 },
      abortSignal: request.signal,
    });
    return Response.json(parseBookingReply(result.text), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (APICallError.isInstance(error) && error.statusCode === 429) {
      return Response.json({ error: "The free AI models are busy right now. Give it a minute and try again." }, { status: 503 });
    }
    console.error(error);
    return Response.json({ error: "Couldn't read that confirmation. Try again, or add it by hand." }, { status: 502 });
  }
}
