import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== "http") return next.handle();

    const req = context.switchToHttp().getRequest();
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const res = context.switchToHttp().getResponse();
          const duration = (Date.now() - start) / 1000;
          this.metricsService.recordHttpRequest(req.method, req.route?.path ?? req.path, res.statusCode, duration);
        },
        error: () => {
          const duration = (Date.now() - start) / 1000;
          this.metricsService.recordHttpRequest(req.method, req.route?.path ?? req.path, 500, duration);
        },
      }),
    );
  }
}
