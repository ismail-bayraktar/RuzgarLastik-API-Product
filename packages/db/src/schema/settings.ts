import { pgTable, varchar, timestamp } from "drizzle-orm/pg-core";

export const settings = pgTable("settings", {
	key: varchar("key", { length: 100 }).primaryKey(),
	value: varchar("value", { length: 1000 }).notNull(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
