export const MAIN_THEME_QUERY = `
  query MainTheme {
    themes(first: 1, roles: [MAIN]) {
      nodes {
        id
        name
        role
      }
    }
  }
`;

export const THEME_FILES_PAGE_QUERY = `
  query ThemeFilesPage(
    $themeId: ID!
    $first: Int!
    $after: String
    $filenames: [String!]
  ) {
    theme(id: $themeId) {
      id
      files(first: $first, after: $after, filenames: $filenames) {
        nodes {
          filename
          contentType
          size
          checksumMd5
          body {
            ... on OnlineStoreThemeFileBodyText {
              content
            }
            ... on OnlineStoreThemeFileBodyUrl {
              url
            }
            ... on OnlineStoreThemeFileBodyBase64 {
              contentBase64
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
        userErrors {
          code
          filename
        }
      }
    }
  }
`;
