'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  ArrowLeft,
  Github,
  Braces,
  Box,
  FileText,
  Check,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { previewSlug } from '@/lib/slug'
import { ApiError } from '@/lib/api'
import { useCreateProject, useStartIngest } from '@/hooks/use-projects'
import { useJobRail } from '@/components/job-rail-context'
import type { SourceType } from '@/types/api'

type SourceOption = {
  id: SourceType
  label: string
  hint: string
  icon: React.ComponentType<{ className?: string }>
}

const sourceOptions: SourceOption[] = [
  {
    id: 'github',
    label: 'GitHub repo',
    hint: 'Auto-detect routes',
    icon: Github,
  },
  {
    id: 'openapi',
    label: 'OpenAPI spec',
    hint: 'JSON or YAML URL',
    icon: Braces,
  },
  {
    id: 'postman',
    label: 'Postman collection',
    hint: 'Public JSON URL',
    icon: Box,
  },
  {
    id: 'docs',
    label: 'Docs page',
    hint: 'Any URL with API reference',
    icon: FileText,
  },
]

const stepLabels = ['Source', 'Config', 'Review'] as const
type Step = 0 | 1 | 2

interface WizardState {
  sourceType: SourceType | null
  sourceUrl: string
  sourceRef: string
  name: string
  baseApiUrl: string
  description: string
}

const initialState: WizardState = {
  sourceType: null,
  sourceUrl: '',
  sourceRef: '',
  name: '',
  baseApiUrl: '',
  description: '',
}

const VALID_SOURCES: SourceType[] = ['github', 'openapi', 'postman', 'docs', 'paste']

