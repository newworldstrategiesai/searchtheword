"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { isSafeAssistantHref } from "@/lib/assistant-chat-markup";

function renderMarkdownLite(text: string): ReactNode {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    if (text.startsWith("**", i)) {
      const end = text.indexOf("**", i + 2);
      if (end !== -1) {
        nodes.push(<strong key={key++}>{text.slice(i + 2, end)}</strong>);
        i = end + 2;
        continue;
      }
    }

    const sub = text.slice(i);
    const linkMatch = sub.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      const href = linkMatch[2].trim();
      if (isSafeAssistantHref(href)) {
        const isExternal = /^https?:\/\//i.test(href);
        nodes.push(
          <Link
            key={key++}
            href={href}
            className="font-medium text-primary underline underline-offset-2 hover:underline"
            {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {linkMatch[1]}
          </Link>,
        );
        i += linkMatch[0].length;
        continue;
      }
    }

    const urlMatch = sub.match(/^https?:\/\/[^\s<>"')\]]+/i);
    if (urlMatch) {
      const href = urlMatch[0];
      if (isSafeAssistantHref(href)) {
        nodes.push(
          <Link
            key={key++}
            href={href}
            className="font-medium text-primary underline underline-offset-2 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {href}
          </Link>,
        );
        i += href.length;
        continue;
      }
    }

    let j = i + 1;
    while (j < text.length) {
      if (text.startsWith("**", j)) break;
      if (text[j] === "[") break;
      if (/^https?:\/\//i.test(text.slice(j, j + 8))) break;
      j++;
    }
    nodes.push(<span key={key++}>{text.slice(i, j)}</span>);
    i = j;
  }

  return <>{nodes}</>;
}

type AssistantMessageBodyProps = {
  role: "user" | "assistant";
  /** For assistant, pass text with bracket-navigation already stripped (parent handles that). */
  content: string;
};

/**
 * User bubbles: plain text. Assistant: **bold**, [label](url), and https:// autolinks.
 */
export function AssistantMessageBody({ role, content }: AssistantMessageBodyProps) {
  if (role === "user") {
    return <>{content}</>;
  }
  return <>{renderMarkdownLite(content)}</>;
}
