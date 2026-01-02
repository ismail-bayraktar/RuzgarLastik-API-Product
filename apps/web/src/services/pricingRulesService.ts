import { db, eq, and } from "@my-better-t-app/db";
import { priceRules } from "@my-better-t-app/db/schema";

/**
 * Database schema-aligned interface for price rules
 * Matches packages/db/src/schema/pricing.ts
 */
export interface PriceRule {
  id: number;
  name: string;
  category: string;
  matchField: string;
  matchValue: string;
  percentageMarkup: string | null;
  fixedMarkup: string | null;
  isActive: boolean | null;
  priority: number | null;
  createdAt: Date | null;
  updatedAt: Date | null;
}

export interface ApplyPriceResult {
  supplierPrice: number;
  finalPrice: number;
  marginPercent: number;
  fixedMarkup: number;
  appliedRuleId?: number;
}

export class PricingRulesService {
  async getRules(options?: { category?: string; active?: boolean }): Promise<PriceRule[]> {
    const conditions = [];

    if (options?.category) {
      conditions.push(eq(priceRules.category, options.category));
    }

    if (options?.active !== undefined) {
      conditions.push(eq(priceRules.isActive, options.active));
    }

    const rules = await db
      .select()
      .from(priceRules)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(priceRules.priority);

    return rules as PriceRule[];
  }

  async createRule(rule: {
    name: string;
    category: string;
    matchField: string;
    matchValue: string;
    percentageMarkup?: number;
    fixedMarkup?: number;
    isActive?: boolean;
    priority?: number;
  }): Promise<PriceRule> {
    const [newRule] = await db
      .insert(priceRules)
      .values({
        name: rule.name,
        category: rule.category,
        matchField: rule.matchField,
        matchValue: rule.matchValue,
        percentageMarkup: rule.percentageMarkup?.toString(),
        fixedMarkup: rule.fixedMarkup?.toString(),
        isActive: rule.isActive ?? true,
        priority: rule.priority ?? 0,
      })
      .returning();

    return newRule as PriceRule;
  }

  async updateRule(id: number, updates: Partial<{
    name: string;
    category: string;
    matchField: string;
    matchValue: string;
    percentageMarkup: number;
    fixedMarkup: number;
    isActive: boolean;
    priority: number;
  }>): Promise<PriceRule> {
    const setValues: Record<string, any> = {
      updatedAt: new Date(),
    };

    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.category !== undefined) setValues.category = updates.category;
    if (updates.matchField !== undefined) setValues.matchField = updates.matchField;
    if (updates.matchValue !== undefined) setValues.matchValue = updates.matchValue;
    if (updates.percentageMarkup !== undefined) setValues.percentageMarkup = updates.percentageMarkup.toString();
    if (updates.fixedMarkup !== undefined) setValues.fixedMarkup = updates.fixedMarkup.toString();
    if (updates.isActive !== undefined) setValues.isActive = updates.isActive;
    if (updates.priority !== undefined) setValues.priority = updates.priority;

    const [updatedRule] = await db
      .update(priceRules)
      .set(setValues)
      .where(eq(priceRules.id, id))
      .returning();

    if (!updatedRule) {
      throw new Error(`Price rule with id ${id} not found`);
    }

    return updatedRule as PriceRule;
  }

  async deleteRule(id: number): Promise<void> {
    await db.delete(priceRules).where(eq(priceRules.id, id));
  }

  /**
   * Apply pricing rules to a supplier price
   * Rules are matched by: category + matchField (brand, segment, etc.) + matchValue
   */
  async applyPricing(
    supplierPrice: number,
    category: "tire" | "rim" | "battery",
    brand?: string,
    segment?: "premium" | "mid" | "economy"
  ): Promise<ApplyPriceResult> {
    // Get all active rules for this category, ordered by priority
    const rules = await this.getRules({ category, active: true });

    // Find the first matching rule
    let matchedRule: PriceRule | undefined;

    for (const rule of rules) {
      // Match based on matchField and matchValue
      const matchField = rule.matchField.toLowerCase();
      const matchValue = rule.matchValue.toLowerCase();

      if (matchField === "brand" && brand) {
        if (brand.toLowerCase() !== matchValue) continue;
      } else if (matchField === "segment" && segment) {
        if (segment.toLowerCase() !== matchValue) continue;
      } else if (matchField === "all" || matchField === "*") {
        // Matches everything in this category
      } else {
        // Unknown match field, skip
        continue;
      }

      matchedRule = rule;
      break;
    }

    // If no rule matched, use default pricing (20% margin)
    if (!matchedRule) {
      const defaultMargin = 20;
      const finalPrice = supplierPrice * (1 + defaultMargin / 100);
      return {
        supplierPrice,
        finalPrice: Math.round(finalPrice * 100) / 100,
        marginPercent: defaultMargin,
        fixedMarkup: 0,
      };
    }

    // Apply matched rule
    const marginPercent = parseFloat(matchedRule.percentageMarkup || "0");
    const fixedMarkup = parseFloat(matchedRule.fixedMarkup || "0");

    let finalPrice = supplierPrice * (1 + marginPercent / 100);
    finalPrice += fixedMarkup;

    return {
      supplierPrice,
      finalPrice: Math.round(finalPrice * 100) / 100,
      marginPercent,
      fixedMarkup,
      appliedRuleId: matchedRule.id,
    };
  }

  async seedDefaultRules(): Promise<void> {
    // Check if rules already exist
    const existingRules = await this.getRules();
    if (existingRules.length > 0) {
      console.log("Default pricing rules already exist, skipping seed...");
      return;
    }

    // Default rules based on docs/05-pricing-logic.md
    const defaultRules = [
      // Premium tire brands
      {
        name: "Michelin Premium",
        category: "tire",
        matchField: "brand",
        matchValue: "Michelin",
        percentageMarkup: 25,
        fixedMarkup: 50,
        isActive: true,
        priority: 1,
      },
      {
        name: "Continental Premium",
        category: "tire",
        matchField: "brand",
        matchValue: "Continental",
        percentageMarkup: 25,
        fixedMarkup: 50,
        isActive: true,
        priority: 1,
      },
      {
        name: "Bridgestone Premium",
        category: "tire",
        matchField: "brand",
        matchValue: "Bridgestone",
        percentageMarkup: 25,
        fixedMarkup: 50,
        isActive: true,
        priority: 1,
      },
      // Economy tire brands
      {
        name: "Lassa Economy",
        category: "tire",
        matchField: "brand",
        matchValue: "Lassa",
        percentageMarkup: 15,
        isActive: true,
        priority: 2,
      },
      // Default tire pricing (catch-all)
      {
        name: "Default Tire",
        category: "tire",
        matchField: "all",
        matchValue: "*",
        percentageMarkup: 20,
        isActive: true,
        priority: 100,
      },
      // Rim pricing
      {
        name: "Default Rim",
        category: "rim",
        matchField: "all",
        matchValue: "*",
        percentageMarkup: 30,
        fixedMarkup: 100,
        isActive: true,
        priority: 1,
      },
      // Battery pricing
      {
        name: "Default Battery",
        category: "battery",
        matchField: "all",
        matchValue: "*",
        percentageMarkup: 18,
        fixedMarkup: 75,
        isActive: true,
        priority: 1,
      },
    ];

    for (const rule of defaultRules) {
      await this.createRule(rule);
    }

    console.log(`Seeded ${defaultRules.length} default pricing rules`);
  }
}
