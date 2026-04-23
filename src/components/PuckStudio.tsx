"use client";

import type { Data, Viewports } from "@puckeditor/core";
import { Puck, usePuck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import {
  Download,
  ExternalLink,
  LayoutTemplate,
  Menu,
  PanelLeft,
  PanelRight,
  Redo2,
  Rocket,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { puckConfig } from "@/puck/config";
import { ReusableLibraryModal } from "./ReusableLibraryModal";

type PuckStudioProps = {
  initialData: Data;
  pageId: string;
  pages: Array<{
    id: string;
    title: string;
    slug: string;
    publishedAt?: string;
  }>;
  publishedAt?: string;
};

const builderViewports: Viewports = [
  { width: 390, height: 900, icon: "Smartphone", label: "Phone" },
  { width: 768, height: 900, icon: "Tablet", label: "Tablet" },
  { width: 1280, height: 900, icon: "Monitor", label: "Desktop" },
  { width: "100%", height: 900, icon: "FullWidth", label: "Fluid" },
];

type PuckEditorToolbarProps = {
  links: {
    preview: string;
    export: string;
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
    </div>
  );
}

export function PuckStudio({
  initialData,
  pageId,
  pages,
  publishedAt,
}: PuckStudioProps) {
  const [, setCurrentData] = useState<Data>(initialData);
  const [status, setStatus] = useState(
    publishedAt ? `Last published ${new Date(publishedAt).toLocaleString()}` : "Unpublished",
  );

  const links = useMemo(
    () => ({
      preview: `/p/${pageId}`,
      export: `/api/pages/${pageId}/export`,
    }),
    [pageId],
  );

  async function publish(data: Data) {
    setStatus("Publishing...");

    const response = await fetch(`/api/pages/${pageId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }),
    });

    if (!response.ok) {
      setStatus("Publish failed");
      return;
    }

    const payload = (await response.json()) as { page: { publishedAt?: string } };
    setStatus(
      payload.page.publishedAt
        ? `Published ${new Date(payload.page.publishedAt).toLocaleString()}`
        : "Published",
    );
  }

  return (
    <div className="studio-shell">
      <header className="studio-topbar">
        <div>
          <p className="studio-kicker">Puck Studio</p>
          <h1>Page and form builder</h1>
        </div>
        <div className="studio-actions" aria-label="Builder actions">
          <span className="studio-status">{status}</span>
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
                    <small>/{page.slug}</small>
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
        </div>
      </header>
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
