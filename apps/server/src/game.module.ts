import { Module } from "@nestjs/common";
import { ContentModule } from "./content/content.module";
import { BroadcastService } from "./gateway/broadcast.service";
import { RoomGateway } from "./gateway/room.gateway";
import { RoomService } from "./rooms/room.service";
import {
  Clock,
  RateLimiter,
  RoomRepository,
  SessionRepository,
} from "./ports";
import {
  MemoryRateLimiter,
  MemoryRoomRepository,
  MemorySessionRepository,
  SystemClock,
} from "./adapters/memory";

@Module({
  imports: [ContentModule],
  providers: [
    RoomService,
    BroadcastService,
    RoomGateway,
    { provide: RoomRepository, useClass: MemoryRoomRepository },
    { provide: SessionRepository, useClass: MemorySessionRepository },
    { provide: RateLimiter, useClass: MemoryRateLimiter },
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [RoomService],
})
export class GameModule {}
