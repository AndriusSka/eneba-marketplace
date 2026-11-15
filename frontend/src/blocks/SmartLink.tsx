import type { ReactNode } from 'react'
import { Link } from 'react-router'

type Props = { href: string; className?: string; children: ReactNode }

/**
 * A link whose URL comes from the database. Same-site paths go through the router and http(s) URLs
 * are plain links. Any other scheme (e.g. "javascript:") renders the content without a link.
 */
export function SmartLink({ href, className, children }: Props) {
  if (href.startsWith('/') && !href.startsWith('//') && !href.includes('\\')) {
    return (
      <Link to={href} className={className}>
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
