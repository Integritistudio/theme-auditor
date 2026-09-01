import { Badge, Card, LegacyStack, Text } from "@shopify/polaris";

function scoreTone(score) {
  if (score >= 80) return "success";
  if (score >= 60) return undefined;
  if (score >= 40) return "warning";
  return "critical";
}

function scoreLabel(score) {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Fair";
  return "Needs work";
}

/**
 * Compact completed-scan summary for the dashboard.
 * Issue details live only on the Issues page.
 */
export function ScanResultsSummary({ results }) {
  if (!results?.scan) {
    return null;
  }

  const { scores, issueCounts, scanDate, scan } = results;
  const overall = scores?.overall ?? 0;
  const scanDateLabel = scanDate
    ? new Date(scanDate).toLocaleString()
    : new Date(scan.created_at).toLocaleString();

  const categoryScores = [
    ["Performance", scores?.performance],
    ["SEO", scores?.seo],
    ["Accessibility", scores?.accessibility],
    ["Theme", scores?.theme],
    ["Product", scores?.product],
  ];

  const severities = [
    ["Critical", issueCounts?.critical, "critical"],
    ["High", issueCounts?.high, "warning"],
    ["Medium", issueCounts?.medium, "attention"],
    ["Low", issueCounts?.low, "info"],
  ];

  return (
    <Card>
      <Card.Section>
        <LegacyStack alignment="center" distribution="equalSpacing">
          <LegacyStack.Item fill>
            <LegacyStack alignment="center" spacing="tight">
              <Text variant="headingMd" as="h2">
                Latest scan results
              </Text>
              <Badge status="success">COMPLETED</Badge>
            </LegacyStack>
            <div style={{ marginTop: "4px" }}>
              <Text variant="bodySm" as="p" color="subdued">
                Scan #{scan.id.substring(0, 8)} · {scanDateLabel}
              </Text>
            </div>
          </LegacyStack.Item>
          <LegacyStack.Item>
            <LegacyStack alignment="baseline" spacing="extraTight">
              <Text variant="heading2xl" as="p">
                {overall}
              </Text>
              <Text variant="bodyMd" as="span" color="subdued">
                /100 health
              </Text>
              <Badge status={scoreTone(overall)}>{scoreLabel(overall)}</Badge>
            </LegacyStack>
          </LegacyStack.Item>
        </LegacyStack>
      </Card.Section>

      <Card.Section>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: "12px",
          }}
        >
          {categoryScores.map(([label, score]) => {
            const value = score ?? 0;
            return (
              <div key={label}>
                <Text variant="bodySm" as="p" color="subdued">
                  {label}
                </Text>
                <LegacyStack alignment="center" spacing="tight">
                  <Text variant="headingMd" as="p">
                    {value}/100
                  </Text>
                  <Badge status={scoreTone(value)}>{scoreLabel(value)}</Badge>
                </LegacyStack>
              </div>
            );
          })}
        </div>
      </Card.Section>

      <Card.Section>
        <LegacyStack spacing="tight" wrap>
          {severities.map(([label, count, status]) => (
            <Badge key={label} status={status}>
              {`${label}: ${count ?? 0}`}
            </Badge>
          ))}
          <Text variant="bodySm" as="span" color="subdued">
            Open Issues for product, theme, and storefront findings with
            file/section details.
          </Text>
        </LegacyStack>
      </Card.Section>
    </Card>
  );
}
