import { Controller, Get, Res } from "@nestjs/common";
import { Response } from "express";
import { MetricsService } from "./metrics.service";
import { Public } from "../auth/decorators/public.decorator";

@Controller("metrics")
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @Public()
  async getMetrics(@Res() res: Response) {
    const metrics = await this.metricsService.getMetrics();
    res.set("Content-Type", this.metricsService.getContentType());
    res.send(metrics);
  }
}
