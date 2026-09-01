import { Spinner } from "@shopify/polaris";

/**
 * Full-pane loading state with the spinner centered in the viewport.
 */
export function PageLoader({ accessibilityLabel = "Loading" }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Spinner accessibilityLabel={accessibilityLabel} size="large" />
    </div>
  );
}
