import { Module } from "@nestjs/common";
import { CatalogController } from "./catalog/catalog.controller";
import { ContentModule } from "./content/content.module";
import { GameModule } from "./game.module";

@Module({
  imports: [ContentModule, GameModule],
  controllers: [CatalogController],
})
export class AppModule {}
