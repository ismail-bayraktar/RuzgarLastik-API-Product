
import { describe, expect, test } from "bun:test";
import { TitleParserService } from "../services/titleParserService";
import { parserTestCases } from "./parser-cases";

describe("TitleParserService Robustness", () => {
  const parser = new TitleParserService();

  for (const testCase of parserTestCases) {
    test(`should parse: ${testCase.input}`, () => {
      // 1. Category Detection
      const detectedCategory = parser.detectCategory(testCase.input);
      expect(detectedCategory).toBe(testCase.expectedCategory as any);

      // 2. Attribute Parsing
      const result = parser.parseDetailed(testCase.expectedCategory as any, testCase.input);
      
      expect(result.success).toBe(true);
      
      // Check expected fields
      for (const [key, value] of Object.entries(testCase.expected)) {
        // Handle floating point precision if necessary, but direct compare is usually fine for these
        expect(result.data?.[key]).toBe(value);
      }
    });
  }
});
