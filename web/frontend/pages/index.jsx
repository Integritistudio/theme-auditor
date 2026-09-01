import { useEffect, useState } from "react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Badge,
  Banner,
  EmptyState,
  LegacyStack,
  Modal,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { useQuery, useQueryClient } from "react-query";
import { useNavigate } from "react-router-dom";
import { ScanProgressCard, ScanResultsSummary, PageLoader } from "../components";
import "../styles/scan-history.css";

function isActiveScan(status) {
  return status === "PENDING" || status === "RUNNING";
}

function healthBadgeStatus(score) {
  if (score == null || score === undefined) return "info";
  if (score >= 80) return "success";
  if (score >= 60) return "attention";
  return "critical";
}

export default function StoreAuditDashboard() {
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isStartingScan, setIsStartingScan] = useState(false);
  const [watchedScanId, setWatchedScanId] = useState(null);
  const [scanToDelete, setScanToDelete] = useState(null);
  const [isDeletingScan, setIsDeletingScan] = useState(false);

  const {
    data: dashboard,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["dashboardData"],
    queryFn: async () => {
      const response = await fetch("/api/dashboard");
      if (!response.ok) {
        throw new Error("Failed to load dashboard data");
      }
      return await response.json();
    },
    refetchOnWindowFocus: true,
    refetchInterval: (data) => {
      const latest = data?.recentScans?.[0];
      return latest && isActiveScan(latest.status) ? 2000 : false;
    },
  });

  useEffect(() => {
    if (watchedScanId || !dashboard?.recentScans?.length) {
      return;
    }
    const active = dashboard.recentScans.find((scan) =>
      isActiveScan(scan.status)
    );
    if (active) {
      setWatchedScanId(active.id);
    }
  }, [dashboard, watchedScanId]);

  const handleStartScan = async () => {
    setIsStartingScan(true);
    shopify.loading(true);

    try {
      const response = await fetch("/api/scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const body = await response.json().catch(() => ({}));

      if (response.ok && body.scan?.id) {
        setWatchedScanId(body.scan.id);
        queryClient.setQueryData(["scanProgress", body.scan.id], {
          scan: body.scan,
          isActive: true,
        });
        await refetch();
        shopify.toast.show("Store audit scan started.");
      } else {
        shopify.toast.show(body.error || "Failed to initiate store scan.", {
          isError: true,
        });
      }
    } catch (err) {
      shopify.toast.show("An error occurred starting the scan.", {
        isError: true,
      });
    } finally {
      setIsStartingScan(false);
      shopify.loading(false);
    }
  };

  const handleProgressTerminal = async () => {
    await queryClient.invalidateQueries(["dashboardData"]);
  };

  const handleDismissProgress = () => {
    setWatchedScanId(null);
    refetch();
  };

  const handleDeleteScanRequest = (scan) => {
    setScanToDelete({
      id: scan.id,
      label: `#${scan.id.substring(0, 8)}`,
    });
  };

  const handleDeleteScanCancel = () => {
    if (!isDeletingScan) {
      setScanToDelete(null);
    }
  };

  const handleDeleteScanConfirm = async () => {
    if (!scanToDelete) return;

    setIsDeletingScan(true);
    shopify.loading(true);

    try {
      const response = await fetch(
        `/api/scans/${encodeURIComponent(scanToDelete.id)}`,
        { method: "DELETE" }
      );
      const body = await response.json().catch(() => ({}));

      if (response.ok) {
        if (watchedScanId === scanToDelete.id) {
          setWatchedScanId(null);
        }
        setScanToDelete(null);
        await queryClient.invalidateQueries(["dashboardData"]);
        shopify.toast.show("Scan deleted.");
      } else {
        shopify.toast.show(body.error || "Failed to delete scan.", {
          isError: true,
        });
      }
    } catch (err) {
      shopify.toast.show("An error occurred deleting the scan.", {
        isError: true,
      });
    } finally {
      setIsDeletingScan(false);
      shopify.loading(false);
    }
  };

  if (isLoading) {
    return <PageLoader accessibilityLabel="Loading dashboard" />;
  }

  if (isError) {
    return (
      <Page fullWidth>
        <Banner status="critical" title="Unable to load dashboard">
          <p>Please refresh and try again.</p>
        </Banner>
      </Page>
    );
  }

  const shopDomain = dashboard?.shop?.domain || "Your Store";
  const welcomeName =
    dashboard?.shop?.name ||
    dashboard?.shop?.displayName ||
    shopDomain.replace(/\.myshopify\.com$/i, "");
  const totalScans = dashboard?.totalScans || 0;
  const recentScans = dashboard?.recentScans || [];
  const watchedFromDashboard = watchedScanId
    ? recentScans.find((scan) => scan.id === watchedScanId) || null
    : null;
  const activeScan =
    recentScans.find((scan) => isActiveScan(scan.status)) || null;
  const scanInProgress = Boolean(activeScan) || isStartingScan;
  const plan = (dashboard?.shop?.plan || "FREE").toUpperCase();

  const rowMarkup = recentScans.map(
    (
      {
        id,
        status,
        overall_score,
        total_issues,
        created_at,
        progress_stage,
        progress_percent,
        error_message,
      },
      index
    ) => (
      <tr key={id}>
        <td className="col-scan-id">
          <Text variant="bodyMd" fontWeight="bold" as="span">
            #{id.substring(0, 8)}
          </Text>
        </td>
        <td className="col-status">
          <Badge
            status={
              status === "COMPLETED"
                ? "success"
                : status === "RUNNING"
                  ? "attention"
                  : status === "FAILED"
                    ? "critical"
                    : "info"
            }
          >
            {status}
          </Badge>
          {isActiveScan(status) && progress_stage ? (
            <div className="status-meta">
              <Text variant="bodySm" as="p" color="subdued">
                {progress_stage} ({progress_percent ?? 0}%)
              </Text>
            </div>
          ) : null}
          {status === "FAILED" && error_message ? (
            <div className="status-meta">
              <Text variant="bodySm" as="p" color="subdued">
                {error_message}
              </Text>
            </div>
          ) : null}
        </td>
        <td className="col-health cell-center">
          {status === "COMPLETED" &&
          overall_score !== null &&
          overall_score !== undefined ? (
            <Badge status={healthBadgeStatus(overall_score)}>
              {overall_score}/100
            </Badge>
          ) : (
            <Text variant="bodyMd" as="span" color="subdued">
              N/A
            </Text>
          )}
        </td>
        <td className="col-issues cell-center">
          {status === "COMPLETED" ? (
            <Text variant="bodyMd" as="span">
              {total_issues ?? 0}
            </Text>
          ) : (
            <Text variant="bodyMd" as="span" color="subdued">
              —
            </Text>
          )}
        </td>
        <td className="col-date">
          <span className="scan-history-date">
            {new Date(created_at).toLocaleString()}
          </span>
        </td>
        <td className="col-actions cell-actions">
          {status === "COMPLETED" || status === "FAILED" ? (
            <div className="scan-history-actions">
              {status === "COMPLETED" ? (
                <Button
                  size="slim"
                  onClick={() =>
                    navigate(`/issues?scanId=${encodeURIComponent(id)}`)
                  }
                >
                  View Issues
                </Button>
              ) : null}
              <Button
                size="slim"
                destructive
                onClick={() => handleDeleteScanRequest({ id })}
              >
                Delete
              </Button>
            </div>
          ) : (
            <Text variant="bodySm" as="span" color="subdued">
              —
            </Text>
          )}
        </td>
      </tr>
    )
  );

  return (
    <Page fullWidth>
      <TitleBar title="Dashboard" />
      <Layout>
        <Layout.Section>
          <Card sectioned>
            <LegacyStack alignment="center" distribution="equalSpacing">
              <LegacyStack.Item fill>
                <Text variant="headingLg" as="h1">
                  Welcome Back, {welcomeName}
                </Text>
                <div style={{ marginTop: "8px" }}>
                  <LegacyStack alignment="center" spacing="tight">
                    <Text variant="bodyMd" as="p" color="subdued">
                      {shopDomain}
                    </Text>
                    <Badge status="attention">{plan}</Badge>
                  </LegacyStack>
                </div>
                <div style={{ marginTop: "4px" }}>
                  <Text variant="bodyMd" as="p" color="subdued">
                    Store audits for SEO, accessibility, theme, and products.
                  </Text>
                </div>
              </LegacyStack.Item>
              <LegacyStack.Item>
                <Button
                  primary
                  onClick={handleStartScan}
                  loading={isStartingScan}
                  disabled={scanInProgress}
                >
                  {totalScans === 0 ? "Start First Scan" : "Start New Scan"}
                </Button>
              </LegacyStack.Item>
            </LegacyStack>
          </Card>
        </Layout.Section>

        {watchedScanId ? (
          <Layout.Section>
            <ScanProgressCard
              scanId={watchedScanId}
              initialScan={watchedFromDashboard || activeScan}
              onTerminal={handleProgressTerminal}
              onDismiss={handleDismissProgress}
            />
          </Layout.Section>
        ) : null}

        {dashboard?.completedResults ? (
          <Layout.Section>
            <ScanResultsSummary results={dashboard.completedResults} />
          </Layout.Section>
        ) : null}

        <Layout.Section>
          <Card
            title="Scan history"
            padding={recentScans.length === 0 ? "4" : "0"}
            sectioned={recentScans.length === 0}
          >
            {recentScans.length === 0 ? (
              <EmptyState
                heading="No scans yet"
                action={{
                  content: "Start First Scan",
                  onAction: handleStartScan,
                  loading: isStartingScan,
                  disabled: scanInProgress,
                }}
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>Run an audit to see scores and issues here.</p>
              </EmptyState>
            ) : (
              <div className="scan-history-table-wrapper">
                <table className="scan-history-table">
                  <thead>
                    <tr>
                      <th className="col-scan-id">Scan ID</th>
                      <th className="col-status">Status</th>
                      <th className="col-health">Health</th>
                      <th className="col-issues">Issues</th>
                      <th className="col-date">Date</th>
                      <th className="col-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>{rowMarkup}</tbody>
                </table>
              </div>
            )}
          </Card>
        </Layout.Section>
      </Layout>

      <Modal
        open={Boolean(scanToDelete)}
        onClose={handleDeleteScanCancel}
        title="Delete scan?"
        primaryAction={{
          content: "Delete scan",
          destructive: true,
          loading: isDeletingScan,
          onAction: handleDeleteScanConfirm,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleDeleteScanCancel,
            disabled: isDeletingScan,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            {scanToDelete
              ? `This will permanently delete scan ${scanToDelete.label} and all of its issues. This action cannot be undone.`
              : ""}
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
