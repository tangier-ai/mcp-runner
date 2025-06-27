CREATE TABLE `Deployment` (
	`id` text PRIMARY KEY NOT NULL,
	`container_id` text NOT NULL,
	`network_id` text NOT NULL,
	`image` text NOT NULL,
	`uid` integer NOT NULL,
	`gid` integer NOT NULL,
	`max_memory` integer,
	`max_cpus` real,
	`metadata` text DEFAULT '{}' NOT NULL,
	`stderr` text DEFAULT '' NOT NULL,
	`transport` text NOT NULL,
	`pause_after_seconds` integer,
	`delete_after_seconds` integer,
	`pause_at` integer GENERATED ALWAYS AS (CASE 
      WHEN "pause_after_seconds" IS NULL THEN NULL 
      ELSE "last_interaction_at" + ("pause_after_seconds" * 1000)
    END) STORED,
	`delete_at` integer GENERATED ALWAYS AS (CASE 
      WHEN "delete_after_seconds" IS NULL THEN NULL 
      ELSE "last_interaction_at" + ("delete_after_seconds" * 1000)
    END) STORED,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`last_interaction_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `pause_at` ON `Deployment` (`pause_at`);--> statement-breakpoint
CREATE INDEX `delete_at` ON `Deployment` (`delete_at`);