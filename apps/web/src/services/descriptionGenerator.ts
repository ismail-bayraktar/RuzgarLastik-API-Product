
interface ProductData {
  title: string;
  brand: string;
  category: "tire" | "rim" | "battery";
  metafields: Record<string, any>;
}

export class DescriptionGeneratorService {
  generateDescription(product: ProductData): string {
    const summary = this.generateSummary(product);
    const specsTable = this.generateSpecsTable(product);
    const footer = this.generateFooter();

    return `
      <div class="ruzgar-product-description" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333;">
        <div style="margin-bottom: 24px;">
          <p style="font-size: 16px;">${summary}</p>
        </div>
        
        ${specsTable}
        
        ${footer}
      </div>
    `;
  }

  private generateSummary(product: ProductData): string {
    const { title, brand, category, metafields } = product;
    
    if (category === "tire") {
      const season = metafields.season === "yaz" ? "Yaz" : 
                     metafields.season === "kis" || metafields.season === "kış" ? "Kış" : 
                     metafields.season === "dort_mevsim" ? "4 Mevsim" : "";
      
      return `<strong>${brand}</strong> kalitesiyle üretilen <strong>${title}</strong>, ${season ? `${season} mevsim koşullarına uygun,` : ""} yüksek performanslı ve güvenli bir sürüş deneyimi sunar. Aracınızın yol tutuşunu ve fren mesafesini optimize etmek için tasarlanmıştır.`;
    }
    
    if (category === "rim") {
      return `<strong>${brand}</strong> tasarımı <strong>${title}</strong> çelik jant, aracınıza şık bir görünüm kazandırırken dayanıklı yapısıyla uzun ömürlü kullanım sağlar.`;
    }
    
    if (category === "battery") {
      return `<strong>${brand}</strong> güvencesiyle <strong>${title}</strong>, yüksek marş gücü ve uzun ömürlü performansı ile aracınızın enerji ihtiyacını eksiksiz karşılar.`;
    }

    return `<strong>${brand}</strong> marka <strong>${title}</strong> ürünü.`;
  }

  private generateSpecsTable(product: ProductData): string {
    const { category, metafields } = product;
    
    let rows = "";

    if (category === "tire") {
      rows = `
        ${this.row("Marka", product.brand)}
        ${this.row("Model", metafields.model || product.title)}
        ${this.row("Genişlik", metafields.width)}
        ${this.row("Kesit Oranı", metafields.aspectRatio)}
        ${this.row("Jant Çapı", metafields.rimDiameter ? `${metafields.rimDiameter}"` : "")}
        ${this.row("Yük Endeksi", metafields.loadIndex)}
        ${this.row("Hız Endeksi", metafields.speedIndex)}
        ${this.row("Mevsim", metafields.season)}
        ${this.row("Yakıt Verimliliği", metafields.fuel)}
        ${this.row("Islak Zemin Tutuşu", metafields.wetGrip)}
        ${this.row("Gürültü Seviyesi", metafields.noise ? `${metafields.noise} dB` : "")}
        ${this.row("Run Flat", metafields.runflat ? "Evet" : "Hayır")}
      `;
    } else if (category === "rim") {
      rows = `
        ${this.row("Marka", product.brand)}
        ${this.row("Model", metafields.model || product.title)}
        ${this.row("Jant Çapı", metafields.diameter ? `${metafields.diameter}"` : "")}
        ${this.row("Jant Genişliği", metafields.width ? `${metafields.width}"` : "")}
        ${this.row("Bijon Aralığı (PCD)", metafields.pcd)}
        ${this.row("Offset (ET)", metafields.offset)}
        ${this.row("Renk", metafields.color)}
      `;
    } else if (category === "battery") {
      rows = `
        ${this.row("Marka", product.brand)}
        ${this.row("Model", metafields.model || product.title)}
        ${this.row("Voltaj", metafields.voltage ? `${metafields.voltage}V` : "")}
        ${this.row("Kapasite", metafields.capacity ? `${metafields.capacity}Ah` : "")}
        ${this.row("Marş Gücü (CCA)", metafields.cca ? `${metafields.cca}A` : "")}
        ${this.row("Kutup Başı", metafields.terminal)}
      `;
    }

    if (!rows) return "";

    return `
      <div style="margin-bottom: 24px; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 14px;">
          <thead style="background-color: #f9fafb;">
            <tr>
              <th colspan="2" style="padding: 12px 16px; font-weight: 600; color: #111827; border-bottom: 1px solid #e5e7eb;">Teknik Özellikler</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  private row(label: string, value: any): string {
    if (value === undefined || value === null || value === "") return "";
    return `
      <tr style="border-bottom: 1px solid #f3f4f6;">
        <td style="padding: 10px 16px; color: #6b7280; width: 40%; font-weight: 500;">${label}</td>
        <td style="padding: 10px 16px; color: #111827;">${value}</td>
      </tr>
    `;
  }

  private generateFooter(): string {
    return `
      <div style="font-size: 12px; color: #9ca3af; margin-top: 32px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        <p>Rüzgar Lastik güvencesiyle. Ücretsiz kargo ve montaj noktası seçenekleri.</p>
      </div>
    `;
  }
}
