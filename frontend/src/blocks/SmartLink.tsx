import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { sameSitePath } from '../lib/sameSitePath'

type Props = { href: string; className?: string; children: ReactNode }

/**
 * A link whose URL comes from the database. Same-site paths go through the router and http(s) URLs
 * are plain links. Anything else (e.g. "javascript:", or "/\t/evil.example", which the browser reads
 * as "//evil.example") renders the content without a link.
 */
export function SmartLink({ href, className, children }: Props) {
  const path = sameSitePath(href)
  if (path !== null) {
    return (
      <Link to={path} className={className}>
        {children}
      </Link>
    )
  }
  if (/^https?:\/\//i.test(href)) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    )
  }
  return <div className={className}>{children}</div>
}
