'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { CheckSquare, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { login, signup } from '@/lib/auth'

const schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be 100 characters or less').optional(),
  email: z.string().trim().email('Enter a valid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be 128 characters or less'),
})
type FormValues = z.infer<typeof schema>

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [serverError, setServerError] = useState('')
  const [pending, setPending] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...(mode === 'signup' ? { name: '' } : {}),
      email: '',
      password: '',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    setServerError('')
    setPending(true)
    try {
      if (mode === 'signup') {
        await signup(values.name ?? '', values.email, values.password)
        router.replace('/auth/login?registered=1')
      } else {
        await login(values.email, values.password)
        router.replace('/dashboard')
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.')
    } finally {
      setPending(false)
    }
  })

  const title = mode === 'login' ? 'Welcome back' : 'Create your account'

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <Card className="w-full max-w-md border-border/70 shadow-xl">
        <CardHeader className="items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <CheckSquare aria-hidden="true" className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <CardDescription>{mode === 'login' ? 'Sign in to continue to TaskFlow.' : 'Get started with your TaskFlow workspace.'}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {searchParams.get('registered') && <p role="status" className="mb-4 rounded-lg bg-primary/10 p-3 text-sm">Account created. Sign in with your new credentials.</p>}
          {searchParams.get('error') && <p role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Google sign-in could not be completed. Please try again.</p>}
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            {mode === 'signup' && <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" autoComplete="name" aria-invalid={!!errors.name} {...register('name')} />{errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}</div>}
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register('email')} />{errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}</div>
            <div className="space-y-2"><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-invalid={!!errors.password} {...register('password')} />{errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}</div>
            {serverError && <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{serverError}</p>}
            <Button type="submit" className="w-full" disabled={pending}>{pending && <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />}{pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</Button>
          </form>
          {mode === 'login' && <>
            <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" /></div>
            <Button type="button" variant="outline" className="w-full" onClick={() => { window.location.assign(`${(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '')}/auth/google`) }}>Continue with Google</Button>
          </>}
          <p className="mt-6 text-center text-sm text-muted-foreground">{mode === 'login' ? "Don't have an account? " : 'Already have an account? '}<Link className="font-medium text-foreground underline-offset-4 hover:underline" href={mode === 'login' ? '/auth/signup' : '/auth/login'}>{mode === 'login' ? 'Sign up' : 'Sign in'}</Link></p>
        </CardContent>
      </Card>
    </main>
  )
}
