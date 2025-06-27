import { DeploymentTable } from "@/db/schema/deployment";
import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateIf,
  ValidateNested,
} from "class-validator";

export class TransportInput {
  @IsIn(["stdio", "sse", "streamable_http"])
  @ApiProperty({
    type: String,
    enum: ["stdio", "sse", "streamable_http"],
    example: "streamable_http",
    description: "Transport type for the deployment communication",
  })
  type: "stdio" | "sse" | "streamable_http";

  @ValidateIf((obj) => obj.type === "sse" || obj.type === "streamable_http")
  @ApiProperty({
    type: String,
    required: false,
    example: "http://localhost:3000/mcp",
    description: "Endpoint URL (required for SSE and streamable HTTP)",
  })
  endpoint?: string;
}

export class Transport {
  @IsIn(["stdio", "sse", "streamable_http"])
  @ApiProperty({
    type: String,
    enum: ["stdio", "sse", "streamable_http"],
    example: "stdio",
    description: "Transport type for the deployment communication",
  })
  type: "stdio" | "sse" | "streamable_http";

  @ValidateIf((obj) => obj.type === "sse" || obj.type === "streamable_http")
  @IsUrl()
  @ApiProperty({
    type: String,
    required: false,
    example: "http://localhost:3000/sse",
    description: "Endpoint URL (required for SSE and streamable HTTP)",
  })
  endpoint?: string;
}

export class CreateDeploymentBody {
  @IsString({
    message: "Image ID must be a string",
  })
  @ApiProperty({
    type: String,
    required: true,
    example: "mcp/time:latest",
    description: "The Docker image ID to use for the deployment",
  })
  image: string;

  @IsOptional()
  @IsString({ each: true })
  @ApiProperty({
    type: [String],
    required: false,
    example: ["--verbose", "--config=/app/config.json"],
    description: "Command line arguments for the deployment",
  })
  args?: string[];

  @IsOptional()
  @IsObject()
  @ApiProperty({
    type: Object,
    required: false,
    example: { NODE_ENV: "production", PORT: "3000" },
    description: "Environment variables for the deployment",
  })
  env?: Record<string, string>;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @ApiProperty({
    type: Number,
    required: false,
    example: 512,
    description: "Maximum memory in MB for the deployment",
  })
  maxMemory?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.1)
  @ApiProperty({
    type: Number,
    required: false,
    example: 1.5,
    description: "Maximum CPU cores for the deployment",
  })
  maxCpus?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ApiProperty({
    type: Number,
    required: false,
    example: 3600000,
    description:
      "Maximum inactivity time in milliseconds before auto-deletion (null for no auto-deletion)",
    nullable: true,
  })
  maxInactivityDeletion?: number | null;

  @ApiProperty({
    type: Boolean,
    required: false,
    default: true,
    description: "Whether to start the container as soon as it is created",
  })
  autoStart?: boolean;

  @IsOptional()
  @IsObject()
  @ApiProperty({
    type: Object,
    required: false,
    example: { userId: "usr_1234567890", version: "1.0.0" },
    description: "Optional metadata for the deployment",
  })
  metadata?: Record<string, any>;

  @ValidateNested()
  @Type(() => TransportInput)
  @ApiProperty({
    type: TransportInput,
    required: true,
    description: "Transport configuration for the deployment communication",
    examples: {
      stdio: { type: "stdio" },
      sse: { type: "sse", endpoint: "http://localhost:3000/sse" },
      streamable_http: {
        type: "streamable_http",
        endpoint: "http://localhost:3000/mcp",
      },
    },
  })
  transport: TransportInput;
}

export class CreateDeploymentOkResponse {
  @ApiProperty({
    type: String,
    required: true,
    example: "deployment-1234567890abcdef",
    description: "The ID of the created deployment",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "Deployment created successfully",
    description: "A message indicating the result of the operation",
  })
  message: string;
}

export class DeploymentInfo {
  // Unique deployment identifier
  @IsString()
  id: string;

  // Docker container ID
  @IsString()
  containerId: string;

  // Docker image ID used for the deployment
  @IsString()
  image: string;

  // Username of the unprivileged user created for this deployment
  @IsString()
  username: string;

  // User ID of the unprivileged user
  @IsNumber()
  uid: number;

  // Group ID of the unprivileged user
  @IsNumber()
  gid: number;

  // Command line arguments passed to the container
  @IsOptional()
  @IsString({ each: true })
  args?: string[];

  // Environment variables for the container
  @IsOptional()
  @IsObject()
  env?: Record<string, string>;

  // Maximum memory limit in MB
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxMemory?: number;

  // the ip address of the network interface for this deployment
  @IsString()
  ipAddress: string;

  // Maximum CPU cores limit
  @IsOptional()
  @IsNumber()
  @Min(0.1)
  maxCpus?: number;

  // Auto-deletion timeout in milliseconds after last interaction
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxInactivityDeletion?: number | null;

  // Timestamp when the deployment was created
  createdAt: Date;

  // Timestamp of the last interaction with the deployment
  lastInteraction: Date;

  // Optional metadata for the deployment
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  // Deployment state
  state: "started" | "error" | "removed";

  // Error message from stderr if state is error
  error?: string;

  // Transport configuration for deployment communication
  transport: Transport;
}

export class DeploymentListItem {
  @ApiProperty({
    type: String,
    required: true,
    example: "deployment-1234567890abcdef",
    description: "The ID of the deployment",
  })
  id: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "mcp/time:latest",
    description: "The Docker image ID used for the deployment",
  })
  image: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "deployment-user",
    description: "The username of the unprivileged user for this deployment",
  })
  uid: number;

  @ApiProperty({
    type: Number,
    required: true,
    example: 1001,
    description: "The GID of the unprivileged user for this deployment",
  })
  gid: number;
}

export class DeploymentResponse {
  @ApiProperty({
    nullable: true,
  })
  deployment: typeof DeploymentTable.$inferSelect | null;
}

export class DeleteDeploymentResponse {
  @ApiProperty({
    type: String,
    required: true,
    example: "Deployment deleted successfully",
    description: "A message indicating the result of the delete operation",
  })
  message: string;
}

export class ApiErrorResponse {
  @ApiProperty({
    type: String,
    required: true,
    example: "Not Found",
    description: "HTTP error status text",
  })
  error: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "Deployment with ID deployment-123 not found",
    description: "Detailed error message",
  })
  message: string;

  @ApiProperty({
    type: Number,
    required: true,
    example: 404,
    description: "HTTP status code",
  })
  statusCode: number;
}

export class NotFoundResponse {
  @ApiProperty({
    type: String,
    required: true,
    example: "Not Found",
    description: "HTTP error status text",
  })
  error: string;

  @ApiProperty({
    type: String,
    required: true,
    example: "Deployment with ID deployment-123 not found",
    description: "Detailed error message",
  })
  message: string;

  @ApiProperty({
    type: Number,
    required: true,
    example: 404,
    description: "HTTP status code",
  })
  statusCode: number;
}
