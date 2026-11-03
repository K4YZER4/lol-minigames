import { notFound } from "next/navigation";
import { AudioTestClient } from "./audio-test-client";

export const dynamic = "force-dynamic";

export default function AudioTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <AudioTestClient />;
}
