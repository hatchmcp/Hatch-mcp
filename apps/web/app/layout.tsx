import type { Metadata, Viewport } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import { Providers } from './providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: {
    default: 'Hatch — Ship production MCP servers in minutes',
    template: '%s · Hatch',
  },
  description:
    'Paste a repo, an OpenAPI spec, or a Postman collection. Hatch extracts every endpoint, generates typed tools, runs the test loop, and deploys to a versioned subdomain.',
  applicationName: 'Hatch',
  authors: [{ name: 'Hatch Labs' }],
  openGraph: {
    title: 'Hatch — Ship production MCP servers in minutes',
    description:
      'Convert any API into a hosted MCP server. Generate. Test. Deploy.',
    type: 'website',
    siteName: 'Hatch',
  },
  twitter: {
    card: 'summary',
    title: 'Hatch — Ship production MCP servers in minutes',
    description:
      'Convert any API into a hosted MCP server. Generate. Test. Deploy.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0A',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
