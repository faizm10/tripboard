import type { UIMessageChunk } from "ai";

/**
 * A timeout ends the stream as an abort, the same as pressing Stop, so the chat
 * would go quiet with no reply. This reports it as an error the user can retry.
 * The abort's reason isn't reliable (a chunk timeout arrives as "{}"), so any
 * abort the user didn't cause counts as a timeout.
 */
export function timeoutsAsErrors<Chunk extends UIMessageChunk>(message: string, userCancelled: () => boolean) {
  return new TransformStream<Chunk, Chunk>({
    transform(chunk, controller) {
      if (chunk.type === "abort" && !userCancelled()) {
        controller.enqueue({ type: "error", errorText: message } as Chunk);
      } else {
        controller.enqueue(chunk);
      }
    },
  });
}
