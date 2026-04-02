import type { MetadataRoute } from "next";
import { siteDescription, siteName, siteUrl } from "@/lib/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteName,
    short_name: siteName,
    description: siteDescription,
    start_url: siteUrl,
    display: "standalone",
    background_color: "#09090f",
    theme_color: "#09090f",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
