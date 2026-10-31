// Minimal cross-tab event bus (BroadcastChannel + in-page listeners).
// When merging, replace with the project's shared bus — only publish/subscribe are used.
import type { CancelEvent, RerouteEvent } from "./types";

type AnyEvent = CancelEvent | RerouteEvent;
type Handler<T> = (e: T) => void;

const CHANNEL = "aeropilot-events";
const local = new Set<Handler<AnyEvent>>();
let channel: BroadcastChannel | null = null;

function getChannel() {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
  if (!channel) {
    channel = new BroadcastChannel(CHANNEL);
    channel.onmessage = (m) => local.forEach((h) => h(m.data as AnyEvent));
  }
  return channel;
}

export function publish(e: AnyEvent) {
  local.forEach((h) => h(e));
  getChannel()?.postMessage(e);
}

export function subscribe<T extends AnyEvent["type"]>(
  type: T, handler: Handler<Extract<AnyEvent, { type: T }>>,
): () => void {
  getChannel();
  const h: Handler<AnyEvent> = (e) => { if (e.type === type) handler(e as Extract<AnyEvent, { type: T }>); };
  local.add(h);
  return () => { local.delete(h); };
}
