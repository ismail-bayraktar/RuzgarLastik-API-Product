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
  categoryId?: string;
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
  categoryId?: string;
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

import {
  ShopifyRateLimiter,
  ESTIMATED_COSTS,
  parseCostFromResponse,
  getSharedRateLimiter,
} from "./rateLimiter";
import {
  withRetry,
  createShopifyRetryOptions,
} from "./retryUtils";

export interface ShopifyServiceConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion?: string;
  locationId: string;
  /** Enable rate limiting (default: true) */
  enableRateLimiting?: boolean;
  /** Enable automatic retry on transient errors (default: true) */
  enableRetry?: boolean;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

export class ShopifyService {
  private shopDomain: string;
  private accessToken: string;
  private apiVersion: string;
  private locationId: string;
  private rateLimiter: ShopifyRateLimiter;
  private enableRateLimiting: boolean;
  private enableRetry: boolean;
  private debug: boolean;

  constructor(config: ShopifyServiceConfig) {
    this.shopDomain = config.shopDomain;
    this.accessToken = config.accessToken;
    this.apiVersion = config.apiVersion || "2024-10";
    this.locationId = config.locationId;
    this.enableRateLimiting = config.enableRateLimiting ?? true;
    this.enableRetry = config.enableRetry ?? true;
    this.debug = config.debug ?? false;

    // Use shared rate limiter for all instances
    this.rateLimiter = getSharedRateLimiter({ debug: this.debug });

    if (!this.shopDomain || !this.accessToken || !this.locationId) {
      throw new Error(
        "Shopify configuration incomplete. Required: shopDomain, accessToken, locationId"
      );
    }
  }

  private async graphql<T = any>(
    query: string,
    variables?: Record<string, any>,
    estimatedCost?: number
  ): Promise<T> {
    const url = `https://${this.shopDomain}/admin/api/${this.apiVersion}/graphql.json`;

    // Wait for rate limit capacity if enabled
    if (this.enableRateLimiting && estimatedCost) {
      await this.rateLimiter.waitForCapacity(estimatedCost);
    }

    const executeRequest = async () => {
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

      const json = (await response.json()) as {
        data?: T;
        errors?: Array<{ message: string }>;
        extensions?: { cost: unknown };
      };

      // Update rate limiter with actual cost from response
      if (this.enableRateLimiting) {
        const costInfo = parseCostFromResponse(json);
        if (costInfo) {
          this.rateLimiter.updateFromResponse(costInfo);
        }
      }

      if (json.errors) {
        throw new Error(`Shopify GraphQL errors: ${JSON.stringify(json.errors)}`);
      }

      return json.data as T;
    };

    // Apply retry logic if enabled
    if (this.enableRetry) {
      return withRetry(executeRequest, createShopifyRetryOptions(this.debug));
    }

    return executeRequest();
  }

