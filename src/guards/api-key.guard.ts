import { API_KEY } from "@/api-key";
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException("API key is required");
    }

    if (apiKey !== API_KEY) {
      throw new UnauthorizedException("Invalid API key");
    }

    return true;
  }

  private extractApiKey(request: Request): string | undefined {
    return request.headers["x-api-key"] as string;
  }
}
