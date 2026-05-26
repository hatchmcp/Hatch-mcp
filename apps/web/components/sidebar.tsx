'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  LayoutTemplate,
  Activity,
  Settings,
  BookOpen,
  ListChecks,
  Wrench,
  TestTube,
  Rocket,
  History,
  BarChart3,
  ArrowLeft,
  ChevronRight,
  Package,
  KeyRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/sidebar-context'
import { useProjects, useProject } from '@/hooks/use-projects'
import { Avatar } from '@/components/avatar'

/* ─────────────────────────── Nav config ─────────────────────────── */

type Item = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const workspaceNav: Item[] = [
  { label: 'Projects', href: '/', icon: LayoutGrid },
  { label: 'Templates', href: '/templates', icon: LayoutTemplate },
  { label: 'Activity', href: '/activity', icon: Activity },
  { label: 'OAuth apps', href: '/oauth-apps', icon: KeyRound },
]

const workspaceBottom: Item[] = [
  { label: 'Docs', href: '/docs', icon: BookOpen },
  { label: 'Settings', href: '/settings', icon: Settings },
]

function projectPipeline(projectId: string): Item[] {
  return [
    { label: 'Endpoints', href: `/projects/${projectId}/endpoints`, icon: ListChecks },
    { label: 'Tools', href: `/projects/${projectId}/tools`, icon: Wrench },
    { label: 'Tests', href: `/projects/${projectId}/tests`, icon: TestTube },
    { label: 'Export', href: `/projects/${projectId}/export`, icon: Package },
  ]
}

function projectProduction(projectId: string): Item[] {
  return [
    { label: 'Deploy', href: `/projects/${projectId}/deploy`, icon: Rocket },
    { label: 'Deployments', href: `/projects/${projectId}/deployments`, icon: History },
    { label: 'Analytics', href: `/projects/${projectId}/analytics`, icon: BarChart3 },
  ]
}

function projectBottom(projectId: string): Item[] {
  return [
    { label: 'Settings', href: `/projects/${projectId}/settings`, icon: Settings },
  ]
}

/* ─────────────────────────── Sidebar ─────────────────────────── */

export function Sidebar() {
  const pathname = usePathname()
  const { collapsed } = useSidebar()

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/)
  const projectId = projectMatch?.[1]

  return (
    <aside
      className={cn(
        'border-r border-border bg-surface flex flex-col shrink-0 overflow-hidden',
        'transition-[width] duration-200 ease-out',
        collapsed ? 'w-[56px]' : 'w-[240px]'
      )}
    >
      {projectId ? (
        <ProjectSidebarBody projectId={projectId} pathname={pathname} collapsed={collapsed} />
      ) : (
        <WorkspaceSidebarBody pathname={pathname} collapsed={collapsed} />
      )}
    </aside>
  )
}

/* ─────────────────────────── Workspace body ─────────────────────────── */

function WorkspaceSidebarBody({
  pathname,
  collapsed,
}: {
  pathname: string
  collapsed: boolean
}) {
  const { data } = useProjects()
  const recent = (data?.projects ?? []).slice(0, 5)

  return (
    <>
      <div className="flex-1 overflow-y-auto py-3 px-2">
        <SidebarSection label="Workspace" collapsed={collapsed}>
          {workspaceNav.map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)}
              collapsed={collapsed}
            />
          ))}
        </SidebarSection>

        {!collapsed && recent.length > 0 && (
          <SidebarSection label="Recent">
            {recent.map((p) => {
              const href = `/projects/${p.id}/endpoints`
              const active = pathname.startsWith(`/projects/${p.id}`)
              return (
                <Link
                  key={p.id}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 h-8 pl-3 pr-2.5 rounded-sm text-[13px] transition-colors group',
                    active
                      ? 'bg-surface-2 text-text-primary'
                      : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                  )}
                >
                  <Avatar seed={p.name} size={18} className="text-[9px]" />
                  <span className="truncate flex-1">{p.name}</span>
                  <ChevronRight className="size-3 text-text-quaternary opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              )
            })}
          </SidebarSection>
        )}
      </div>

      <div className="border-t border-border py-3 px-2">
        {workspaceBottom.map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
            collapsed={collapsed}
          />
        ))}
      </div>
    </>
  )
}

/* ─────────────────────────── Project body ─────────────────────────── */

function ProjectSidebarBody({
  projectId,
  pathname,
  collapsed,
}: {
  projectId: string
  pathname: string
  collapsed: boolean
}) {
  const { data } = useProject(projectId)
  const project = data?.project

  return (
    <>
      {/* Project header */}
      <div className="border-b border-border">
        <Link
          href="/"
          className={cn(
            'flex items-center gap-2 px-3 h-9 text-[11px] font-mono text-text-tertiary hover:text-text-secondary transition-colors',
            collapsed && 'justify-center'
          )}
          title="Back to projects"
        >
          <ArrowLeft className="size-3 shrink-0" />
          {!collapsed && <span>Back to projects</span>}
        </Link>
        {!collapsed && (
          <div className="px-3 pb-3 pt-1 flex items-center gap-2 min-w-0">
            <Avatar seed={project?.name ?? projectId} size={22} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">
                {project?.name ?? '…'}
              </p>
              <p className="text-[10px] font-mono text-text-tertiary truncate">
                {project?.slug ?? ''}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3 px-2">
        <SidebarSection label="Pipeline" collapsed={collapsed}>
          {projectPipeline(projectId).map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              collapsed={collapsed}
            />
          ))}
        </SidebarSection>

        <SidebarSection label="Production" collapsed={collapsed}>
          {projectProduction(projectId).map((item) => (
            <SidebarLink
              key={item.href}
              item={item}
              active={pathname === item.href || pathname.startsWith(`${item.href}/`)}
              collapsed={collapsed}
            />
          ))}
        </SidebarSection>
      </div>

      <div className="border-t border-border py-3 px-2">
        {projectBottom(projectId).map((item) => (
          <SidebarLink
            key={item.href}
            item={item}
            active={pathname.startsWith(item.href)}
            collapsed={collapsed}
          />
        ))}
      </div>
    </>
  )
}

/* ─────────────────────────── Bits ─────────────────────────── */

function SidebarSection({
  label,
  collapsed,
  children,
}: {
  label: string
  collapsed?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="mb-4 last:mb-0">
      {!collapsed && (
        <h4 className="px-2.5 mb-1.5 text-[10px] font-mono uppercase tracking-wider text-text-tertiary">
          {label}
        </h4>
      )}
      {collapsed && <div className="h-px bg-border mx-2 mb-2 first:hidden" aria-hidden />}
      <nav className="flex flex-col gap-px">{children}</nav>
    </div>
  )
}

function SidebarLink({
  item,
  active,
  collapsed,
}: {
  item: Item
  active: boolean
  collapsed: boolean
}) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group relative flex items-center h-8 rounded-sm text-[13px] transition-colors',
        collapsed ? 'justify-center px-0 mx-auto w-9' : 'gap-2.5 pl-3 pr-2.5',
        active
          ? 'bg-surface-2 text-text-primary font-medium'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
      )}
    >
      {active && !collapsed && (
        <span
          className="absolute left-0 top-1.5 bottom-1.5 w-[2px] bg-accent rounded-r"
          aria-hidden
        />
      )}
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          active ? 'text-text-primary' : 'text-text-tertiary group-hover:text-text-secondary'
        )}
      />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )
}
