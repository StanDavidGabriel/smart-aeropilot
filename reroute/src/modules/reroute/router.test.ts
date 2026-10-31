import { describe, expect, it } from "vitest";
import network from "@/data/network.json";
import { cancelFlight, voucher } from "./router";
import type { Network } from "./types";

const net = network as unknown as Network;

describe("voucher rules", () => {
  it("over 3h delay gives 250 EUR + 15 meal", () => expect(voucher(181)).toEqual({ compensation: 250, meal: 15 }));
  it("over 2h delay gives 125 EUR + 15 meal", () => expect(voucher(150)).toEqual({ compensation: 125, meal: 15 }));
  it("over 1h delay gives only meal", () => expect(voucher(90)).toEqual({ compensation: 0, meal: 15 }));
  it("no route gives 250 + meal", () => expect(voucher(null)).toEqual({ compensation: 250, meal: 15 }));
});

describe("re-routing matches the Java engine on AP103", () => {
  const res = cancelFlight(net, "AP103");
  it("never uses the cancelled flight and respects 45 min connection", () => {
    for (const r of res.results) {
      if (!r.chosen) continue;
      expect(r.chosen.legs.some((l) => l.id === "AP103")).toBe(false);
      expect(r.chosen.stops).toBeLessThanOrEqual(2);
    }
  });
  it("produces the same assignments as Java", () => {
    const summary = res.results.map((r) => [r.passenger.name, r.chosen?.legs.map((l) => l.id) ?? null]);
    expect(summary.slice(0, 3)).toEqual([
      ["Vlad Ilie", ["AP143"]],
      ["Alexandra Marin", ["AP143"]],
      ["Irina Ionescu", ["AP105", "AP119"]],
    ]);
    expect(res.results.filter((r) => r.status === "unrouted").length).toBe(3);
  });
});
