import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Moneo",
    short_name: "Moneo",
    description: "Your accounts, transactions and budgets, also when you're offline.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#001b29",
    theme_color: "#001b29",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
