"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, MapPin, Share2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createTrip } from "@/app/trips/actions";
import { CityField } from "@/components/trip/city-field";
import { unwrap } from "@/lib/action-result";
import { formatDateLabel } from "@/lib/dates";
import { markOnboarded, suggestTripTitle } from "@/lib/onboarding";
import { tripCountdown } from "@/lib/trip-order";
import { createTripSchema } from "@/lib/validators";

const STEPS = ["Destination", "Dates", "Name"] as const;

const NEXT_UP = [
  { icon: MapPin, title: "Save places", body: "Search a spot or paste a link. Each one becomes a pin with your note." },
  { icon: Share2, title: "Bring the group", body: "Invite by email or link. Everyone edits the same board." },
  { icon: Sparkles, title: "Ask the assistant", body: "It reads the trip and drops real picks near your hotel on the map." },
];

/**
 * First run for a new account: three short questions that fill a live preview
 * of the board, then create the trip and open it with a getting-started list.
 */
export function WelcomeFlow({ firstName, today }: { firstName: string; today: string }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [title, setTitle] = useState("");
  const [titleEdited, setTitleEdited] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const shownTitle = title || suggestTripTitle(destination);
  const datesSet = Boolean(startDate && endDate);
  const place = destination.split(",")[0]?.trim();

  function pickDestination(label: string) {
    setDestination(label);
    if (!titleEdited) setTitle(suggestTripTitle(label));
    setError("");
  }

  function next() {
    if (step === 0 && !destination) {
      setError("Pick a city or country from the list to keep going.");
      return;
    }
    if (step === 1 && (startDate || endDate) && !datesSet) {
      setError("Add both dates, or skip this step and add them later.");
      return;
    }
    if (step === 1 && datesSet && endDate < startDate) {
      setError("The trip has to end after it starts.");
      return;
    }
    setError("");
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function skipDates() {
    setStartDate("");
    setEndDate("");
    setError("");
    setStep(2);
  }

  async function finish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      next();
      return;
    }
    const parsed = createTripSchema.safeParse({ title: shownTitle, destination, startDate, endDate });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your trip details.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const result = await unwrap(createTrip(parsed.data));
      markOnboarded();
      router.push(result.demo ? "/trips/nyc-weekender?welcome=1" : `/trips/${result.id}?welcome=1`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The trip could not be created.");
      setPending(false);
    }
  }

  return (
    <div className="welcome-grid">
      <section className="welcome-panel">
        <div className="welcome-progress" aria-label={`Step ${step + 1} of ${STEPS.length}`}>
          {STEPS.map((label, index) => (
            <span className={index <= step ? "done" : undefined} key={label}>
              <i aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>

        <form className="welcome-form new-trip-form" onSubmit={finish}>
          {step === 0 ? (
            <div className="welcome-step" key="destination">
              <p className="eyebrow">Welcome to Tripboard, {firstName}</p>
              <h1>Where are you headed first?</h1>
              <p className="welcome-lede">Start with one place. You can add more cities to the same trip later.</p>
              <CityField defaultValue={destination} onCityChange={pickDestination} />
            </div>
          ) : null}

          {step === 1 ? (
            <div className="welcome-step" key="dates">
              <p className="eyebrow">{place}</p>
              <h1>When are you going?</h1>
              <p className="welcome-lede">Dates unlock the day-by-day plan, weather and opening hours. Not sure yet? Skip it.</p>
              <div className="date-fields">
                <label>
                  <span>Leave</span>
                  <input max={endDate || undefined} onChange={(event) => setStartDate(event.target.value)} type="date" value={startDate} />
                </label>
                <label>
                  <span>Come home</span>
                  <input min={startDate || undefined} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
                </label>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="welcome-step" key="name">
              <p className="eyebrow">Last thing</p>
              <h1>What should we call it?</h1>
              <p className="welcome-lede">This is what your group sees in their trip list.</p>
              <label>
                <span>Trip name</span>
                <input
                  autoFocus
                  maxLength={80}
                  onChange={(event) => {
                    setTitle(event.target.value);
                    setTitleEdited(true);
                  }}
                  placeholder="Summer in Lisbon"
                  value={title}
                />
              </label>
            </div>
          ) : null}

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="welcome-actions">
            {step > 0 ? (
              <button className="button" disabled={pending} onClick={() => { setError(""); setStep(step - 1); }} type="button">
                <ArrowLeft size={16} /> Back
              </button>
            ) : null}
            {step === 1 ? (
              <button className="text-link welcome-skip" onClick={skipDates} type="button">
                Decide later
              </button>
            ) : null}
            <button className="button button-ink" disabled={pending} type="submit">
              {step < STEPS.length - 1 ? "Continue" : pending ? "Opening your board…" : "Create my board"} <ArrowRight size={17} />
            </button>
          </div>
        </form>

        <p className="welcome-exit">
          Just looking? <Link href="/trips/nyc-weekender" onClick={markOnboarded}>Open the demo trip</Link> or{" "}
          <Link href="/trips" onClick={markOnboarded}>skip to your trips</Link>.
        </p>
      </section>

      <aside className="welcome-aside" aria-label="Preview of your board">
        <div className="welcome-preview">
          <div className="welcome-preview-map" aria-hidden="true">
            <i className="pin pin-a" />
            <i className="pin pin-b" />
            <i className="pin pin-c" />
          </div>
          <div className="welcome-preview-body">
            <p className="eyebrow">{datesSet ? tripCountdown({ startDate, endDate }, today) : "Your first board"}</p>
            <h2>{shownTitle || "Somewhere good"}</h2>
            <p>
              {destination || "Pick a destination"} · {formatDateLabel(startDate, endDate)}
            </p>
          </div>
        </div>
        <ol className="welcome-next">
          <li className="welcome-next-head">Once it opens</li>
          {NEXT_UP.map(({ icon: Icon, title: heading, body }) => (
            <li key={heading}>
              <span><Icon aria-hidden="true" size={16} /></span>
              <div>
                <strong>{heading}</strong>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="welcome-note"><Check size={14} aria-hidden="true" /> You can change any of this later.</p>
      </aside>
    </div>
  );
}
