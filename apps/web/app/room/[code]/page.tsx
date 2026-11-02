import { RoomClient } from "./room-client";

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ devToken?: string; devPlayerId?: string; devNickname?: string }>;
}) {
  const { code } = await params;
  const query = await searchParams;
  return <RoomClient code={code.toUpperCase()} devSession={query.devToken && query.devPlayerId ? { token: query.devToken, playerId: query.devPlayerId, nickname: query.devNickname ?? "Dev Host" } : null} />;
}
