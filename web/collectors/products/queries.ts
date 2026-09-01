/**
 * Admin GraphQL queries for product catalog collection.
 */

export const COLLECT_PRODUCTS_QUERY = `
  query CollectProducts($first: Int!, $after: String, $mediaFirst: Int!) {
    products(first: $first, after: $after) {
      nodes {
        id
        title
        description
        descriptionHtml
        productType
        tags
        status
        seo {
          title
          description
        }
        media(first: $mediaFirst, query: "media_type:IMAGE") {
          nodes {
            ... on MediaImage {
              id
              alt
              image {
                url
                altText
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

export const COLLECT_PRODUCT_MEDIA_QUERY = `
  query CollectProductMedia($id: ID!, $first: Int!, $after: String) {
    product(id: $id) {
      id
      media(first: $first, after: $after, query: "media_type:IMAGE") {
        nodes {
          ... on MediaImage {
            id
            alt
            image {
              url
              altText
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  }
`;
