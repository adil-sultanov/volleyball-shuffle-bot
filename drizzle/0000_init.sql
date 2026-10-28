CREATE TABLE `chats` (
	`chat_id` integer PRIMARY KEY NOT NULL,
	`title` text,
	`team_size` integer DEFAULT 6 NOT NULL,
	`show_team_sums` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tg_user_id` integer,
	`first_name` text NOT NULL,
	`last_name` text,
	`username` text,
	`display_name` text,
	`strength` integer DEFAULT 3 NOT NULL,
	`rated` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `players_tg_user_id_unique` ON `players` (`tg_user_id`);--> statement-breakpoint
CREATE TABLE `poll_votes` (
	`poll_id` text NOT NULL,
	`player_id` integer NOT NULL,
	`status` text NOT NULL,
	`manual` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	PRIMARY KEY(`poll_id`, `player_id`),
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`poll_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `polls` (
	`poll_id` text PRIMARY KEY NOT NULL,
	`chat_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`question` text NOT NULL,
	`closed` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shuffles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`poll_id` text,
	`chat_id` integer NOT NULL,
	`team_size` integer NOT NULL,
	`result_json` text NOT NULL,
	`message_id` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`poll_id`) REFERENCES `polls`(`poll_id`) ON UPDATE no action ON DELETE set null
);
