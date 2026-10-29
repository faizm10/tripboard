import { describe, expect, it } from "vitest";
import { parseBookingReply } from "@/lib/booking-import";

describe("booking import", () => {
  it("reads flights and hotels from a model reply wrapped in prose", () => {
    const reply = `Sure! Here you go:
\`\`\`json
{"journeys":[{"mode":"flight","departureDate":"2026-05-01","arrivalDate":"2026-05-02","carrier":"Korean Air","number":"KE 74","from":"yyz","to":"ICN","departureTime":"13:05","arrivalTime":"16:45"}],
 "hotels":[{"name":"Hotel Cappuccino","address":"155 Bongeunsa-ro, Seoul","checkIn":"2026-05-02","checkOut":"2026-05-06"}]}
\`\`\``;
    expect(parseBookingReply(reply)).toEqual({
      journeys: [{ mode: "flight", plannedDate: "2026-05-01", arrivalDate: "2026-05-02", airline: "Korean Air", flightNumber: "KE 74", departureAirport: "YYZ", arrivalAirport: "ICN", departureTime: "13:05", arrivalTime: "16:45" }],
      hotels: [{ name: "Hotel Cappuccino", address: "155 Bongeunsa-ro, Seoul", startDate: "2026-05-02", endDate: "2026-05-05" }],
    });
  });

  it("keeps trains with station names and pads short times", () => {
    const { journeys } = parseBookingReply('{"journeys":[{"mode":"train","departureDate":"2026-05-06","from":"Seoul Station","to":"Busan","departureTime":"9:00","arrivalTime":"11:42"}]}');
    expect(journeys[0]).toMatchObject({ mode: "train", departureAirport: "Seoul Station", arrivalAirport: "Busan", departureTime: "09:00", arrivalDate: "2026-05-06" });
  });

  it("drops bookings missing a date or a usable route, and survives junk", () => {
    expect(parseBookingReply('{"journeys":[{"mode":"flight","from":"Toronto","to":"Seoul","departureDate":"2026-05-01"},{"mode":"flight","from":"YYZ","to":"ICN"}],"hotels":[{"name":"No dates"}]}')).toEqual({ journeys: [], hotels: [] });
    expect(parseBookingReply("I couldn't find anything.")).toEqual({ journeys: [], hotels: [] });
  });
});
