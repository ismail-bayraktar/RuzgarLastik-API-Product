export interface ShopifyProduct {
  id: string;
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  variants: ShopifyVariant[];
  images?: ShopifyImage[];
  metafields?: ShopifyMetafield[];
}

export interface ShopifyVariant {
  id: string;
  sku?: string;
  price: string;
  barcode?: string;
  inventoryItem?: {
    id: string;
  };
  inventoryQuantity?: number;
}

export interface ShopifyImage {
  id?: string;
  src: string;
  altText?: string;
}

export interface ShopifyMetafield {
  id?: string;
  namespace: string;
  key: string;
  value: string;
  type: string;
}

export interface CreateProductInput {
  title: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: "ACTIVE" | "DRAFT";
  variants: Array<{
    sku?: string;
    price: string;
    barcode?: string;
  }>;
  images?: Array<{
    src: string;
    altText?: string;
  }>;
  metafields?: Array<{
    namespace: string;
    key: string;
    value: string;
    type: string;
  }>;
}

export interface UpdateProductInput {
  id: string;
  title?: string;
  descriptionHtml?: string;
  vendor?: string;
  productType?: string;
  tags?: string[];
  status?: "ACTIVE" | "DRAFT" | "ARCHIVED";
}

export interface UpdateVariantInput {
  id: string;
  price?: string;
  barcode?: string;
}

export interface UpdateInventoryInput {
  inventoryItemId: string;
  locationId: string;
  availableQuantity: number;
}

export class ShopifyService {
  private shopDomain: string;
  private accessToken: string;
  private apiVersion: string;
  private locationId: string;

  constructor(config: {
    shopDomain: string;
    accessToken: string;
    apiVersion?: string;
    locationId: string;
  }) {
    this.shopDomain = config.shopDomain;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || "2024-10";
    this.locationId = config.locationId;

    if (!this.shopDomain || !this.accessToken || !this.locationId) {
      throw new Error(
        "Shopify configuration incomplete. Required: shopDomain, accessToken, locationId"
      );
    }
  }

  private async graphql<T = any>(query: string, variables?: Record<string, any>): Promise<T> {
    const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": this.accessToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`Shopify GraphQL error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();

    if (json.errors) {
      throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
    }

    return json.data;
  }

  async getProductBySku(sku: string): Promise<ShopifyProduct | null> {
    const query = `
      query getProductBySku($query: String!) {
        products(first: 1, query: $query) {
          edges {
            node {
              id
              title
              descriptionHtml
              vendor
              productType
              tags
              status
              variants(first: 10) {
                edges {
                  node {
                    id
                    sku
                    price
                    barcode
                    inventoryItem {
                      id
                    }
                    inventoryQuantity
                  }
                }
              }
              images(first: 10) {
                edges {
                  node {
                    id
                    src
                    altText
                  }
                }
              }
              metafields(first: 50) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                    type
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.graphql<any>(query, { query: `sku:${sku}` });

    if (!data.products.edges.length) {
      return null;
    }

    const node = data.products.edges[0].node;

    return {
      id: node.id,
      title: node.title,
      descriptionHtml: node.descriptionHtml,
      vendor: node.vendor,
      productType: node.productType,
      tags: node.tags,
      status: node.status,
      variants: node.variants.edges.map((e: any) => e.node),
      images: node.images?.edges.map((e: any) => e.node) || [],
      metafields: node.metafields?.edges.map((e: any) => e.node) || [],
    };
  }

  async createProduct(input: CreateProductInput): Promise<ShopifyProduct> {
    const mutation = `
      mutation createProduct($input: ProductInput!) {
        productCreate(input: $input) {
          product {
            id
            title
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  sku
                  price
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphql<any>(mutation, { input });

    if (data.productCreate.userErrors.length > 0) {
      throw new Error(
        `Shopify product creation errors: ${JSON.stringify(data.productCreate.userErrors)}`
      );
    }

    return data.productCreate.product;
  }

  async updateProduct(input: UpdateProductInput): Promise<ShopifyProduct> {
    const mutation = `
      mutation updateProduct($input: ProductInput!) {
        productUpdate(input: $input) {
          product {
            id
            title
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphql<any>(mutation, { input });

    if (data.productUpdate.userErrors.length > 0) {
      throw new Error(
        `Shopify product update errors: ${JSON.stringify(data.productUpdate.userErrors)}`
      );
    }

    return data.productUpdate.product;
  }

  async updateVariant(input: UpdateVariantInput): Promise<ShopifyVariant> {
    const mutation = `
      mutation updateVariant($input: ProductVariantInput!) {
        productVariantUpdate(input: $input) {
          productVariant {
            id
            sku
            price
            barcode
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const data = await this.graphql<any>(mutation, { input });

    if (data.productVariantUpdate.userErrors.length > 0) {
      throw new Error(
        `Shopify variant update errors: ${JSON.stringify(data.productVariantUpdate.userErrors)}`
      );
    }

    return data.productVariantUpdate.productVariant;
  }

  async updateInventory(input: UpdateInventoryInput): Promise<void> {
    const mutation = `
      mutation inventorySetOnHandQuantities($input: InventorySetOnHandQuantitiesInput!) {
        inventorySetOnHandQuantities(input: $input) {
          inventoryAdjustmentGroup {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const adjustmentInput = {
      reason: "correction",
      setQuantities: [
        {
          inventoryItemId: input.inventoryItemId,
          locationId: this.locationId,
          quantity: input.availableQuantity,
        },
      ],
    };

    const data = await this.graphql<any>(mutation, { input: adjustmentInput });

    if (data.inventorySetOnHandQuantities.userErrors.length > 0) {
      throw new Error(
        `Shopify inventory update errors: ${JSON.stringify(
          data.inventorySetOnHandQuantities.userErrors
        )}`
      );
    }
  }

  async setMetafields(
    ownerId: string,
    metafields: Array<{ namespace: string; key: string; value: string; type: string }>
  ): Promise<void> {
    const mutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
            namespace
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const metafieldsInput = metafields.map((mf) => ({
      ownerId,
      namespace: mf.namespace,
      key: mf.key,
      value: mf.value,
      type: mf.type,
    }));

    const data = await this.graphql<any>(mutation, { metafields: metafieldsInput });

    if (data.metafieldsSet.userErrors.length > 0) {
      throw new Error(
        `Shopify metafields set errors: ${JSON.stringify(data.metafieldsSet.userErrors)}`
      );
    }
  }

  async calculateGraphQLCost(): Promise<{ requestedQueryCost: number; actualQueryCost: number }> {
    const query = `
      query {
        shop {
          name
        }
      }
    `;

    const response = await fetch(
      `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": this.accessToken,
        },
        body: JSON.stringify({ query }),
      }
    );

    const json = await response.json();
    const extensions = json.extensions?.cost;

    return {
      requestedQueryCost: extensions?.requestedQueryCost || 0,
      actualQueryCost: extensions?.actualQueryCost || 0,
    };
  }
}
