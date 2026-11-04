"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return <button className="button button-ink" onClick={() => window.print()} type="button"><Printer size={16} /> Print or save as PDF</button>;
}
