import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Net Worth",
    short_name: "Net Worth",
    description: "Private net worth dashboard",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f6f1",
    theme_color: "#f7f6f1",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml"
      }
    ]
  };
}
