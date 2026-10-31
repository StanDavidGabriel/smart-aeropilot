import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({
  name: z.string().max(100),
  cancelledFlight: z.string().max(20),
  route: z.string().max(600),
  arrive: z.string().max(10).nullable(),
  delayMinutes: z.number().nullable(),
  voucherTotal: z.number(),
  familySize: z.number(),
});

/** Generates a short, friendly English message with Lovable AI. Throws on failure; caller uses fallback. */
export const generateRerouteMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { generateMessage } = await import("./message.server");
    return { message: await generateMessage(data) };
  });
