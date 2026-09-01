import { useEffect, useMemo, useRef } from "react";
import {
  Banner,
  Badge,
  Button,
  Card,
  LegacyStack,
  ProgressBar,
  Text,
} from "@shopify/polaris";
import { useQuery } from "react-query";

/** UI steps mapped to backend progress_stage values (excludes COMPLETED). */
export const SCAN_PROGRESS_STEPS = [
  { stage: "STORE_DATA", label: "Preparing store data" },
  { stage: "PRODUCTS", label: "Analyzing products" },
  { stage: "THEME", label: "Inspecting theme" },
  { stage: "STOREFRONT", label: "Scanning storefront" },
  { stage: "ANALYSIS", label: "Generating report" },
];

const STAGE_INDEX = Object.fromEntries(
  SCAN_PROGRESS_STEPS.map((step, index) => [step.stage, index])
);

function isActiveStatus(status) {
  return status === "PENDING" || status === "RUNNING";
}

function statusBadgeTone(status) {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "RUNNING":
      return "attention";
    case "FAILED":
      return "critical";
    case "PENDING":
    default:
      return "info";
  }
}

/**
 * Resolves each step to done | current | pending | failed based on scan status + stage.
 */
export function resolveStepStates(scan) {
  const status = scan?.status;
  const stage = scan?.progress_stage;

  if (status === "COMPLETED" || stage === "COMPLETED") {
    return SCAN_PROGRESS_STEPS.map(() => "done");
  }

  if (status === "PENDING" && !stage) {
    return SCAN_PROGRESS_STEPS.map((_, index) =>
      index === 0 ? "current" : "pending"
    );
  }

  const currentIndex =
    stage && stage in STAGE_INDEX ? STAGE_INDEX[stage] : 0;

  return SCAN_PROGRESS_STEPS.map((_, index) => {
    if (index < currentIndex) return "done";
    if (index === currentIndex) {
      return status === "FAILED" ? "failed" : "current";
    }
    return "pending";
  });
}

function stepMarker(state) {
  switch (state) {
    case "done":
      return "✓";
    case "current":
      return "→";
    case "failed":
      return "✕";
    default:
      return "○";
  }
}

function stepColor(state) {
  switch (state) {
    case "done":
      return "#008060";
    case "current":
      return "#2C6ECB";
    case "failed":
      return "#D72C0D";
    default:
      return "#8C9196";
  }
}

function currentStepLabel(scan, stepStates) {
  if (scan?.status === "COMPLETED") {
    return "Scan complete";
  }
  if (scan?.status === "FAILED") {
    const failedIndex = stepStates.findIndex((state) => state === "failed");
    if (failedIndex >= 0) {
      return SCAN_PROGRESS_STEPS[failedIndex].label;
    }
    return "Scan failed";
  }
  const currentIndex = stepStates.findIndex((state) => state === "current");
  if (currentIndex >= 0) {
    return SCAN_PROGRESS_STEPS[currentIndex].label;
  }
  return "Starting…";
}

async function fetchScan(scanId) {
  const response = await fetch(`/api/scans/${scanId}`);
  if (!response.ok) {
    throw new Error("Failed to load scan progress");
  }
  return response.json();
}

/**
 * Live scan progress panel. Polls GET /api/scans/:id while the scan is active.
 */
