import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "public"),
      exclude: ["/api/{*test}"],
      serveStaticOptions: {
        fallthrough: false,
      },
    }),
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
