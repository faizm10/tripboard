import { describe, expect, it } from "vitest";
import { departureTimestamp, summarizeTransitRoute } from "@/lib/transit-routes";

const ride = (line: string, departs: string, arrives: string) => ({
  travelMode: "TRANSIT",
  staticDuration: "600s",
  transitDetails: {
    stopDetails: { departureStop: { name: `${line} start` }, arrivalStop: { name: `${line} end` } },
    localizedValues: { departureTime: { time: { text: departs } }, arrivalTime: { time: { text: arrives } } },
    headsign: "Downtown",
    stopCount: 4,
    transitLine: { nameShort: line, color: "#f23061", textColor: "#000000", vehicle: { name: { text: "Subway" } } },
  },
});
const walk = (duration: string) => ({ travelMode: "WALK", staticDuration: duration });

describe("summarizeTransitRoute", () => {
  it("keeps rides in order, merges back-to-back walks and counts transfers", () => {
    const option = summarizeTransitRoute({
      duration: "1930s",
      localizedValues: { transitFare: { text: "$3.30" } },
      legs: [{ steps: [walk("120s"), walk("60s"), ride("2", "9:05 AM", "9:15 AM"), walk("180s"), ride("4", "9:20 AM", "9:32 AM"), walk("10s")] }],
    });
    expect(option).toMatchObject({ minutes: 32, departs: "9:05 AM", arrives: "9:32 AM", fare: "$3.30", transfers: 1 });
    expect(option?.steps.map((step) => step.kind === "walk" ? `walk ${step.minutes}` : step.line)).toEqual(["walk 3", "2", "walk 3", "4"]);
  });

  it("drops walking-only routes", () => {
    expect(summarizeTransitRoute({ duration: "600s", legs: [{ steps: [walk("600s")] }] })).toBeNull();
  });
});

describe("departureTimestamp", () => {
  const now = Date.parse("2026-11-05T12:00:00Z");

  it("converts the trip's local time to UTC using the stop's offset", () => {
    expect(departureTimestamp("2026-11-20", "13:30", 9 * 3600, now)).toBe("2026-11-20T04:30:00.000Z");
  });

  it("defaults to 9am local when no time is set", () => {
    expect(departureTimestamp("2026-11-20", "", -5 * 3600, now)).toBe("2026-11-20T14:00:00.000Z");
  });

  it("returns null outside Google's 7-days-back to 100-days-ahead window", () => {
    expect(departureTimestamp("2027-06-01", "10:00", 0, now)).toBeNull();
    expect(departureTimestamp("2026-10-01", "10:00", 0, now)).toBeNull();
  });
});
