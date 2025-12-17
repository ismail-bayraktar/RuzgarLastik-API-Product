import { pgTable, serial, varchar, numeric, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const priceRules = pgTable("price_rules", {
	id: serial("id").primaryKey(),
	name: varchar("name", { length: 100 }).notNull(),
	category: varchar("category", { length: 50 }).notNull(),
	matchField: varchar("match_field", { length: 50 }).notNull(),
	matchValue: varchar("match_value", { length: 255 }).notNull(),
	percentageMarkup: numeric("percentage_markup", { precision: 5, scale: 2 }),
	fixedMarkup: numeric("fixed_markup", { precision: 10, scale: 2 }),
	isActive: boolean("is_active").default(true),
	priority: integer("priority").default(0),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
