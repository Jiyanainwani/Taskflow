'use client'

import { useState, type FormEvent } from 'react'
import { FolderKanban, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
} from '@/lib/workspace-queries'
import type { ApiProject } from '@/lib/projects-api'

export default function ProjectsPage() {
  const projectsQuery = useProjects()
  const createMutation = useCreateProject()
  const updateMutation = useUpdateProject()
  const deleteMutation = useDeleteProject()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setActionError(null)
    try {
      await createMutation.mutateAsync({ name: name.trim(), description: description.trim() })
      setName('')
      setDescription('')
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not create the project.')
    }
  }

  function beginEdit(project: ApiProject) {
    setEditingId(project._id)
    setEditName(project.name)
    setEditDescription(project.description ?? '')
    setActionError(null)
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault()
    setActionError(null)
    try {
      await updateMutation.mutateAsync({
        id,
        input: { name: editName.trim(), description: editDescription.trim() },
      })
      setEditingId(null)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not update the project.')
    }
  }

  async function removeProject(project: ApiProject) {
    if (!window.confirm(`Delete “${project.name}”? This cannot be undone.`)) return
    setActionError(null)
    try {
      await deleteMutation.mutateAsync(project._id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not delete the project.')
    }
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-6xl space-y-9">
        <header>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Planning</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Projects</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            Organize your work into projects. Projects are currently private to their creator.
          </p>
        </header>

        <Card className="gap-0 overflow-hidden border-transparent py-0 shadow-sm ring-1 ring-border/70">
          <CardHeader className="w-full border-b border-border/60 bg-gradient-to-r from-primary/[0.09] via-primary/[0.035] to-transparent py-4">
            <CardTitle className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Plus className="size-4 text-primary" /> Create a project
            </CardTitle>
          </CardHeader>
          <CardContent className="w-full p-5 sm:p-6">
            <form onSubmit={createProject} className="grid gap-x-5 gap-y-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)_auto] md:items-end">
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="project-name" className="text-xs font-semibold">Project name</Label>
                <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="e.g. Website redesign" className="h-11 bg-background shadow-sm" />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <Label htmlFor="project-description" className="text-xs font-semibold">Description</Label>
                <Textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={1} placeholder="What is this project about?" className="h-11 min-h-11 resize-y bg-background py-3 shadow-sm" />
              </div>
              <Button type="submit" className="h-11 w-full rounded-lg px-5 shadow-sm shadow-primary/15 md:w-auto" disabled={createMutation.isPending || !name.trim()}>
                {createMutation.isPending ? 'Creating…' : 'Create project'}
              </Button>
            </form>
            {createMutation.isError && <p role="alert" className="mt-3 text-sm text-destructive">{createMutation.error.message}</p>}
          </CardContent>
        </Card>

        <section aria-labelledby="your-projects-heading" className="space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 id="your-projects-heading" className="text-xl font-semibold">Your projects</h2>
              <p className="mt-1 text-sm text-muted-foreground">Changes save to your account through the TaskFlow API.</p>
            </div>
            {!projectsQuery.isPending && !projectsQuery.isError && (
              <span className="text-sm text-muted-foreground">{projectsQuery.data.length} projects</span>
            )}
          </div>

          {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
          {projectsQuery.isPending ? (
            <div className="grid gap-4 md:grid-cols-2">{[0, 1].map((item) => <div key={item} className="h-36 animate-pulse rounded-xl bg-muted" />)}</div>
          ) : projectsQuery.isError ? (
            <Card><CardContent className="flex flex-col items-start gap-3 p-6">
              <p role="alert" className="text-sm text-destructive">{projectsQuery.error.message}</p>
              <Button variant="outline" onClick={() => projectsQuery.refetch()}>Try again</Button>
            </CardContent></Card>
          ) : projectsQuery.data.length === 0 ? (
            <Card className="border-dashed"><CardContent className="flex flex-col items-center py-12 text-center">
              <FolderKanban className="mb-3 size-8 text-muted-foreground" />
              <h3 className="font-semibold">No projects yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Create your first project to get started.</p>
            </CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {projectsQuery.data.map((project) => (
                <Card key={project._id} className="border-transparent shadow-sm ring-1 ring-border/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-5">
                    {editingId === project._id ? (
                      <form onSubmit={(event) => saveEdit(event, project._id)} className="space-y-4">
                        <div className="space-y-2"><Label htmlFor={`edit-name-${project._id}`}>Project name</Label>
                          <Input id={`edit-name-${project._id}`} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={100} required /></div>
                        <div className="space-y-2"><Label htmlFor={`edit-description-${project._id}`}>Description</Label>
                          <Textarea id={`edit-description-${project._id}`} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} maxLength={1000} rows={2} /></div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                          <Button type="submit" disabled={updateMutation.isPending || !editName.trim()}>{updateMutation.isPending ? 'Saving…' : 'Save changes'}</Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex min-h-28 flex-col">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold tracking-tight">{project.name}</h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{project.description || 'No description added.'}</p>
                          </div>
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <FolderKanban className="size-5" />
                          </span>
                        </div>
                        <div className="mt-auto flex justify-end gap-2 border-t border-border/60 pt-3">
                          <Button variant="outline" size="sm" onClick={() => beginEdit(project)}><Pencil className="mr-2 size-4" />Edit</Button>
                          <Button variant="destructive" size="sm" disabled={deleteMutation.isPending} onClick={() => void removeProject(project)}><Trash2 className="mr-2 size-4" />Delete</Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
