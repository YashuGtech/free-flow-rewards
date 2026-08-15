import { Link as RouterLink } from "@tanstack/react-router";
import type { ReactNode, MouseEventHandler } from "react";

/**
 * Drop-in replacement for the framework `Link` the app was written against:
 * accepts `href` and forwards to TanStack Router's `to`.
 */
export default function Link({
  href,
  children,
  className,
  onClick,
  title,
  target,
  rel,
}: {
  href: string;
  children?: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  title?: string;
  target?: string;
  rel?: string;
}) {
  const external = /^(https?:|mailto:|tg:)/.test(href);
  if (external) {
    return (
      <a href={href} className={className} onClick={onClick} title={title} target={target} rel={rel}>
        {children}
      </a>
    );
  }
  return (
    <RouterLink to={href} className={className} onClick={onClick} title={title}>
      {children}
    </RouterLink>
  );
}