  /**
   * Get current rate limiter status
   */
  getRateLimiterStatus() {
    return this.rateLimiter.getStatus();
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

    const data = await this.graphql<any>(query, { query: `sku:${sku}` }, ESTIMATED_COSTS.getProductBySku);

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
    // Step 1: Create product with basic info (no variants/images in ProductCreateInput for 2024+ API)
    const createMutation = `
      mutation createProduct($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
        productCreate(product: $product, media: $media) {
          product {
            id
            title
            status
            variants(first: 1) {
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

    // Build ProductCreateInput (2024+ format - no variants/images here)
    const productInput: Record<string, unknown> = {
      title: input.title,
      descriptionHtml: input.descriptionHtml || "",
      vendor: input.vendor || "",
      productType: input.productType || "",
      status: input.status || "ACTIVE",
    };

    if (input.categoryId) {
      productInput.category = input.categoryId;
    }

    // Handle tags if present
    if (input.tags && input.tags.length > 0) {
      productInput.tags = input.tags;
    }

    // Handle metafields if present
    if (input.metafields && input.metafields.length > 0) {
      productInput.metafields = input.metafields.map(mf => ({
        namespace: mf.namespace,
        key: mf.key,
        value: mf.value,
        type: mf.type
      }));
    }

    // DEBUG: Log payload
    if (this.debug) {
      console.log("Shopify createProduct Payload:", JSON.stringify(productInput, null, 2));
    }

    // Build media input for images (separate parameter in 2024+ API)
    let mediaInput: Array<{ originalSource: string; alt: string; mediaContentType: string }> | undefined;
    if (input.images && input.images.length > 0) {
      mediaInput = input.images
        .filter(img => img.src && img.src.trim() !== "")
        .map(img => ({
          originalSource: img.src,
          alt: img.altText || input.title,
          mediaContentType: "IMAGE",
        }));
    }

    const createData = await this.graphql<any>(
      createMutation,
      {
        product: productInput,
        media: mediaInput && mediaInput.length > 0 ? mediaInput : undefined
      },
      ESTIMATED_COSTS.createProduct
    );

    if (createData.productCreate.userErrors.length > 0) {
      throw new Error(
        `Shopify product creation errors: ${JSON.stringify(createData.productCreate.userErrors)}`
      );
    }

    const createdProduct = createData.productCreate.product;
    let finalVariants: ShopifyVariant[] = createdProduct.variants?.edges?.map((e: any) => e.node) || [];

    // Step 2: Update the default variant with price, barcode using productVariantsBulkUpdate (2024+ API)
    const variantData = input.variants?.[0];
    const defaultVariantId = createdProduct.variants?.edges?.[0]?.node?.id;

    if (defaultVariantId && variantData) {
      const bulkUpdateMutation = `
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            product {
              id
            }
            productVariants {
              id
              price
              barcode
              inventoryItem {
                id
                sku
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variantInput: Record<string, unknown> = {
        id: defaultVariantId,
        price: variantData.price,
        inventoryManagement: "SHOPIFY", // Enable inventory tracking
      };

      // Only set barcode if provided and not empty
      if (variantData.barcode && variantData.barcode.trim() !== "") {
        variantInput.barcode = variantData.barcode;
      }

      const bulkUpdateData = await this.graphql<any>(
        bulkUpdateMutation,
        {
          productId: createdProduct.id,
          variants: [variantInput]
        },
        ESTIMATED_COSTS.updateVariant
      );

      if (bulkUpdateData.productVariantsBulkUpdate.userErrors.length > 0) {
        console.warn(
          `Variant bulk update warnings: ${JSON.stringify(bulkUpdateData.productVariantsBulkUpdate.userErrors)}`
        );
      }

      const updatedVariant = bulkUpdateData.productVariantsBulkUpdate.productVariants?.[0];

      // Step 3: Update SKU via inventoryItemUpdate if SKU is provided
      if (variantData.sku && variantData.sku.trim() !== "" && updatedVariant?.inventoryItem?.id) {
        const inventoryUpdateMutation = `
          mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
            inventoryItemUpdate(id: $id, input: $input) {
              inventoryItem {
                id
                sku
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const inventoryUpdateData = await this.graphql<any>(
          inventoryUpdateMutation,
          {
            id: updatedVariant.inventoryItem.id,
            input: { sku: variantData.sku }
          },
          5 // Low cost operation
        );

        if (inventoryUpdateData.inventoryItemUpdate.userErrors.length > 0) {
          console.warn(
            `SKU update warnings: ${JSON.stringify(inventoryUpdateData.inventoryItemUpdate.userErrors)}`
          );
        }
      }

      // Update our local finalVariants array if we have an updated variant
      if (updatedVariant) {
        finalVariants = [updatedVariant];
      }
    }

    return {
      id: createdProduct.id,
      title: createdProduct.title,
      status: createdProduct.status,
      variants: finalVariants,
      images: [] // images are handled separately in media mutation if needed, or mapped from createdProduct
    };
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

    const productInput: any = { ...input };
    if (input.categoryId) {
      productInput.category = input.categoryId;
      delete productInput.categoryId; // Cleanup internal name
    }

    const data = await this.graphql<any>(mutation, { input: productInput }, ESTIMATED_COSTS.updateProduct);

    if (data.productUpdate.userErrors.length > 0) {
      throw new Error(
        `Shopify product update errors: ${JSON.stringify(data.productUpdate.userErrors)}`
      );
    }

    return data.productUpdate.product;
  }

  async updateVariant(input: UpdateVariantInput): Promise<ShopifyVariant> {
    const mutation = `
      mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
        productVariantsBulkUpdate(productId: $productId, variants: $variants) {
          productVariants {
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

    // We need productId for bulk update. Since UpdateVariantInput only has variant ID, 
    // we assume the variant ID is global and sufficient, BUT productVariantsBulkUpdate REQUIRES productId.
    // This is a breaking change in our internal interface.
    // WORKAROUND: We will fetch the variant first to get the productId, OR we change the interface.
    // Better approach: Use the legacy 'productVariantUpdate' if it exists, but error says no.
    // Let's check API docs. 'productVariantUpdate' DOES exist in 2024-10.
    // Maybe the issue is the field name or scope. 
    // Wait, the error says "Field 'productVariantUpdate' doesn't exist on type 'Mutation'".
    // This is extremely strange for 2024-10.
    // Let's try 'productVariantUpdate' again but ensure no typo.
    // Actually, let's use the mutation we KNOW works from createProduct: productVariantsBulkUpdate.
    // But we need productId.
    
    // For now, let's fetch the product ID from the variant ID first.
    const query = `
      query getProductOfVariant($id: ID!) {
        node(id: $id) {
          ... on ProductVariant {
            product {
              id
            }
          }
        }
      }
    `;
    
    const nodeData = await this.graphql<any>(query, { id: input.id }, 5);
    const productId = nodeData.node?.product?.id;

    if (!productId) {
      throw new Error(`Could not find product for variant ${input.id}`);
    }

    const variantInput: Record<string, unknown> = {
      id: input.id,
      price: input.price,
      inventoryManagement: "SHOPIFY", // Enable inventory tracking
    };
    if (input.barcode) variantInput.barcode = input.barcode;

    const data = await this.graphql<any>(mutation, { 
      productId, 
      variants: [variantInput] 
    }, ESTIMATED_COSTS.updateVariant);

    if (data.productVariantsBulkUpdate.userErrors.length > 0) {
      throw new Error(
        `Shopify variant update errors: ${JSON.stringify(data.productVariantsBulkUpdate.userErrors)}`
      );
    }

    return data.productVariantsBulkUpdate.productVariants[0];
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

    const data = await this.graphql<any>(mutation, { input: adjustmentInput }, ESTIMATED_COSTS.updateInventory);

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
    // Import dynamically to avoid circular dependencies
    const { prepareMetafieldsForShopify } = await import("./metafieldUtils");

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

    // Convert to raw format and use prepareMetafieldsForShopify for validation
    const rawMetafields: Record<string, unknown> = {};
    for (const mf of metafields) {
      rawMetafields[mf.key] = mf.value;
    }

    const validatedMetafields = prepareMetafieldsForShopify(rawMetafields, metafields[0]?.namespace || "custom");

    if (validatedMetafields.length === 0) {
      console.warn("No valid metafields to set after validation");
      return;
    }

    const metafieldsInput = validatedMetafields.map((mf) => ({
      ownerId,
      namespace: mf.namespace,
      key: mf.key,
      value: mf.value,
      type: mf.type,
    }));

    // DEBUG: Log payload
    if (this.debug) {
      console.log("Shopify setMetafields Payload:", JSON.stringify(metafieldsInput, null, 2));
    }

    const data = await this.graphql<any>(mutation, { metafields: metafieldsInput }, ESTIMATED_COSTS.setMetafields);

    if (data.metafieldsSet.userErrors.length > 0) {
      throw new Error(
        `Shopify metafields set errors: ${JSON.stringify(data.metafieldsSet.userErrors)}`
      );
    }
  }

  async ensureMetafieldDefinitions(): Promise<string[]> {
    const { METAFIELD_DEFINITIONS } = await import("./metafieldUtils");
    const createdDefinitions: string[] = [];

    // 1. Get existing definitions
    const query = `
      query {
        metafieldDefinitions(first: 250, ownerType: PRODUCT, namespace: "custom") {
          edges {
            node {
              key
              id
            }
          }
        }
      }
    `;

    const existingData = await this.graphql<any>(query, {}, 10);
    const existingKeys = new Set(existingData.metafieldDefinitions.edges.map((e: any) => e.node.key));

    // 2. Create missing definitions
    for (const [key, def] of Object.entries(METAFIELD_DEFINITIONS)) {
      if (!existingKeys.has(key)) {
        try {
          await this.createMetafieldDefinition(key, def.name, def.type);
          createdDefinitions.push(key);
          console.log(`Created metafield definition: ${key}`);
        } catch (error) {
          console.error(`Failed to create definition for ${key}:`, error);
        }
      }
    }

    return createdDefinitions;
  }

  async ensureSmartCollections(): Promise<string[]> {
    const collectionsToCreate = [
      {
        title: "Oto Lastik",
        rule: { column: "TAG", relation: "EQUALS", condition: "Kategori:Lastik" },
        description: "Tüm lastik modellerimiz."
      },
      {
        title: "Çelik Jant",
        rule: { column: "TAG", relation: "EQUALS", condition: "Kategori:Jant" },
        description: "Tüm jant modellerimiz."
      },
      {
        title: "Akü",
        rule: { column: "TAG", relation: "EQUALS", condition: "Kategori:Akü" },
        description: "Tüm akü çeşitlerimiz."
      }
    ];

    const createdCollections: string[] = [];

    // 1. Get existing smart collections (to avoid duplicates)
    const query = `
      query {
        collections(first: 50, query: "collection_type:smart") {
          edges {
            node {
              title
              handle
            }
          }
        }
      }
    `;

    const existingData = await this.graphql<any>(query, {}, 10);
    const existingTitles = new Set(existingData.collections.edges.map((e: any) => e.node.title));

    // 2. Create missing collections
    for (const col of collectionsToCreate) {
      if (!existingTitles.has(col.title)) {
        try {
          await this.createSmartCollection(col.title, col.rule, col.description);
          createdCollections.push(col.title);
          console.log(`Created smart collection: ${col.title}`);
        } catch (error) {
          console.error(`Failed to create collection ${col.title}:`, error);
        }
      }
    }

    return createdCollections;
  }

  async createSmartCollection(title: string, rule: { column: string, relation: string, condition: string }, description?: string): Promise<string> {
    const mutation = `
      mutation collectionCreate($input: CollectionInput!) {
        collectionCreate(input: $input) {
          collection {
            id
            title
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const input = {
      title,
      descriptionHtml: description,
      ruleSet: {
        appliedDisjunctively: false, // Match ALL conditions (AND)
        rules: [rule]
      }
    };

    const data = await this.graphql<any>(mutation, { input }, ESTIMATED_COSTS.createProduct);

    if (data.collectionCreate.userErrors.length > 0) {
      throw new Error(
        `Collection creation error: ${JSON.stringify(data.collectionCreate.userErrors)}`
      );
    }

    return data.collectionCreate.collection.id;
  }

  async createMetafieldDefinition(key: string, name: string, type: string): Promise<string> {
    const mutation = `
      mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
        metafieldDefinitionCreate(definition: $definition) {
          createdDefinition {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const definition = {
      name,
      namespace: "custom",
      key,
      type,
      ownerType: "PRODUCT"
    };

    const data = await this.graphql<any>(mutation, { definition }, 10);

    if (data.metafieldDefinitionCreate.userErrors.length > 0) {
      throw new Error(
        `Metafield definition error (${key}): ${JSON.stringify(data.metafieldDefinitionCreate.userErrors)}`
      );
    }

    return data.metafieldDefinitionCreate.createdDefinition.id;
  }

  /**
   * @deprecated Use getRateLimiterStatus() instead for cost tracking
   */
  async calculateGraphQLCost(): Promise<{ requestedQueryCost: number; actualQueryCost: number }> {
    const status = this.rateLimiter.getStatus();
    return {
      requestedQueryCost: status.currentCost,
      actualQueryCost: status.currentCost,
    };
  }
}
