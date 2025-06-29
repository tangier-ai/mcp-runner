import { API_KEY } from "@/api-key";
import { RateLimiterService } from "@/services/rate-limiter.service";
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const ip = this.extractClientIp(request);
    const apiKey = this.extractApiKey(request);

    // Check if IP is currently rate limited
    if (this.rateLimiter.isBlocked(ip)) {
      throw new ForbiddenException(
        "Too many failed API key attempts. Please wait before trying again.",
      );
    }

    if (!apiKey) {
      this.rateLimiter.recordFailedAttempt(ip);
      throw new UnauthorizedException("API key is required");
    }

    if (apiKey !== API_KEY) {
      this.rateLimiter.recordFailedAttempt(ip);
      throw new UnauthorizedException("Invalid API key");
    }

    // Clear any previous failed attempts on successful validation
    this.rateLimiter.clearSuccessfulAttempt(ip);
    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    return request.headers["x-api-key"] as string;
  }

  private extractClientIp(request: Request): string {
    return (
      (request.headers["x-forwarded-for"] as string) ||
      (request.headers["x-real-ip"] as string) ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      "unknown"
    );
  }
}
