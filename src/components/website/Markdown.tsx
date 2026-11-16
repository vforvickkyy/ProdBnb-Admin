"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { fillTokens } from "@/lib/seo";

/** Renders a page's Markdown the way the website does (tokens filled in), for the editor preview. */
export function MarkdownPreview({ body }: { body: string }) {
  return (
    <div className="page-prose">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{fillTokens(body)}</ReactMarkdown>
    </div>
  );
}
