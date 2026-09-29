CREATE TABLE `game_rooms` (
  `id` text PRIMARY KEY NOT NULL,
  `version` integer NOT NULL,
  `payload` text NOT NULL,
  `listed` integer NOT NULL,
  `started` integer NOT NULL,
  `allow_spectators` integer NOT NULL,
  `host_seen` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_game_rooms_listed` ON `game_rooms` (`listed`);
--> statement-breakpoint
CREATE TABLE `game_presence` (
  `room_id` text NOT NULL,
  `seat` integer NOT NULL,
  `seen` integer NOT NULL,
  PRIMARY KEY(`room_id`, `seat`),
  FOREIGN KEY (`room_id`) REFERENCES `game_rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `game_rate_limits` (
  `key` text PRIMARY KEY NOT NULL,
  `window` integer NOT NULL,
  `count` integer NOT NULL
);
