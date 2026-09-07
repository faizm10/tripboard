import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tripboard — trips worth taking",
    short_name: "Tripboard",
    description: "Save travel spots, plan with friends, and turn them into a route.",
    start_url: "/trips",
    display: "standalone",
    background_color: "#fff7e8",
    theme_color: "#ff5b35",
    icons: [{ src: "/tripboard-mark.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
