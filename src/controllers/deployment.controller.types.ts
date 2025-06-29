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

export class DeploymentData {
  @IsString()
  @ApiProperty({
    type: String,
    required: true,
    example: "dp_1234567890abcdef",
    description: "Unique identifier for the deployment",
  })
  id: string;

  @IsString()
  @ApiProperty({
    type: String,
    required: true,
    example: "container-1234567890abcdef",
    description: "Container identifier",
  })
  container_id: string;

  @IsString()
  @ApiProperty({
    type: String,
    required: true,
    example: "network-1234567890abcdef",
    description: "Network identifier",
  })
  network_id: string;

  @IsString()
  @ApiProperty({
    type: String,
    required: true,
    example: "ubuntu:latest",
    description: "Container image name",
  })
  image: string;

  @IsString()
  @ApiProperty({
    type: String,
    required: true,
    example: "user",
    description: "Username in the container",
  })
  username: string;

  @IsNumber()
  @ApiProperty({
    type: Number,
    required: true,
    example: 1000,
    description: "User ID in the container",
  })
  uid: number;

  @IsNumber()
  @ApiProperty({
    type: Number,
    required: true,
    example: 1000,
    description: "Group ID in the container",
  })
  gid: number;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    type: Number,
    required: true,
    nullable: true,
    example: 512,
    description: "Maximum memory limit in MB",
  })
  max_memory: number | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    type: Number,
    required: true,
    nullable: true,
    example: 1.0,
    description: "Maximum CPU cores",
  })
  max_cpus: number | null;

  @IsObject()
  @ApiProperty({
    type: Object,
    required: true,
    default: {},
    description: "Additional metadata for the deployment",
  })
  metadata: Record<string, any>;

  @IsString()
  @ApiProperty({
    type: String,
    required: true,
    default: "",
    description: "Standard error output from the container",
  })
  stderr: string;

  @ValidateNested()
  @ApiProperty({
    type: Transport,
    required: true,
    description: "Transport configuration for the deployment",
  })
  transport: Transport;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    type: Number,
    required: true,
    example: 300,
    nullable: true,
    description: "Seconds of inactivity before container is paused",
  })
  pause_after_seconds: number | null;

  @IsNumber()
  @IsOptional()
  @ApiProperty({
    type: Number,
    required: false,
    example: 3600,
    nullable: true,
    description: "Seconds of inactivity before deployment is deleted",
  })
  delete_after_seconds: number | null;

  @IsNumber()
  @ApiProperty({
    type: String,
    required: true,
    nullable: true,
    description: "Timestamp when the deployment will be paused",
  })
  pause_at: string | null;

  @IsNumber()
  @ApiProperty({
    type: String,
    required: true,
    nullable: true,
    description: "Timestamp when the deployment will be deleted",
  })
  delete_at: string | null;

  @IsNumber()
  @ApiProperty({
    type: String,
    required: true,
    description: "Timestamp when the deployment was created",
  })
  created_at: string;

  @IsNumber()
  @ApiProperty({
    type: String,
    required: true,
    description: "Timestamp of last interaction with the deployment",
  })
  last_interaction_at: string;
}

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

export class CreateDeploymentBody {
  @IsString({
    message: "Image ID must be a string",
  })
  @ApiProperty({
    type: String,
    required: true,
    example: "tzolov/mcp-everything-server:v2",
    description: "The Docker image ID to use for the deployment",
  })
  image: string;

  @IsOptional()
  @IsString({ each: true })
  @ApiProperty({
    type: [String],
    required: false,
    example: ["--verbose"],
    default: null,
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
  @Min(30)
  @ApiProperty({
    type: Number,
    required: false,
    example: 3600,
    default: null,
    description: "Seconds of inactivity before the deployment is stopped",
  })
  pauseAfterSeconds?: number;

  @IsOptional()
  @IsNumber()
  @Min(30)
  @ValidateIf((o) => o.pauseAfterSeconds !== undefined)
  @ApiProperty({
    type: Number,
    required: false,
    example: 86400,
    default: null,
    description: "Seconds of inactivity before the deployment is deleted. ",
  })
  deleteAfterSeconds?: number;

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
    type: DeploymentData,
    required: true,
    description: "The ID of the created deployment",
  })
  deployment: DeploymentData;

  @ApiProperty({
    type: String,
    required: true,
    example: "Deployment created successfully",
    description: "A message indicating the result of the operation",
  })
  message: string;
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
