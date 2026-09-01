import { query } from "../client.ts";

export interface Shop {
  id: string;
  shopify_domain: string;
  shopify_shop_id: string | null;
  access_token: string | null;
  plan: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateShopInput {
  shopifyDomain: string;
  shopifyShopId?: string;
  accessToken?: string;
  plan?: string;
}

export interface UpdateShopInput {
  shopifyShopId?: string;
  accessToken?: string;
  plan?: string;
}

/**
 * Finds a shop by its Shopify domain (.myshopify.com).
 */
export async function findShopByDomain(shopifyDomain: string): Promise<Shop | null> {
  const result = await query<Shop>(
    "SELECT * FROM shops WHERE shopify_domain = $1 LIMIT 1;",
    [shopifyDomain]
  );
  return result.rows[0] || null;
}

/**
 * Finds a shop by its database UUID.
 */
export async function findShopById(id: string): Promise<Shop | null> {
  const result = await query<Shop>(
    "SELECT * FROM shops WHERE id = $1 LIMIT 1;",
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Finds a shop by its numeric Shopify Shop ID string.
 */
export async function findShopByShopifyShopId(shopifyShopId: string): Promise<Shop | null> {
  const result = await query<Shop>(
    "SELECT * FROM shops WHERE shopify_shop_id = $1 LIMIT 1;",
    [shopifyShopId]
  );
  return result.rows[0] || null;
}

/**
 * Creates a new shop record.
 */
export async function createShop(input: CreateShopInput): Promise<Shop> {
  const result = await query<Shop>(
    `INSERT INTO shops (shopify_domain, shopify_shop_id, access_token, plan)
     VALUES ($1, $2, $3, COALESCE($4, 'free'))
     ON CONFLICT (shopify_domain) DO UPDATE SET
       shopify_shop_id = COALESCE(EXCLUDED.shopify_shop_id, shops.shopify_shop_id),
       access_token = COALESCE(EXCLUDED.access_token, shops.access_token),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *;`,
    [
      input.shopifyDomain,
      input.shopifyShopId || null,
      input.accessToken || null,
      input.plan || "free",
    ]
  );
  return result.rows[0];
}

/**
 * Updates shop details by ID.
 */
export async function updateShop(
  id: string,
  input: UpdateShopInput
): Promise<Shop | null> {
  const result = await query<Shop>(
    `UPDATE shops
     SET shopify_shop_id = COALESCE($2, shopify_shop_id),
         access_token = COALESCE($3, access_token),
         plan = COALESCE($4, plan),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *;`,
    [id, input.shopifyShopId || null, input.accessToken || null, input.plan || null]
  );
  return result.rows[0] || null;
}

/**
 * Updates or sets a shop's access token by Shopify domain.
 */
export async function updateShopAccessToken(
  shopifyDomain: string,
  accessToken: string
): Promise<Shop | null> {
  const result = await query<Shop>(
    `UPDATE shops
     SET access_token = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE shopify_domain = $1
     RETURNING *;`,
    [shopifyDomain, accessToken]
  );
  return result.rows[0] || null;
}
