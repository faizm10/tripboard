import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DayTransitPlanner, transitLegs } from "@/components/day-transit-planner";
import { saveTransitPlanSchema } from "@/lib/validators";
import type { RouteStop, TransitPlan } from "@/lib/types";

const stops: RouteStop[] = [
  { id: "hotel-home", name: "Our hotel", coordinates: [-74.01, 40.74] },
  { id: "park", name: "Village park", coordinates: [-74, 40.73] },
  { id: "cafe", name: "Village cafe", coordinates: [-74.001, 40.732] },
  { id: "market", name: "Chelsea market", coordinates: [-74.006, 40.742] },
];
const date = "2026-10-10";
const savedPlan: TransitPlan = { id: "ride-1", plannedDate: date, from: stops[0], to: stops[3], departureTime: "13:30", note: "After lunch" };
const props = { date, stops, plans: [], onSave: vi.fn().mockResolvedValue(undefined), onRemove: vi.fn().mockResolvedValue(undefined) };
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function chooseRide() {
  fireEvent.click(screen.getByRole("button", { name: "Plan transit" }));
  fireEvent.change(screen.getByLabelText("Transit from"), { target: { value: "hotel-home" } });
  fireEvent.change(screen.getByLabelText("Transit to"), { target: { value: "market" } });
}

describe("optional transit planning", () => {
  it("puts a ride in the gap between the stop it leaves and the next one", () => {
    const hop = { ...savedPlan, id: "hop", from: stops[1], to: stops[2] };
    const legs = transitLegs(stops, [hop, savedPlan]);
    expect(legs[0].direct).toBeNull();
    expect(legs[0].other.map((plan) => plan.id)).toEqual([savedPlan.id]);
    expect(legs[1].direct?.id).toBe("hop");
    expect(legs[2].direct).toBeNull();
  });

  it("orders saved rides by the itinerary and updates them when stops are reordered", () => {
    const parkRide = { ...savedPlan, id: "park-ride", from: stops[1] };
    const cafeRide = { ...savedPlan, id: "cafe-ride", from: stops[2] };
    const { rerender } = render(<DayTransitPlanner {...props} plans={[cafeRide, parkRide]} />);
    const rideNames = () => screen.getAllByRole("article").map((card) => card.querySelector("strong")?.textContent);
    expect(rideNames()).toEqual(["Village park → Chelsea market", "Village cafe → Chelsea market"]);
    rerender(<DayTransitPlanner {...props} stops={[stops[0], stops[2], stops[1], stops[3]]} plans={[cafeRide, parkRide]} />);
    expect(rideNames()).toEqual(["Village cafe → Chelsea market", "Village park → Chelsea market"]);
  });

  it("numbers choices in day order and preserves those numbers when an origin is excluded", () => {
    render(<DayTransitPlanner {...props} />);
    chooseRide();
    const labels = (name: string) => Array.from((screen.getByLabelText(name) as HTMLSelectElement).options).map((option) => option.textContent);
    expect(labels("Transit from")).toEqual(["Choose a starting point", "Hotel · Our hotel", "01 · Village park", "02 · Village cafe", "03 · Chelsea market"]);
    fireEvent.change(screen.getByLabelText("Transit from"), { target: { value: "park" } });
    expect(labels("Transit to")).toEqual(["Choose a destination", "Hotel · Our hotel", "02 · Village cafe", "03 · Chelsea market"]);
  });

  it("creates no automatic rides or Google Maps links", () => {
    render(<DayTransitPlanner {...props} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("form")).toBeNull();
  });

  it("lets the user choose non-adjacent endpoints and an optional departure time", async () => {
    render(<DayTransitPlanner {...props} />);
    chooseRide();
    fireEvent.change(screen.getByLabelText("Transit departure time"), { target: { value: "13:30" } });
    const url = new URL(screen.getByRole("link", { name: /Compare transit/ }).getAttribute("href")!);
    expect(url.searchParams.get("origin")).toBe("40.74,-74.01");
    expect(url.searchParams.get("destination")).toBe("40.742,-74.006");
    expect(url.searchParams.get("travelmode")).toBe("transit");
    expect(url.searchParams.has("waypoints")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Save transit plan" }));
    await waitFor(() => expect(props.onSave).toHaveBeenCalledWith({ plannedDate: date, id: undefined, from: stops[0], to: stops[3], departureTime: "13:30", note: "" }));
    await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
  });

  it("does not save when the user cancels after comparing routes", () => {
    render(<DayTransitPlanner {...props} />);
    chooseRide();
    fireEvent.click(screen.getByRole("button", { name: "Cancel transit plan" }));
    expect(props.onSave).not.toHaveBeenCalled();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("keeps the draft and shows a retry error when persistence fails", async () => {
    render(<DayTransitPlanner {...props} onSave={vi.fn().mockRejectedValue(new Error("offline"))} />);
    chooseRide();
    fireEvent.click(screen.getByRole("button", { name: "Save transit plan" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect((screen.getByLabelText("Transit to") as HTMLSelectElement).value).toBe("market");
  });

  it("renders only the saved ride with its chosen time and endpoints", () => {
    render(<DayTransitPlanner {...props} plans={[savedPlan]} />);
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(screen.getByText("Our hotel → Chelsea market")).toBeTruthy();
    expect(screen.getByText("Commute to Chelsea market · 13:30")).toBeTruthy();
    expect(screen.getByText("Depart around 13:30 · local time")).toBeTruthy();
  });

  it("rejects invalid time, coordinates, and identical endpoints before persistence", () => {
    const valid = { ...savedPlan, id: undefined, tripId: "11111111-1111-4111-8111-111111111111" };
    expect(saveTransitPlanSchema.safeParse(valid).success).toBe(true);
    expect(saveTransitPlanSchema.safeParse({ ...valid, to: valid.from }).success).toBe(false);
    expect(saveTransitPlanSchema.safeParse({ ...valid, departureTime: "25:00" }).success).toBe(false);
    expect(saveTransitPlanSchema.safeParse({ ...valid, to: { ...valid.to, coordinates: [181, 90] } }).success).toBe(false);
  });
});
