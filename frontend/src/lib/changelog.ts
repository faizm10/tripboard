/**
 * Release history shown at /changelog and in the footer. Newest first.
 *
 * Every pull request that changes what people see adds an entry at the top
 * and bumps `version` in package.json to match (see AGENTS.md). Entries up to
 * 0.41.0 were rebuilt from the merged pull requests on GitHub, one minor
 * version per PR number.
 */
export type ChangelogEntry = {
  version: string;
  /** YYYY-MM-DD, the day it merged (or is expected to). */
  date: string;
  title: string;
  pr?: number;
  changes: string[];
};

export const REPO_URL = "https://github.com/faizm10/tripboard";

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.42.0",
    date: "2026-11-03",
    title: "AI picks on the map, a resizable split, and a better Agenda",
    pr: 42,
    changes: [
      "Places the trip assistant suggests now show on the map as lettered pins, with an Add button right on the pin.",
      "Each suggestion card has a Map button and shows how far it is from your hotel.",
      "The assistant searches near where you're staying each day and knows which days are still empty.",
      "Drag the divider between the map and the list to resize them. Double-click it to reset.",
      "City stop tabs are gone. Every place belongs to the whole trip, and Add a place has a simple Near box instead.",
      "The Agenda has Read and Edit modes, checklists you can tick, headings, and pasted links that turn into tidy chips.",
      "Start an empty Agenda from your trip's flights and hotels in one tap.",
      "The Day plan is calmer: one card holds the day, weather, notes, and Add to day, and the category pills become a small filter.",
      "The trip summary above the board is only clickable on its text, not across the empty space.",
      "AI pick popups on the map are laid out properly, and distances only show when the hotel is nearby.",
      "The assistant's header lines up with the trip bar, and the tabs no longer squash when it's open.",
      "Assistant chats are saved by default. Turn it off any time on your account page.",
      "Version number in the footer and this changelog.",
    ],
  },
  { version: "0.41.0", date: "2026-10-29", title: "Tidy the day plan rows", pr: 41, changes: ["Commutes, stops, and the hotel line up in the day plan, with slimmer commute rows and smaller place names."] },
  { version: "0.40.0", date: "2026-10-29", title: "Activity log and a refresh prompt", pr: 40, changes: ["See who changed what on a trip.", "Get a prompt to refresh when someone else edits the trip you have open."] },
  { version: "0.39.0", date: "2026-10-29", title: "Weather and opening hours", pr: 39, changes: ["Each day shows its forecast, or the recorded weather for past days.", "Each stop says whether it's open when you plan to be there."] },
  { version: "0.38.0", date: "2026-10-29", title: "Add to calendar and a printable itinerary", pr: 38, changes: ["Download the trip as an .ics file for Google, Apple, or Outlook calendars.", "Print or save the itinerary as a PDF."] },
  { version: "0.37.0", date: "2026-10-29", title: "Money upgrades", pr: 37, changes: ["Mark a payback as paid, with undo.", "Log costs in any currency.", "Fill expenses from the trip's flights and hotels."] },
  { version: "0.36.0", date: "2026-10-29", title: "Import bookings from email", pr: 36, changes: ["Paste a confirmation email to add flights, trains, buses, and hotels."] },
  { version: "0.35.0", date: "2026-10-29", title: "CI and a safer local setup", pr: 35, changes: ["Typecheck, lint, and tests run on every pull request.", "A warning shows when the database is behind the app."] },
  { version: "0.34.0", date: "2026-10-29", title: "Readable save errors", pr: 34, changes: ["When a save fails you see the real reason instead of a minified React error."] },
  { version: "0.33.0", date: "2026-10-29", title: "Money tab", pr: 33, changes: ["Split trip costs between any number of people and see who owes whom.", "The selected place filter is easier to see."] },
  { version: "0.32.0", date: "2026-10-29", title: "A more compact workspace", pr: 32, changes: ["Getting there folds into one row so the day plan gets more room."] },
  { version: "0.31.0", date: "2026-10-29", title: "Hotel stays fill in their own days", pr: 31, changes: ["New hotel stays pre-select their days from the city's dates or your flights.", "Lighter flight form hints."] },
  { version: "0.30.0", date: "2026-10-28", title: "Saved assistant chats", pr: 30, changes: ["Keep assistant conversations on your account.", "See AI usage on the account page."] },
  { version: "0.29.0", date: "2026-10-28", title: "Trip assistant", pr: 29, changes: ["Ask AI reads your trip, finds real places, and suggests them as cards you add with one tap."] },
  { version: "0.28.0", date: "2026-10-25", title: "Flights, trains, and buses", pr: 28, changes: ["A Getting there board at the top of every trip.", "Trains and buses are saved alongside flights."] },
  { version: "0.27.0", date: "2026-09-27", title: "Fix reordering new day places", pr: 27, changes: ["Reordering a place that was still saving no longer fails."] },
  { version: "0.26.0", date: "2026-09-26", title: "Commute blocks on a phone", pr: 26, changes: ["The ride between two stops is its own block on small screens."] },
  { version: "0.25.0", date: "2026-09-25", title: "Current trip first", pr: 25, changes: ["The trip happening today sits at the top of a tighter list, marked Now."] },
  { version: "0.24.0", date: "2026-09-25", title: "A place on more than one day", pr: 24, changes: ["Save the same place on several days."] },
  { version: "0.23.0", date: "2026-09-25", title: "Transit between place rows", pr: 23, changes: ["Each transit ride sits in the gap between its two stops."] },
  { version: "0.22.0", date: "2026-09-25", title: "Steadier place menu", pr: 22, changes: ["Move earlier and Move later keep the place menu open."] },
  { version: "0.21.0", date: "2026-09-25", title: "Transit between stops", pr: 21, changes: ["Plan a ride right in the gap between two stops."] },
  { version: "0.20.0", date: "2026-09-25", title: "Transit rides on a day", pr: 20, changes: ["Save a transit ride between places or from the hotel, with a time and note."] },
  { version: "0.19.0", date: "2026-09-08", title: "Simpler new-trip intro", pr: 19, changes: ["The new-trip screen is just the headline over the photo."] },
  { version: "0.18.0", date: "2026-09-08", title: "Delete from the trips list", pr: 18, changes: ["Delete a trip without opening it.", "The landscape photo backs the new-trip screen."] },
  { version: "0.17.0", date: "2026-09-08", title: "Signed-in header", pr: 17, changes: ["The home page header links back to your trips when you're signed in."] },
  { version: "0.16.0", date: "2026-09-08", title: "Trip details and deletion", pr: 16, changes: ["Owners can delete a trip from its details.", "Country flags render properly."] },
  { version: "0.15.0", date: "2026-09-08", title: "New home page", pr: 15, changes: ["A full scrolling landing page.", "The example trip moved to New York."] },
  { version: "0.14.0", date: "2026-09-07", title: "Admin control tower", pr: 14, changes: ["Admins can manage people and trips, with an audit log."] },
  { version: "0.13.0", date: "2026-09-07", title: "Warmer look and account menu", pr: 13, changes: ["A warmer paper look.", "Your avatar opens a menu for trips, account, and sign out.", "Trip cards show country flags."] },
  { version: "0.12.0", date: "2026-09-03", title: "Shared trip agenda", pr: 12, changes: ["An Agenda tab with a trip brief, dated notes, and checklist items."] },
  { version: "0.11.0", date: "2026-09-02", title: "Invites survive sign-in", pr: 11, changes: ["Opening an invite and signing in now lands you on the trip."] },
  { version: "0.10.0", date: "2026-09-02", title: "Landing page on a real map", pr: 10, changes: ["The home page board is a real map."] },
  { version: "0.9.0", date: "2026-09-02", title: "Invite links", pr: 9, changes: ["Owners can send email invites and share links that expire after 7 days."] },
  { version: "0.8.0", date: "2026-09-02", title: "Cleaner day plan", pr: 8, changes: ["A timeline layout for each day, with photos and notes."] },
  { version: "0.7.0", date: "2026-09-02", title: "Multi-city day-by-day planning", pr: 7, changes: ["Plan trips day by day with saved places and notes."] },
];

export const APP_VERSION = CHANGELOG[0].version;
