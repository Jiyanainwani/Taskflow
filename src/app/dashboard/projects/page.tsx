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
    <main className="min-h-screen bg-background px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <header>
          <p className="text-sm font-medium text-primary">Workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Projects</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Organize your work into projects. Projects are currently private to their creator.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="size-5 text-primary" /> Create a project
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={createProject} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label htmlFor="project-name">Project name</Label>
                <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required placeholder="e.g. Website redesign" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="project-description">Description</Label>
                <Textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={1} placeholder="What is this project about?" />
              </div>
              <Button type="submit" disabled={createMutation.isPending || !name.trim()}>
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
                <Card key={project._id}>
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
                            <h3 className="truncate text-lg font-semibold">{project.name}</h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{project.description || 'No description added.'}</p>
                          </div>
                          <FolderKanban className="size-5 shrink-0 text-primary" />
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
