'use client'

import Link from 'next/link'
import { ArrowRight, Braces, Github } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Avatar } from '@/components/avatar'
import { cn } from '@/lib/utils'

interface Template {
  id: string
  name: string
  description: string
  source: 'openapi' | 'github'
  url: string
  category: 'payments' | 'devtools' | 'ai' | 'comms' | 'data'
}

// Curated, well-known public APIs that have OpenAPI specs available.
// Clicking one deep-links into the wizard with source + url + name prefilled.
const templates: Template[] = [
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Payments, billing, subscriptions',
    source: 'openapi',
    url: 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.json',
    category: 'payments',
  },
  {
    id: 'github',
    name: 'GitHub REST',
    description: 'Repositories, issues, pull requests',
    source: 'openapi',
    url: 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json',
    category: 'devtools',
  },
  {
    id: 'digitalocean',
    name: 'DigitalOcean',
    description: 'Droplets, volumes, networking',
    source: 'openapi',
    url: 'https://api-engineering.nyc3.cdn.digitaloceanspaces.com/spec-ci/DigitalOcean-public.v2.yaml',
    category: 'devtools',
  },
  {
    id: 'twilio',
    name: 'Twilio',
    description: 'SMS, voice, WhatsApp messaging',
    source: 'openapi',
    url: 'https://raw.githubusercontent.com/twilio/twilio-oai/main/spec/json/twilio_api_v2010.json',
    category: 'comms',
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'Transactional email + marketing',
    source: 'openapi',
    url: 'https://raw.githubusercontent.com/sendgrid/sendgrid-oai/main/oai.json',
    category: 'comms',
  },
  {
    id: 'petstore',
    name: 'Swagger Petstore',
    description: 'Reference spec for testing extraction',
    source: 'openapi',
    url: 'https://petstore3.swagger.io/api/v3/openapi.json',
    category: 'data',
  },
]

const categoryColor: Record<Template['category'], string> = {
  payments: 'text-method-get bg-method-get/10',
  devtools: 'text-accent bg-accent/10',
  ai: 'text-method-patch bg-warning/10',
  comms: 'text-method-delete bg-error/10',
  data: 'text-text-secondary bg-surface-2',
}

export default function TemplatesPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-6 py-8">
      <PageHeader
        title="Templates"
        description="Curated OpenAPI specs — start a project in one click"
      />

      <p className="text-sm text-text-secondary mb-6 max-w-[640px] leading-relaxed">
        Each template deep-links into the New Project wizard with the source URL pre-filled.
        You still pick the name and base URL. Hatch extracts the endpoints and you generate
        the MCP server from there.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((t) => (
          <TemplateCard key={t.id} template={t} />
        ))}
      </div>

      <div className="mt-10 border border-border rounded-md bg-surface px-5 py-4 text-xs text-text-secondary leading-relaxed">
        <p className="text-text-primary font-medium mb-1">Don&apos;t see your API?</p>
        Paste any OpenAPI URL, Postman collection, GitHub repo, or docs page directly in the
        wizard.{' '}
        <Link
          href="/new"
          className="text-accent hover:text-accent-deep underline underline-offset-2"
        >
          Start with a custom source
        </Link>
        .
      </div>
    </div>
  )
}

function TemplateCard({ template }: { template: Template }) {
  const SourceIcon = template.source === 'github' ? Github : Braces

  const href = `/new?source=${template.source}&url=${encodeURIComponent(template.url)}&name=${encodeURIComponent(template.name)}`

  return (
    <Link
      href={href}
      className={cn(
        'group flex flex-col gap-3 border border-border rounded-md bg-surface p-5 transition-colors',
        'hover:border-border-strong hover:bg-surface-2'
      )}
    >
      <div className="flex items-center gap-3">
        <Avatar seed={template.name} size={32} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{template.name}</p>
          <p className="text-xs text-text-tertiary truncate">{template.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[3px] text-[10px] font-mono uppercase tracking-wider',
              categoryColor[template.category]
            )}
          >
            <SourceIcon className="size-3" />
            {template.source === 'github' ? 'GitHub' : 'OpenAPI'}
          </span>
          <span className="text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
            {template.category}
          </span>
        </div>

        <span className="inline-flex items-center gap-1 text-xs text-text-tertiary group-hover:text-text-primary transition-colors">
          Use
          <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  )
}
