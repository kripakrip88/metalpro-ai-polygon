import { Controller, Get } from "@nestjs/common";
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from "@nestjs/terminus";
import { Public } from "../auth/decorators/public.decorator";
import { DbHealthIndicator } from "./db.health-indicator";

@Controller("api/health")
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DbHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @Public()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.isHealthy("postgresql"),
      () => this.memory.checkHeap("memory_heap", 350 * 1024 * 1024),
    ]);
  }
}
