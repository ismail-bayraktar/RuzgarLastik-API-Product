
import { describe, expect, test } from "bun:test";
import { DescriptionGeneratorService } from "../services/descriptionGenerator";

describe("DescriptionGeneratorService", () => {
  const service = new DescriptionGeneratorService();

  test("should generate tire description with correct table rows", () => {
    const html = service.generateDescription({
      title: "Lassa Greenways",
      brand: "Lassa",
      category: "tire",
      metafields: {
        width: 205,
        aspectRatio: 55,
        rimDiameter: 16,
        loadIndex: 91,
        speedIndex: "V",
        season: "yaz",
        fuel: "B",
        wetGrip: "A",
        noise: 69
      }
    });

    expect(html).toContain("Lassa");
    expect(html).toContain("205");
    expect(html).toContain("55");
    expect(html).toContain("16&quot;"); // Jant Çapı
    expect(html).toContain("Yaz"); // Mevsim
    expect(html).toContain("Gürültü Seviyesi");
  });

  test("should generate rim description", () => {
    const html = service.generateDescription({
      title: "CMS 822",
      brand: "CMS",
      category: "rim",
      metafields: {
        width: 7.5,
        diameter: 17,
        pcd: "5x112",
        offset: 45
      }
    });

    expect(html).toContain("CMS");
    expect(html).toContain("Jant Genişliği");
    expect(html).toContain("7.5&quot;");
    expect(html).toContain("Bijon Aralığı (PCD)");
    expect(html).toContain("5x112");
  });

  test("should prevent XSS attacks in title and brand", () => {
    const maliciousTitle = "<script>alert('xss')</script>";
    const maliciousBrand = "Hacker <img src=x onerror=alert(1)>";
    
    const html = service.generateDescription({
      title: maliciousTitle,
      brand: maliciousBrand,
      category: "tire",
      metafields: { width: 205 }
    });

    // Should NOT contain raw script tags
    expect(html).not.toContain("<script>");
    // Should contain escaped versions
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  test("should prevent XSS in metafield values", () => {
    const html = service.generateDescription({
      title: "Normal Title",
      brand: "Normal Brand",
      category: "tire",
      metafields: {
        season: "yaz <script>"
      }
    });

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