export default function NewProjectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // If a Template link routed us here with ?source=...&url=...&name=..., pre-fill
  // and skip straight to step 1 (Config) since Source is already chosen.
  const initialFromQuery = useMemo<WizardState>(() => {
    const sourceParam = searchParams.get('source')
    const source = (VALID_SOURCES as string[]).includes(sourceParam ?? '')
      ? (sourceParam as SourceType)
      : null
    return {
      ...initialState,
      sourceType: source,
      sourceUrl: searchParams.get('url') ?? '',
      sourceRef: searchParams.get('ref') ?? '',
      name: searchParams.get('name') ?? '',
      baseApiUrl: searchParams.get('base') ?? '',
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [step, setStep] = useState<Step>(initialFromQuery.sourceType && initialFromQuery.sourceUrl ? 1 : 0)
  const [state, setState] = useState<WizardState>(initialFromQuery)

  const createProject = useCreateProject()
  const startIngest = useStartIngest()
  const jobRail = useJobRail()
  const submitting = createProject.isPending || startIngest.isPending

  const slugPreview = useMemo(() => previewSlug(state.name) || 'your-project', [state.name])

  // Per-step validity
  const sourceValid =
    !!state.sourceType && !!state.sourceUrl.trim() && /^https?:\/\//i.test(state.sourceUrl.trim())
  const configValid = state.name.trim().length > 0
  const canSubmit = sourceValid && configValid

  function update<K extends keyof WizardState>(key: K, value: WizardState[K]) {
    setState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit() {
    if (!canSubmit || !state.sourceType) return

    try {
      const { project } = await createProject.mutateAsync({
        name: state.name.trim(),
        source_type: state.sourceType,
        source_url: state.sourceUrl.trim() || undefined,
        source_ref: state.sourceRef.trim() || undefined,
        base_api_url: state.baseApiUrl.trim() || undefined,
        description: state.description.trim() || undefined,
      })

      const { job_id } = await startIngest.mutateAsync(project.id)
      jobRail.start(job_id, { label: 'Ingesting source', kind: 'ingest' })

      router.replace(`/projects/${project.id}/endpoints?job=${job_id}`)
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not create project')
    }
  }

  return (
    <div className="max-w-[760px] mx-auto px-6 py-10">
      {/* Header + stepper */}
      <div className="mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-secondary mb-4"
        >
          <ArrowLeft className="size-3" />
          Back to projects
        </Link>
        <h1 className="text-xl font-semibold tracking-tight mb-5">New project</h1>
        <Stepper step={step} />
      </div>

      {/* Step body */}
      <div className="border border-border rounded-md bg-surface p-7">
        {step === 0 && (
          <SourceStep
            state={state}
            update={update}
          />
        )}
        {step === 1 && (
          <ConfigStep state={state} update={update} slugPreview={slugPreview} />
        )}
        {step === 2 && <ReviewStep state={state} slugPreview={slugPreview} />}
      </div>

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-6">
        <Button variant="ghost" asChild>
          <Link href="/">Cancel</Link>
        </Button>

        <div className="flex items-center gap-2.5">
          {step > 0 && (
            <Button
              variant="secondary"
              onClick={() => setStep((s) => (s - 1) as Step)}
              disabled={submitting}
            >
              <ArrowLeft />
              Back
            </Button>
          )}

          {step < 2 && (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={step === 0 ? !sourceValid : !configValid}
            >
              Continue
              <ArrowRight />
            </Button>
          )}

          {step === 2 && (
            <Button onClick={handleSubmit} disabled={!canSubmit || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Starting…
                </>
              ) : (
                <>
                  Start ingestion
                  <ArrowRight />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────── Stepper ─────────────────────────── */

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-3 text-xs">
      {stepLabels.map((label, i) => {
        const active = i === step
        const done = i < step
        return (
          <li key={label} className="flex items-center gap-3">
            <div
              className={cn(
                'inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-mono',
                done && 'bg-accent border-accent text-accent-bg-text',
                active && 'border-accent text-accent bg-accent/10',
                !active && !done && 'border-border text-text-tertiary bg-surface'
              )}
            >
              {done ? <Check className="size-3" /> : i + 1}
            </div>
            <span
              className={cn(
                'font-mono uppercase tracking-wider',
                active || done ? 'text-text-primary' : 'text-text-tertiary'
              )}
            >
              {label}
            </span>
            {i < stepLabels.length - 1 && (
              <span className="w-8 h-px bg-border" aria-hidden />
            )}
          </li>
        )
      })}
    </ol>
  )
}

/* ─────────────────────────── Step 1: Source ─────────────────────────── */

function SourceStep({
  state,
  update,
}: {
  state: WizardState
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold tracking-tight mb-1.5">
          Where is your API defined?
        </h2>
        <p className="text-xs text-text-secondary">
          Pick one. Hatch will extract every endpoint automatically.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {sourceOptions.map((opt) => {
          const Icon = opt.icon
          const selected = state.sourceType === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => update('sourceType', opt.id)}
              className={cn(
                'flex flex-col items-start gap-2 p-4 border rounded-md text-left transition-colors',
                selected
                  ? 'border-accent bg-accent/5'
                  : 'border-border bg-bg hover:border-border-strong hover:bg-surface-2'
              )}
            >
              <div className="flex items-center gap-2 w-full">
                <Icon
                  className={cn(
                    'size-4',
                    selected ? 'text-accent' : 'text-text-secondary'
                  )}
                />
                <span className="text-sm font-medium text-text-primary">{opt.label}</span>
                {selected && <Check className="size-3.5 text-accent ml-auto" />}
              </div>
              <span className="text-xs text-text-tertiary">{opt.hint}</span>
            </button>
          )
        })}
      </div>

      {state.sourceType && (
        <div className="space-y-3 pt-2 border-t border-border">
          <Field
            label={urlLabel(state.sourceType)}
            hint={urlHint(state.sourceType)}
          >
            <Input
              type="url"
              placeholder={urlPlaceholder(state.sourceType)}
              value={state.sourceUrl}
              onChange={(e) => update('sourceUrl', e.target.value)}
              autoFocus
            />
          </Field>

          {state.sourceType === 'github' && (
            <Field label="Branch (optional)" hint="Defaults to the repo's default branch.">
              <Input
                type="text"
                placeholder="main"
                value={state.sourceRef}
                onChange={(e) => update('sourceRef', e.target.value)}
              />
            </Field>
          )}
        </div>
      )}
    </div>
  )
}

function urlLabel(t: SourceType): string {
  switch (t) {
    case 'github':
      return 'Repository URL'
    case 'openapi':
      return 'OpenAPI spec URL'
    case 'postman':
      return 'Collection URL'
    case 'docs':
      return 'Docs page URL'
    default:
      return 'URL'
  }
}

function urlHint(t: SourceType): string {
  switch (t) {
    case 'github':
      return 'Public repo, or one your GitHub App has access to.'
    case 'openapi':
      return 'JSON or YAML.'
    case 'postman':
      return 'A publicly accessible JSON URL.'
    case 'docs':
      return "We'll convert the page to Markdown and extract routes."
    default:
      return ''
  }
}

function urlPlaceholder(t: SourceType): string {
  switch (t) {
    case 'github':
      return 'https://github.com/acme/api'
    case 'openapi':
      return 'https://api.acme.com/openapi.json'
    case 'postman':
      return 'https://gist.githubusercontent.com/.../collection.json'
    case 'docs':
      return 'https://docs.acme.com/api'
    default:
      return ''
  }
}

/* ─────────────────────────── Step 2: Config ─────────────────────────── */

function ConfigStep({
  state,
  update,
  slugPreview,
}: {
  state: WizardState
  update: <K extends keyof WizardState>(key: K, value: WizardState[K]) => void
  slugPreview: string
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight mb-1.5">
          Name your MCP server
        </h2>
        <p className="text-xs text-text-secondary">
          The subdomain is derived from the name. You can rename it later.
        </p>
      </div>

      <Field label="Project name">
        <Input
          type="text"
          placeholder="acme-api"
          value={state.name}
          onChange={(e) => update('name', e.target.value)}
          autoFocus
        />
        <div className="flex items-center gap-2 mt-2 text-xs text-text-tertiary font-mono">
          <span className="text-text-quaternary">↪</span>
          <span>
            <span className="text-text-secondary">{slugPreview}</span>
            <span className="text-text-quaternary">-</span>
            <span className="text-text-quaternary">xxxx</span>
            <span className="text-text-secondary">.mcp.hatch.dev</span>
          </span>
        </div>
      </Field>

      <Field
        label="Base API URL"
        hint={
          state.sourceType === 'openapi' || state.sourceType === 'postman'
            ? 'Optional — parsed from the spec if not provided.'
            : 'The host every generated tool will call.'
        }
      >
        <Input
          type="url"
          placeholder="https://api.acme.com"
          value={state.baseApiUrl}
          onChange={(e) => update('baseApiUrl', e.target.value)}
        />
      </Field>

      <Field label="Description (optional)">
        <textarea
          placeholder="What does this API do?"
          value={state.description}
          onChange={(e) => update('description', e.target.value)}
          rows={3}
          className={cn(
            'flex w-full rounded-sm border border-border bg-bg px-3 py-2 text-sm text-text-primary',
            'placeholder:text-text-tertiary resize-none',
            'focus-visible:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/10',
            'transition-colors'
          )}
        />
      </Field>
    </div>
  )
}

/* ─────────────────────────── Step 3: Review ─────────────────────────── */

function ReviewStep({
  state,
  slugPreview,
}: {
  state: WizardState
  slugPreview: string
}) {
  const sourceLabel = sourceOptions.find((o) => o.id === state.sourceType)?.label ?? '—'

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight mb-1.5">
          Ready to launch
        </h2>
        <p className="text-xs text-text-secondary">
          Hatch will fetch the source, extract endpoints, and stream progress live.
        </p>
      </div>

      <dl className="border border-border rounded-md divide-y divide-border">
        <ReviewRow label="Name" value={state.name} mono />
        <ReviewRow
          label="Subdomain"
          value={`${slugPreview}-xxxx.mcp.hatch.dev`}
          mono
          dim
        />
        <ReviewRow label="Source" value={sourceLabel} />
        <ReviewRow label="URL" value={state.sourceUrl} mono />
        {state.sourceRef && <ReviewRow label="Branch" value={state.sourceRef} mono />}
        {state.baseApiUrl && (
          <ReviewRow label="Base API URL" value={state.baseApiUrl} mono />
        )}
        {state.description && (
          <ReviewRow label="Description" value={state.description} />
        )}
      </dl>

      <p className="text-xs text-text-tertiary">
        Auth credentials are configured later — pick the auth type and paste the API key on the{' '}
        <span className="font-mono text-text-secondary">Deploy</span> step.
      </p>
    </div>
  )
}

function ReviewRow({
  label,
  value,
  mono,
  dim,
}: {
  label: string
  value: string
  mono?: boolean
  dim?: boolean
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5 text-sm">
      <dt className="text-xs text-text-tertiary uppercase tracking-wider font-mono">
        {label}
      </dt>
      <dd
        className={cn(
          'truncate',
          mono && 'font-mono',
          dim ? 'text-text-secondary' : 'text-text-primary'
        )}
      >
        {value}
      </dd>
    </div>
  )
}

/* ─────────────────────────── Shared Field ─────────────────────────── */

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="text-xs font-medium text-text-secondary mb-1.5 block">
        {label}
      </label>
      {children}
      {hint && <p className="text-[11px] text-text-tertiary mt-1.5">{hint}</p>}
    </div>
  )
}
