import { db } from "@workspace/db/client";
import { priceRules } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

export interface PriceRule {
  id: string;
  category: "tire" | "rim" | "battery";
  brand?: string;
  segment?: "premium" | "mid" | "economy";
  minPrice?: number;
  maxPrice?: number;
  marginPercent: number;
  fixedMarkup?: number;
  active: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApplyPriceResult {
  supplierPrice: number;
  finalPrice: number;
  marginPercent: number;
  fixedMarkup: number;
  appliedRuleId?: string;
}

export class PricingRulesService {
  async getRules(options?: { category?: string; active?: boolean }): Promise<PriceRule[]> {
    const conditions = [];
    
    if (options?.category) {
      conditions.push(eq(priceRules.category, options.category as any));
    }
    
    if (options?.active !== undefined) {
      conditions.push(eq(priceRules.active, options.active));
    }

    const rules = await db
      .select()
      .from(priceRules)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(priceRules.priority);

    return rules as PriceRule[];
  }

  async createRule(rule: Omit<PriceRule, "id" | "createdAt" | "updatedAt">): Promise<PriceRule> {
    const [newRule] = await db
      .insert(priceRules)
      .values({
        ...rule,
        id: crypto.randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return newRule as PriceRule;
  }

  async updateRule(id: string, updates: Partial<PriceRule>): Promise<PriceRule> {
    const [updatedRule] = await db
      .update(priceRules)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(priceRules.id, id))
      .returning();

    if (!updatedRule) {
      throw new Error(`Price rule with id ${id} not found`);
    }

    return updatedRule as PriceRule;
  }

  async deleteRule(id: string): Promise<void> {
    await db.delete(priceRules).where(eq(priceRules.id, id));
  }

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
      // Check if rule matches
      if (rule.brand && rule.brand !== brand) continue;
      if (rule.segment && rule.segment !== segment) continue;
      if (rule.minPrice && supplierPrice < rule.minPrice) continue;
      if (rule.maxPrice && supplierPrice > rule.maxPrice) continue;

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
    let finalPrice = supplierPrice * (1 + matchedRule.marginPercent / 100);
    
    if (matchedRule.fixedMarkup) {
      finalPrice += matchedRule.fixedMarkup;
    }

    return {
      supplierPrice,
      finalPrice: Math.round(finalPrice * 100) / 100,
      marginPercent: matchedRule.marginPercent,
      fixedMarkup: matchedRule.fixedMarkup || 0,
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
        category: "tire" as const,
        brand: "Michelin",
        segment: "premium" as const,
        marginPercent: 25,
        fixedMarkup: 50,
        active: true,
        priority: 1,
      },
      {
        category: "tire" as const,
        brand: "Continental",
        segment: "premium" as const,
        marginPercent: 25,
        fixedMarkup: 50,
        active: true,
        priority: 1,
      },
      {
        category: "tire" as const,
        brand: "Bridgestone",
        segment: "premium" as const,
        marginPercent: 25,
        fixedMarkup: 50,
        active: true,
        priority: 1,
      },
      // Economy tire brands
      {
        category: "tire" as const,
        brand: "Lassa",
        segment: "economy" as const,
        marginPercent: 15,
        active: true,
        priority: 2,
      },
      // Default tire pricing
      {
        category: "tire" as const,
        marginPercent: 20,
        active: true,
        priority: 10,
      },
      // Rim pricing
      {
        category: "rim" as const,
        marginPercent: 30,
        fixedMarkup: 100,
        active: true,
        priority: 1,
      },
      // Battery pricing
      {
        category: "battery" as const,
        marginPercent: 18,
        fixedMarkup: 75,
        active: true,
        priority: 1,
      },
    ];

    for (const rule of defaultRules) {
      await this.createRule(rule);
    }

    console.log(`Seeded ${defaultRules.length} default pricing rules`);
  }
}
