'use client'

import { useMemo } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import {
  LayoutGrid,
  LayoutTemplate,
  Activity,
  Settings,
  BookOpen,
  Plus,
  ListChecks,
  Wrench,
  TestTube,
  Rocket,
  History,
  BarChart3,
  LogOut,
} from 'lucide-react'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command'
import { Avatar } from '@/components/avatar'
import { useCommandPalette } from '@/components/command-palette-context'
import { useProjects } from '@/hooks/use-projects'
import { useAuth } from '@/hooks/use-auth'

export function CommandPalette() {
  const { open, setOpen } = useCommandPalette()
  const router = useRouter()
  const pathname = usePathname()
  const { data } = useProjects()
  const { signOut } = useAuth()

  // Detect if we're inside a project so project-scoped actions appear
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const currentProjectId = projectMatch?.[1]

  const recent = useMemo(() => (data?.projects ?? []).slice(0, 8), [data])

  function go(href: string) {
    setOpen(false)
    router.push(href)
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[15%] -translate-x-1/2 z-50 w-[640px] max-w-[calc(100vw-32px)] border border-border-strong rounded-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] bg-surface-3 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Command shouldFilter loop>
            <CommandInput placeholder="Search projects, navigate, take actions…" autoFocus />

            <CommandList>
              <CommandEmpty>No results</CommandEmpty>

              {/* Actions */}
              <CommandGroup heading="Actions">
                <CommandItem onSelect={() => go('/new')} keywords={['create', 'project']}>
                  <Plus />
                  <span>Create new project</span>
                  <CommandShortcut>⌘N</CommandShortcut>
                </CommandItem>

                {currentProjectId && (
                  <>
                    <CommandItem
                      onSelect={() => go(`/projects/${currentProjectId}/deploy`)}
                      keywords={['deploy', 'ship', 'release']}
                    >
                      <Rocket />
                      <span>Deploy this project</span>
                    </CommandItem>
                    <CommandItem
                      onSelect={() => go(`/projects/${currentProjectId}/tests`)}
                      keywords={['test', 'run', 'tests']}
                    >
                      <TestTube />
                      <span>Run tests</span>
                    </CommandItem>
                  </>
                )}
              </CommandGroup>

              {/* Recent projects */}
              {recent.length > 0 && (
                <CommandGroup heading="Projects">
                  {recent.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`project-${p.id}-${p.name}-${p.slug}`}
                      onSelect={() => go(`/projects/${p.id}/endpoints`)}
                      keywords={[p.name, p.slug, p.source_type]}
                    >
                      <Avatar seed={p.name} size={18} className="text-[9px]" />
                      <span>{p.name}</span>
                      <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-text-tertiary">
                        {p.source_type}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {/* Project sub-pages — only when inside a project */}
              {currentProjectId && (
                <CommandGroup heading="This project">
                  <CommandItem
                    onSelect={() => go(`/projects/${currentProjectId}/endpoints`)}
                  >
                    <ListChecks />
                    <span>Endpoints</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go(`/projects/${currentProjectId}/tools`)}
                  >
                    <Wrench />
                    <span>Tools</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go(`/projects/${currentProjectId}/tests`)}
                  >
                    <TestTube />
                    <span>Tests</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go(`/projects/${currentProjectId}/deploy`)}
                  >
                    <Rocket />
                    <span>Deploy</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go(`/projects/${currentProjectId}/deployments`)}
                  >
                    <History />
                    <span>Deployments</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go(`/projects/${currentProjectId}/analytics`)}
                  >
                    <BarChart3 />
                    <span>Analytics</span>
                  </CommandItem>
                  <CommandItem
                    onSelect={() => go(`/projects/${currentProjectId}/settings`)}
                  >
                    <Settings />
                    <span>Project settings</span>
                  </CommandItem>
                </CommandGroup>
              )}

              {/* Global navigation */}
              <CommandGroup heading="Navigate">
                <CommandItem onSelect={() => go('/')}>
                  <LayoutGrid />
                  <span>Projects (Dashboard)</span>
                </CommandItem>
                <CommandItem onSelect={() => go('/templates')}>
                  <LayoutTemplate />
                  <span>Templates</span>
                </CommandItem>
                <CommandItem onSelect={() => go('/activity')}>
                  <Activity />
                  <span>Activity</span>
                </CommandItem>
                <CommandItem onSelect={() => go('/settings')}>
                  <Settings />
                  <span>Workspace settings</span>
                </CommandItem>
                <CommandItem onSelect={() => go('/docs')}>
                  <BookOpen />
                  <span>Docs</span>
                </CommandItem>
              </CommandGroup>

              {/* Account */}
              <CommandGroup heading="Account">
                <CommandItem
                  onSelect={async () => {
                    setOpen(false)
                    await signOut()
                  }}
                  keywords={['logout', 'sign out']}
                >
                  <LogOut />
                  <span>Sign out</span>
                </CommandItem>
              </CommandGroup>
            </CommandList>

            {/* Footer with keyboard hints */}
            <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] font-mono text-text-tertiary">
              <span>
                <kbd className="px-1.5 py-px border border-border rounded-[3px] bg-surface-2 text-text-secondary">
                  ↵
                </kbd>{' '}
                select
              </span>
              <span>
                <kbd className="px-1.5 py-px border border-border rounded-[3px] bg-surface-2 text-text-secondary">
                  ↑↓
                </kbd>{' '}
                navigate
              </span>
              <span>
                <kbd className="px-1.5 py-px border border-border rounded-[3px] bg-surface-2 text-text-secondary">
                  esc
                </kbd>{' '}
                close
              </span>
            </div>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
