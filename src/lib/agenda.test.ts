import { describe, expect, it } from "vitest";
import { agendaTemplate, describeLink, taskProgress, toggleTaskAt, wordCount } from "@/lib/agenda";

describe("describeLink", () => {
  it("turns a long booking URL into the hotel's name and host", () => {
    const link = describeLink("https://ca.hotels.com/ho441175/namsan-hill-hotel-seoul-south-korea/?chkin=2027-05-06&chkout=2027-05-12&x_pwa=1");
    expect(link).toEqual({ host: "ca.hotels.com", title: "Namsan Hill Hotel Seoul South Korea" });
  });

  it("falls back to the host when the path has no words", () => {
    expect(describeLink("https://www.example.com/12345678")).toEqual({ host: "example.com", title: "example.com" });
  });

  it("copes with text that isn't a URL", () => {
    expect(describeLink("not a url").title).toBe("not a url");
  });
});

describe("toggleTaskAt", () => {
  const source = "## Packing\n- [ ] Passports\n- [x] Chargers\n";
  const passports = source.indexOf("- [ ] Passports");
  const chargers = source.indexOf("- [x] Chargers");

  it("ticks and unticks the item at the offset", () => {
    expect(toggleTaskAt(source, passports)).toBe("## Packing\n- [x] Passports\n- [x] Chargers\n");
    expect(toggleTaskAt(source, chargers)).toBe("## Packing\n- [ ] Passports\n- [ ] Chargers\n");
  });

  it("leaves lines without a checkbox alone", () => {
    expect(toggleTaskAt(source, 0)).toBe(source);
  });
});

describe("agenda counts", () => {
  it("counts checklist progress", () => {
    expect(taskProgress("- [ ] a\n- [x] b\n* [X] c\nplain")).toEqual({ done: 2, total: 3 });
  });

  it("counts a long URL as one word", () => {
    expect(wordCount("Hotel: https://example.com/a-very-long-path?x=1 booked")).toBe(3);
  });
});

describe("agendaTemplate", () => {
  it("lists the trip's flights and hotels", () => {
    const template = agendaTemplate({
      title: "Korea",
      flights: [{ id: "f", plannedDate: "2027-05-02", arrivalDate: "2027-05-03", airline: "Air Canada", flightNumber: "AC63", departureAirport: "YYZ", arrivalAirport: "ICN", departureTime: "13:00", arrivalTime: "16:00" }],
      hotels: [{ id: "h", name: "Namsan Hill Hotel", address: "", coordinates: [127, 37.5], startDate: "2027-05-06", endDate: "2027-05-12" }],
    });
    expect(template).toContain("# Korea");
    expect(template).toContain("- Air Canada AC63: YYZ → ICN, May 2 13:00");
    expect(template).toContain("- **Namsan Hill Hotel**, May 6 to May 12");
    expect(template).toContain("- [ ] Passports");
  });
});