export function ScanProgressCard({
  scanId,
  initialScan = null,
  onDismiss,
  onTerminal,
}) {
  const notifiedTerminalRef = useRef(null);

  const { data, isError, error } = useQuery({
    queryKey: ["scanProgress", scanId],
    queryFn: () => fetchScan(scanId),
    enabled: Boolean(scanId),
    initialData: initialScan
      ? { scan: initialScan, isActive: isActiveStatus(initialScan.status) }
      : undefined,
    refetchOnWindowFocus: true,
    refetchInterval: (queryData) => {
      const status = queryData?.scan?.status;
      return isActiveStatus(status) ? 1000 : false;
    },
  });

  const scan = data?.scan || initialScan;
  const stepStates = useMemo(() => resolveStepStates(scan), [scan]);
  const percent = scan?.progress_percent ?? 0;
  const status = scan?.status || "PENDING";
  const isComplete = status === "COMPLETED";
  const isFailed = status === "FAILED";
  const isActive = isActiveStatus(status);
  const activeLabel = currentStepLabel(scan, stepStates);

  useEffect(() => {
    if (!scan?.id) return;
    if (status !== "COMPLETED" && status !== "FAILED") return;
    if (notifiedTerminalRef.current === scan.id) return;
    notifiedTerminalRef.current = scan.id;
    onTerminal?.(scan);
  }, [scan, status, onTerminal]);

  if (!scanId || !scan) {
    return null;
  }

  return (
    <Card sectioned>
      <LegacyStack vertical spacing="loose">
        <LegacyStack alignment="center" distribution="equalSpacing">
          <LegacyStack.Item fill>
            <Text variant="headingLg" as="h2">
              {isComplete
                ? "Scan complete"
                : isFailed
                  ? "Scan failed"
                  : "Scanning your store"}
            </Text>
          </LegacyStack.Item>
          <LegacyStack.Item>
            <Badge status={statusBadgeTone(status)}>{status}</Badge>
          </LegacyStack.Item>
        </LegacyStack>

        {isError ? (
          <Banner status="critical" title="Unable to refresh scan progress">
            <p>
              {error?.message ||
                "Progress updates paused. Try refreshing the page."}
            </p>
          </Banner>
        ) : null}

        {isFailed ? (
          <Banner status="critical" title="This scan could not be completed">
            <p>{scan.error_message || "An unexpected error occurred."}</p>
          </Banner>
        ) : null}

        {isComplete ? (
          <Banner status="success" title="Your store audit is ready">
            <p>
              Health score {scan.overall_score ?? 0}/100 ·{" "}
              {scan.total_issues ?? 0} issues found.
            </p>
          </Banner>
        ) : null}

        {isActive || isComplete ? (
          <div>
            <LegacyStack alignment="center" distribution="equalSpacing">
              <Text variant="bodyMd" as="p" color="subdued">
                Current step: {activeLabel}
              </Text>
              <Text variant="headingMd" as="p">
                {isComplete ? 100 : percent}%
              </Text>
            </LegacyStack>
            <div style={{ marginTop: "8px" }}>
              <ProgressBar
                progress={isComplete ? 100 : percent}
                size="small"
              />
            </div>
          </div>
        ) : null}

        {isFailed ? (
          <div>
            <LegacyStack alignment="center" distribution="equalSpacing">
              <Text variant="bodyMd" as="p" color="subdued">
                Stopped at: {activeLabel}
              </Text>
              <Text variant="headingMd" as="p">
                {percent}%
              </Text>
            </LegacyStack>
            <div style={{ marginTop: "8px" }}>
              <ProgressBar progress={percent} size="small" />
            </div>
          </div>
        ) : null}

        <div role="list" aria-label="Scan progress steps">
          {SCAN_PROGRESS_STEPS.map((step, index) => {
            const state = stepStates[index];
            const marker = stepMarker(state);
            const color = stepColor(state);
            const weight =
              state === "current" || state === "failed" ? "semibold" : "regular";

            return (
              <div
                key={step.stage}
                role="listitem"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "6px 0",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "1.25rem",
                    textAlign: "center",
                    fontWeight: 600,
                    color,
                    fontSize: "1rem",
                    lineHeight: 1,
                  }}
                >
                  {marker}
                </span>
                <Text
                  variant="bodyMd"
                  as="span"
                  fontWeight={weight}
                  color={state === "pending" ? "subdued" : undefined}
                >
                  {step.label}
                </Text>
              </div>
            );
          })}
        </div>

        {(isComplete || isFailed) && onDismiss ? (
          <Button onClick={onDismiss}>
            {isFailed ? "Dismiss" : "Continue to dashboard"}
          </Button>
        ) : null}
      </LegacyStack>
    </Card>
  );
}
