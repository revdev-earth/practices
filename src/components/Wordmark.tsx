import Link from 'next/link'

export default function Wordmark({ href }: { href: string }) {
  return (
    <Link href={href} className="font-display text-xl font-bold tracking-tight text-ink">
      Practices
    </Link>
  )
}
