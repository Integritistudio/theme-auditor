import { useMemo, useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Badge,
  Banner,
  EmptyState,
  Filters,
  ChoiceList,
  Button,
  LegacyStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useQuery } from "react-query";
import { useSearchParams } from "react-router-dom";
import { PageLoader } from "../components";
import "../styles/issues.css";

function severityBadgeStatus(severity) {
  switch ((severity || "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "warning";
    case "medium":
      return "attention";
    default:
      return "info";
  }
}

/**
 * Merchant-facing issue groups for the Issues page.
 */
function resolveIssueGroup(issue) {
  const ruleId = (issue.rule_id || "").toLowerCase();
  const category = (issue.category || "").toLowerCase();
  const resourceType = (issue.affected_resource_type || "").toLowerCase();
  const metaGroup = (issue.metadata?.issueGroup || "").toLowerCase();

  if (
    metaGroup === "product" ||
    ruleId.startsWith("product.") ||
    resourceType === "product" ||
    category === "product" ||
    category === "image"
  ) {
    return "product";
  }

  if (
    metaGroup === "theme" ||
    ruleId.startsWith("theme.") ||
    resourceType === "theme" ||
    resourceType === "theme_file" ||
    (category === "script" && ruleId.startsWith("theme."))
  ) {
    return "theme";
  }

  if (
    metaGroup === "storefront" ||
    ruleId.startsWith("performance.section") ||
    ruleId.startsWith("performance.duplicate-page") ||
    ruleId.startsWith("seo.") ||
    ruleId.startsWith("a11y.") ||
    resourceType === "theme_section" ||
    resourceType === "page" ||
    resourceType === "page_script" ||
    category === "seo" ||
    category === "accessibility" ||
    category === "performance"
  ) {
    return "storefront";
  }

  return "other";
}

const ISSUE_GROUPS = [
  { id: "all", label: "All issues" },
  { id: "product", label: "Product related issues" },
  { id: "theme", label: "Theme related issues" },
  { id: "storefront", label: "Storefront related issues" },
  { id: "other", label: "Other issues" },
];

function formatOffendingParts(issue) {
  const parts = issue.metadata?.offendingParts;
  if (Array.isArray(parts) && parts.length > 0) {
    return parts.map((p) => p.detail).filter(Boolean);
  }

  const scripts = issue.metadata?.scriptFiles;
  if (Array.isArray(scripts) && scripts.length > 0) {
    return scripts.map((src) => `Script file: ${src}`);
  }

  return [];
}

function numericIdFromGid(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return text;
  const match = text.match(/\/(\d+)\s*$/);
  return match ? match[1] : null;
}

function resolveProductGid(issue) {
  if ((issue.affected_resource_type || "").toLowerCase() === "product") {
    return issue.affected_resource;
  }
  return issue.metadata?.productId || null;
}

function resolveThemeGid(issue) {
  return (
    issue.metadata?.themeId ||
    ((issue.affected_resource_type || "").toLowerCase() === "theme"
      ? issue.affected_resource
      : null)
  );
}

function resolveThemeFile(issue) {
  const type = (issue.affected_resource_type || "").toLowerCase();
  if (type === "theme_file" || type === "theme_asset") {
    return issue.affected_resource;
  }
  return issue.metadata?.sourceFile || null;
}

function buildProductAdminUrl(productGid) {
  const id = numericIdFromGid(productGid);
  if (!id) return null;
  // App Bridge admin protocol — opens product in the same Shopify Admin view.
  return `shopify://admin/products/${id}`;
}

function buildThemeEditorUrl(themeGid, filename) {
  const id = numericIdFromGid(themeGid);
  if (!id) return null;
  if (filename && /\.(liquid|js|css|json|mjs)$/i.test(filename)) {
    return `shopify://admin/themes/${id}?key=${encodeURIComponent(filename)}`;
  }
  return `shopify://admin/themes/${id}/editor`;
}

function openAdminUrl(url) {
  if (!url) return;
  // Navigate within Shopify Admin (same admin view), not a new browser tab.
  window.open(url, "_top");
}

function IssueCard({ issue, group, fallbackThemeId }) {
  const offending = formatOffendingParts(issue);
  const sectionType = issue.metadata?.sectionType;
  const sectionDomId = issue.metadata?.sectionDomId;
  const pageKind = issue.metadata?.pageKind;

  const productUrl =
    group === "product" ? buildProductAdminUrl(resolveProductGid(issue)) : null;
  const themeUrl =
    group === "theme"
      ? buildThemeEditorUrl(
          resolveThemeGid(issue) || fallbackThemeId,
          resolveThemeFile(issue)
        )
      : null;

  return (
    <div className="issue-detail-card">
      <LegacyStack alignment="center" spacing="tight">
        <Badge status={severityBadgeStatus(issue.severity)}>
          {(issue.severity || "low").toUpperCase()}
        </Badge>
        <Text variant="bodyMd" as="span" fontWeight="semibold">
          {issue.title}
        </Text>
      </LegacyStack>

      <div className="issue-detail-meta">
        <Text variant="bodySm" as="p" color="subdued">
          {issue.rule_id} · {issue.category}
          {pageKind ? ` · ${pageKind}` : ""}
          {sectionType ? ` · section "${sectionType}"` : ""}
          {sectionDomId ? ` · #${sectionDomId}` : ""}
        </Text>
      </div>

      {issue.description ? (
        <div className="issue-detail-block">
          <Text variant="bodySm" as="p">
            {issue.description}
          </Text>
        </div>
      ) : null}

      {offending.length > 0 ? (
        <div className="issue-detail-block">
          <Text variant="bodySm" as="p" fontWeight="semibold">
            Causing parts
          </Text>
          <ul className="issue-offending-list">
            {offending.map((line, idx) => (
              <li key={`${issue.id}-part-${idx}`}>
                <Text variant="bodySm" as="span">
                  {line}
                </Text>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {issue.affected_resource ? (
        <div className="issue-detail-block">
          <Text variant="bodySm" as="p" color="subdued">
            Resource: {issue.affected_resource}
            {issue.affected_resource_type
              ? ` (${issue.affected_resource_type})`
              : ""}
          </Text>
        </div>
      ) : null}

      {issue.recommendation ? (
        <div className="issue-detail-block">
          <Text variant="bodySm" as="p">
            <span className="issue-howto-label">How to fix:</span>{" "}
            {issue.recommendation}
          </Text>
        </div>
      ) : null}

      {(productUrl || themeUrl) && (
        <div className="issue-detail-actions">
          {productUrl ? (
            <Button primary size="slim" onClick={() => openAdminUrl(productUrl)}>
              Fix now
            </Button>
          ) : null}
          {themeUrl ? (
            <Button primary size="slim" onClick={() => openAdminUrl(themeUrl)}>
              Open editor
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function IssuesPage() {
  const [searchParams] = useSearchParams();
  const scanIdFromQuery = searchParams.get("scanId");
  const [severityFilter, setSeverityFilter] = useState([]);
  const [queryValue, setQueryValue] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");

  const {
    data: dashboard,
    isLoading: dashboardLoading,
  } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) throw new Error("Failed to load dashboard");
      return response.json();
    },
    enabled: !scanIdFromQuery,
    refetchOnWindowFocus: false,
  });

  const resolvedScanId =
    scanIdFromQuery ||
    dashboard?.lastCompletedScan?.id ||
    dashboard?.completedResults?.scan?.id ||
    null;

  const {
    data,
    isLoading,
    isError,
    error,
    refetch: refetchIssues,
  } = useQuery({
    queryKey: ["scanIssues", resolvedScanId],
    queryFn: async () => {
      const response = await fetch(`/api/scans/${resolvedScanId}/issues`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Failed to load issues (${response.status})`);
      }
      return response.json();
    },
    enabled: Boolean(resolvedScanId),
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const handleSeverityChange = useCallback((value) => {
    setSeverityFilter(value);
  }, []);

  const handleQueryChange = useCallback((value) => {
    setQueryValue(value);
  }, []);

  const handleQueryClear = useCallback(() => {
    setQueryValue("");
  }, []);

  const handleFiltersClear = useCallback(() => {
    setSeverityFilter([]);
    setQueryValue("");
  }, []);

  const filteredIssues = useMemo(() => {
    const issues = data?.issues || [];
    return issues.filter((issue) => {
      const group = resolveIssueGroup(issue);
      if (activeGroup !== "all" && group !== activeGroup) return false;

      if (
        severityFilter.length > 0 &&
        !severityFilter.includes((issue.severity || "").toLowerCase())
      ) {
        return false;
      }
      if (!queryValue.trim()) return true;
      const q = queryValue.trim().toLowerCase();
      const offendingText = formatOffendingParts(issue).join(" ").toLowerCase();
      return (
        (issue.title || "").toLowerCase().includes(q) ||
        (issue.rule_id || "").toLowerCase().includes(q) ||
        (issue.affected_resource || "").toLowerCase().includes(q) ||
        (issue.category || "").toLowerCase().includes(q) ||
        (issue.description || "").toLowerCase().includes(q) ||
        offendingText.includes(q)
      );
    });
  }, [data?.issues, severityFilter, queryValue, activeGroup]);

  const groupCounts = useMemo(() => {
    const issues = data?.issues || [];
    const counts = { all: issues.length, product: 0, theme: 0, storefront: 0, other: 0 };
    for (const issue of issues) {
      counts[resolveIssueGroup(issue)] += 1;
    }
    return counts;
  }, [data?.issues]);

  const groupedForDisplay = useMemo(() => {
    if (activeGroup !== "all") {
      return [{ id: activeGroup, label: ISSUE_GROUPS.find((g) => g.id === activeGroup)?.label || activeGroup, issues: filteredIssues }];
    }

    return ISSUE_GROUPS.filter((g) => g.id !== "all")
      .map((g) => ({
        ...g,
        issues: filteredIssues.filter((issue) => resolveIssueGroup(issue) === g.id),
      }))
      .filter((g) => g.issues.length > 0);
  }, [filteredIssues, activeGroup]);

  const fallbackThemeId = useMemo(() => {
    const issues = data?.issues || [];
    for (const issue of issues) {
      const themeId = issue.metadata?.themeId;
      if (themeId) return themeId;
      if ((issue.affected_resource_type || "").toLowerCase() === "theme") {
        return issue.affected_resource;
      }
    }
    return null;
  }, [data?.issues]);

  if (dashboardLoading || (resolvedScanId && isLoading)) {
    return <PageLoader accessibilityLabel="Loading issues" />;
  }

  if (!resolvedScanId) {
    return (
      <Page fullWidth>
        <TitleBar title="Issues" />
        <Layout>
          <Layout.Section>
            <Card sectioned>
              <EmptyState
                heading="No completed scan yet"
                action={{ content: "Go to dashboard", url: "/" }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Run a store audit to generate issues.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (isError) {
    return (
      <Page
        fullWidth
        backAction={{ content: "Dashboard", url: "/" }}
        title="Issues"
      >
        <TitleBar title="Issues" />
        <Banner
          status="critical"
          title="Unable to load issues"
          action={{ content: "Retry", onAction: () => refetchIssues() }}
          secondaryAction={{ content: "Back to dashboard", url: "/" }}
        >
          <p>{error?.message || "Please refresh and try again."}</p>
        </Banner>
      </Page>
    );
  }

  const counts = data?.issueCounts || {};
  const scan = data?.scan;
  const scanSubtitle = scan
    ? [
        `Scan #${scan.id.substring(0, 8)}`,
        `Health ${scan.overall_score ?? 0}/100`,
        `${counts.total ?? 0} issues`,
        scan.completed_at
          ? new Date(scan.completed_at).toLocaleString()
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : undefined;

  const filters = [
    {
      key: "severity",
      label: "Severity",
      filter: (
        <ChoiceList
          title="Severity"
          titleHidden
          allowMultiple
          choices={[
            { label: "Critical", value: "critical" },
            { label: "High", value: "high" },
            { label: "Medium", value: "medium" },
            { label: "Low", value: "low" },
          ]}
          selected={severityFilter}
          onChange={handleSeverityChange}
        />
      ),
      shortcut: true,
    },
  ];

  return (
    <Page
      fullWidth
      backAction={{ content: "Dashboard", url: "/" }}
      title="Issues"
      subtitle={scanSubtitle}
    >
      <TitleBar title="Issues" />
      <Layout>
        <Layout.Section>
          <div className="issues-severity-grid">
            {[
              ["Critical", counts.critical, "critical"],
              ["High", counts.high, "warning"],
              ["Medium", counts.medium, "attention"],
              ["Low", counts.low, "info"],
            ].map(([label, count, status]) => (
              <div className="issues-severity-card" key={label}>
                <Card sectioned>
                  <div className="issues-severity-card-content">
                    <Text variant="bodyMd" as="p" color="subdued">
                      {label}
                    </Text>
                    <div className="issues-severity-card-footer">
                      <Text variant="headingMd" as="p">
                        {count ?? 0}
                      </Text>
                      <Badge status={status}>{label}</Badge>
                    </div>
                  </div>
                </Card>
              </div>
            ))}
          </div>
        </Layout.Section>

        <Layout.Section>
          <Card sectioned>
            <Text variant="headingSm" as="h2">
              Issue type
            </Text>
            <div className="issue-group-tabs">
              {ISSUE_GROUPS.map((group) => {
                const count = groupCounts[group.id] ?? 0;
                if (group.id === "other" && count === 0) return null;
                return (
                  <Button
                    key={group.id}
                    size="slim"
                    primary={activeGroup === group.id}
                    onClick={() => setActiveGroup(group.id)}
                  >
                    {`${group.label} (${count})`}
                  </Button>
                );
              })}
            </div>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <Card.Section>
              <Filters
                queryValue={queryValue}
                filters={filters}
                onQueryChange={handleQueryChange}
                onQueryClear={handleQueryClear}
                onClearAll={handleFiltersClear}
                queryPlaceholder="Search issues, scripts, sections, or resources"
              />
            </Card.Section>

            {filteredIssues.length === 0 ? (
              <Card.Section>
                <Text variant="bodyMd" as="p" color="subdued">
                  No issues match the current filters.
                </Text>
              </Card.Section>
            ) : (
              groupedForDisplay.map((group) => (
                <Card.Section key={group.id}>
                  <div className="issue-group-heading">
                    <Text variant="headingSm" as="h3">
                      {group.label}
                    </Text>
                    <Text variant="bodySm" as="span" color="subdued">
                      {group.issues.length} issue
                      {group.issues.length === 1 ? "" : "s"}
                    </Text>
                  </div>
                  <div className="issue-group-list">
                    {group.issues.map((issue) => (
                      <IssueCard
                        key={issue.id}
                        issue={issue}
                        group={group.id}
                        fallbackThemeId={fallbackThemeId}
                      />
                    ))}
                  </div>
                </Card.Section>
              ))
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
