import { notFound } from "next/navigation";
import { MODE_IDS, type ModeId } from "@lolgames/protocol";
import { DevTestClient } from "./dev-test-client";

export const dynamic = "force-dynamic";

export default async function DevTestModePage({
  params,
  searchParams,
}: {
  params: Promise<{ mode: string }>;
  searchParams: Promise<{ players?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const { mode } = await params;
  if (!MODE_IDS.includes(mode as ModeId)) notFound();

  const { players } = await searchParams;
  return <DevTestClient mode={mode as ModeId} players={players ?? "4"} />;
}
