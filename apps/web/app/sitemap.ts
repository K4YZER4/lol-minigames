import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://lol-minigames.vercel.app";
  return [{ url: baseUrl, changeFrequency: "weekly", priority: 1 }];
}
