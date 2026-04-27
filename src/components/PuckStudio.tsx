"use client";

import type { Data, Viewports } from "@puckeditor/core";
import { Puck, usePuck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import {
  Download,
  ExternalLink,
  FileCode2,
  LayoutTemplate,
  LogOut,
  Menu,
  PanelLeft,
  PanelRight,
  Redo2,
  Rocket,
  Undo2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { estimateQueryPlanForData } from "@/lib/datasource-query-plan";
import { puckConfig } from "@/puck/config";
import { ReusableLibraryModal } from "./ReusableLibraryModal";

type PageStatus = "draft" | "published" | "archived" | "deleted";

type PuckStudioProps = {
  initialData: Data;
  pageId: string;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    publishedAt?: string;
    status?: PageStatus;
    isCompiled?: boolean;
  }>;
  publishedAt?: string;
  pageStatus?: PageStatus;
  isCompiled?: boolean;
};

const builderViewports: Viewports = [
  { width: 390, height: 900, icon: "Smartphone", label: "Phone" },
  { width: 768, height: 900, icon: "Tablet", label: "Tablet" },
  { width: 1280, height: 900, icon: "Monitor", label: "Desktop" },
  { width: "100%", height: 900, icon: "FullWidth", label: "Fluid" },
];

const pageStatusOptions: Array<{ value: PageStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
  { value: "deleted", label: "Deleted" },
];

function normalizePageStatus(rawStatus?: string): PageStatus {
  switch ((rawStatus || "").trim().toLowerCase()) {
    case "published":
      return "published";
    case "archived":
    case "archive":
      return "archived";
    case "deleted":
      return "deleted";
    default:
      return "draft";
  }
}

function pageStatusLabel(status: PageStatus) {
  const match = pageStatusOptions.find((item) => item.value === status);
  return match?.label || "Draft";
}

type PuckEditorToolbarProps = {
  links: {
    preview: string;
    export: string;
    cshtml: string;
  };
  publish: (data: Data) => Promise<void>;
};

function PuckHeaderActions({ links, publish }: PuckEditorToolbarProps) {
  const { appState, dispatch, history } = usePuck();
  const data = appState.data as Data;
  const leftSideBarVisible = appState.ui?.leftSideBarVisible ?? true;
  const rightSideBarVisible = appState.ui?.rightSideBarVisible ?? true;
  const uiViewports = appState.ui?.viewports;
  const currentViewport = uiViewports?.current ?? { width: "100%", height: 900 };

  function toggleLeftSidebar() {
    dispatch({
      type: "setUi",
      ui: { leftSideBarVisible: !leftSideBarVisible },
    });
  }

  function toggleRightSidebar() {
    dispatch({
      type: "setUi",
      ui: { rightSideBarVisible: !rightSideBarVisible },
    });
  }

  function selectViewport(viewport: Viewports[number]) {
    dispatch({
      type: "setUi",
      ui: {
        viewports: {
          current: {
            width: viewport.width,
            height: viewport.height ?? "auto",
          },
          controlsVisible: uiViewports?.controlsVisible ?? true,
          options: uiViewports?.options ?? builderViewports,
        },
      },
    });
  }

  return (
    <div className="studio-puck__tools studio-puck__tools--header">
      <div className="studio-puck__viewport-switcher" aria-label="Viewport controls" role="group">
        {builderViewports.map((viewport) => {
          const selected =
            viewport.width === currentViewport.width &&
            (viewport.height ?? "auto") === currentViewport.height;

          return (
            <button
              aria-label={`Switch to ${viewport.label}`}
              aria-pressed={selected}
              className="studio-puck__viewport-btn"
              key={`${viewport.label}-${String(viewport.width)}`}
              onClick={() => selectViewport(viewport)}
              title={viewport.label}
              type="button"
            >
              {viewport.label}
            </button>
          );
        })}
      </div>
      <button
        aria-label={leftSideBarVisible ? "Hide left panel" : "Show left panel"}
        aria-pressed={leftSideBarVisible}
        className="studio-puck__panel-toggle"
        onClick={toggleLeftSidebar}
        title={leftSideBarVisible ? "Hide left panel" : "Show left panel"}
        type="button"
      >
        <PanelLeft size={16} />
      </button>
      <button
        aria-label={rightSideBarVisible ? "Hide right panel" : "Show right panel"}
        aria-pressed={rightSideBarVisible}
        className="studio-puck__panel-toggle"
        onClick={toggleRightSidebar}
        title={rightSideBarVisible ? "Hide right panel" : "Show right panel"}
        type="button"
      >
        <PanelRight size={16} />
      </button>
      <button
        aria-label="Undo"
        disabled={!history.hasPast}
        onClick={history.back}
        title="Undo"
        type="button"
      >
        <Undo2 size={16} />
      </button>
      <button
        aria-label="Redo"
        disabled={!history.hasFuture}
        onClick={history.forward}
        title="Redo"
        type="button"
      >
        <Redo2 size={16} />
      </button>
      <button className="studio-puck__publish" onClick={() => publish(data)} type="button">
        <Rocket size={15} />
        Publish
      </button>
      <ReusableLibraryModal data={data} />
      <a className="studio-puck__live" href={links.preview} rel="noreferrer" target="_blank">
        <ExternalLink size={15} />
        Live
      </a>
      <a className="studio-puck__live" href={links.cshtml} rel="noreferrer" target="_blank">
        <FileCode2 size={15} />
        CSHTML
      </a>
    </div>
  );
}

export function PuckStudio({
  initialData,
  pageId,
  pages,
  publishedAt,
  pageStatus,
  isCompiled,
}: PuckStudioProps) {
  const [currentData, setCurrentData] = useState<Data>(initialData);
  const [activityStatus, setActivityStatus] = useState(
    publishedAt ? `Last published ${new Date(publishedAt).toLocaleString()}` : "Unpublished",
  );
  const [pageLifecycleStatus, setPageLifecycleStatus] = useState<PageStatus>(
    normalizePageStatus(pageStatus),
  );
  const [pendingLifecycleStatus, setPendingLifecycleStatus] = useState<PageStatus>(
    normalizePageStatus(pageStatus),
  );
  const [compiledState, setCompiledState] = useState(Boolean(isCompiled));
  const [statusBusy, setStatusBusy] = useState(false);
  const [editorIssue, setEditorIssue] = useState<{
    error: string;
    details?: string;
  } | null>(null);

  const links = useMemo(
    () => ({
      preview: `/p/${pageId}`,
      export: `/api/pages/${pageId}/export`,
      cshtml: `/builder/pages/${pageId}/cshtml`,
    }),
    [pageId],
  );
  const queryPlan = useMemo(() => estimateQueryPlanForData(currentData), [currentData]);
  const queryHint =
    queryPlan.level === "red"
      ? "High DB pressure. Reduce datasources or enable aliasing."
      : queryPlan.level === "amber"
        ? "Moderate DB pressure."
        : "Datasource load is healthy.";

  async function publish(data: Data) {
    setActivityStatus("Publishing...");
    setEditorIssue(null);

    const response = await fetch(`/api/pages/${pageId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      let errorMessage = "Publish failed";
      let details: string | undefined;

      try {
        const payload = (await response.json()) as { error?: string; details?: string };
        if (payload.error?.trim()) {
          errorMessage = payload.error.trim();
        }
        if (payload.details?.trim()) {
          details = payload.details.trim();
        }
      } catch {
        // Ignore JSON parse errors and keep generic message.
      }

      setActivityStatus("Publish failed");
      setEditorIssue({
        error: errorMessage,
        details,
      });
      return;
    }

    const payload = (await response.json()) as {
      page: { publishedAt?: string; status?: string; isCompiled?: boolean };
    };
    setActivityStatus(
      payload.page.publishedAt
        ? `Published ${new Date(payload.page.publishedAt).toLocaleString()}`
        : "Published",
    );
    setPageLifecycleStatus(normalizePageStatus(payload.page.status));
    setPendingLifecycleStatus(normalizePageStatus(payload.page.status));
    setCompiledState(Boolean(payload.page.isCompiled));
    setEditorIssue(null);
  }

  async function updateStatus(nextStatus: PageStatus) {
    if (statusBusy) {
      return;
    }

    setStatusBusy(true);
    setActivityStatus(`Setting status to ${pageStatusLabel(nextStatus)}...`);
    setEditorIssue(null);

    try {
      const response = await fetch(`/api/pages/${pageId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        let errorMessage = "Status update failed";
        let details: string | undefined;

        try {
          const payload = (await response.json()) as { error?: string; details?: string };
          if (payload.error?.trim()) {
            errorMessage = payload.error.trim();
          }
          if (payload.details?.trim()) {
            details = payload.details.trim();
          }
        } catch {
          // Ignore JSON parse errors and keep generic message.
        }

        setActivityStatus("Status update failed");
        setEditorIssue({
          error: errorMessage,
          details,
        });
        return;
      }

      const payload = (await response.json()) as {
        page: { status?: string; isCompiled?: boolean; publishedAt?: string };
      };
      const resolvedStatus = normalizePageStatus(payload.page.status);
      setPageLifecycleStatus(resolvedStatus);
      setPendingLifecycleStatus(resolvedStatus);
      setCompiledState(Boolean(payload.page.isCompiled));
      setActivityStatus(`Status set to ${pageStatusLabel(resolvedStatus)}`);
      setEditorIssue(null);
    } catch {
      setActivityStatus("Status update failed");
      setEditorIssue({
        error: "Could not reach the status service.",
      });
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div>
          <p className="studio-kicker">Puck Studio</p>
          <h1>Page and form builder</h1>
        </div>
        <div className="studio-actions" aria-label="Builder actions">
          <span className="studio-status">{activityStatus}</span>
          <span className={`studio-page-state studio-page-state--${pageLifecycleStatus}`}>
            {pageStatusLabel(pageLifecycleStatus)}
            {compiledState ? " | compiled" : " | not compiled"}
          </span>
          <label className="studio-status-control" htmlFor="page-status-select">
            <span>Status</span>
            <select
              id="page-status-select"
              onChange={(event) => setPendingLifecycleStatus(event.target.value as PageStatus)}
              value={pendingLifecycleStatus}
            >
              {pageStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="studio-icon-link"
            disabled={statusBusy || pendingLifecycleStatus === pageLifecycleStatus}
            onClick={() => updateStatus(pendingLifecycleStatus)}
            type="button"
          >
            {statusBusy ? "Saving..." : "Apply status"}
          </button>
          <span
            className={`studio-query-budget studio-query-budget--${queryPlan.level}`}
            title={`${queryPlan.estimatedQueries} estimated datasource queries per render. ${queryHint}`}
          >
            {queryPlan.estimatedQueries} queries
          </span>
          <details className="studio-nav-menu">
            <summary>
              <Menu size={16} />
              Menu
            </summary>
            <div className="studio-nav-menu__panel">
              <section>
                <p>Navigation</p>
                <Link href="/">
                  <LayoutTemplate size={15} />
                  Page manager
                </Link>
                <a href={links.preview} target="_blank">
                  <ExternalLink size={15} />
                  Preview current
                </a>
                <a href={links.export}>
                  <Download size={15} />
                  Export current
                </a>
                <a href={links.cshtml} target="_blank">
                  <FileCode2 size={15} />
                  View CSHTML
                </a>
              </section>
              <section>
                <p>Created pages</p>
                {pages.map((page) => (
                  <Link
                    aria-current={page.id === pageId ? "page" : undefined}
                    className="studio-nav-menu__page"
                    href={`/builder/pages/${page.id}`}
                    key={page.id}
                  >
                    <span>{page.title}</span>
                    <small>
                      /{page.slug} | {pageStatusLabel(normalizePageStatus(page.status))}
                    </small>
                  </Link>
                ))}
              </section>
            </div>
          </details>
          <a className="studio-icon-link" href={links.preview} target="_blank">
            <ExternalLink size={16} />
            Preview
          </a>
          <a className="studio-icon-link" href={links.export}>
            <Download size={16} />
            Export HTML
          </a>
          <a className="studio-icon-link" href={links.cshtml} target="_blank">
            <FileCode2 size={16} />
            CSHTML
          </a>
          <form action="/api/auth/logout" method="post">
            <input name="next" type="hidden" value="/login" />
            <button className="studio-icon-link" type="submit">
              <LogOut size={16} />
              Sign out
            </button>
          </form>
        </div>
      </header>
      {editorIssue ? (
        <div className="studio-notice studio-notice--error" role="status">
          <div>
            <strong>{editorIssue.error}</strong>
            {editorIssue.details ? <pre>{editorIssue.details}</pre> : null}
          </div>
          <button
            aria-label="Dismiss editor error"
            onClick={() => setEditorIssue(null)}
            type="button"
          >
            <X size={14} />
          </button>
        </div>
      ) : null}
      <div className="studio-builder">
        <Puck
          config={puckConfig}
          data={initialData}
          height="100%"
          iframe={{ enabled: false }}
          onChange={setCurrentData}
          onPublish={publish}
          renderHeaderActions={() => (
            <PuckHeaderActions links={links} publish={publish} />
          )}
          ui={{
            leftSideBarVisible: true,
            plugin: { current: "blocks" },
            rightSideBarVisible: true,
            viewports: {
              controlsVisible: true,
              current: { width: "100%", height: 900 },
              options: builderViewports,
            },
          }}
          viewports={builderViewports}
        >
          <Puck.Layout />
        </Puck>
      </div>
    </div>
  );
}
