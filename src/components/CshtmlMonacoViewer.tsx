"use client";

import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[calc(100vh-150px)] place-items-center text-sm font-bold text-[#5f6368]">
      Loading CSHTML editor...
    </div>
  ),
});

type CshtmlMonacoViewerProps = {
  value: string;
};

export function CshtmlMonacoViewer({ value }: CshtmlMonacoViewerProps) {
  return (
    <MonacoEditor
      height="calc(100vh - 150px)"
      language="html"
      options={{
        automaticLayout: true,
        fontLigatures: true,
        fontSize: 13,
        lineNumbersMinChars: 3,
        minimap: { enabled: true },
        padding: { top: 12 },
        readOnly: true,
        renderValidationDecorations: "off",
        scrollBeyondLastLine: false,
        tabSize: 2,
        wordWrap: "on",
      }}
      theme="vs-dark"
      value={value}
    />
  );
}
