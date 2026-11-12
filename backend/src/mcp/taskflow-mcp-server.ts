import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'taskflow', version: '1.0.0' });

function apiBaseUrl() {
  return (process.env.TASKFLOW_API_URL ?? 'http://127.0.0.1:3001/api').replace(/\/+$/, '');
}

async function apiRequest(path: string, init: RequestInit = {}) {
  const token = process.env.TASKFLOW_ACCESS_TOKEN?.trim();
  if (!token) throw new Error('Set TASKFLOW_ACCESS_TOKEN to an access token for the TaskFlow user.');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`TaskFlow API returned ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

server.tool(
  'list_tasks',
  'List tasks visible to the configured TaskFlow user. Results are limited to tasks that user can access.',
  {
    query: z.string().max(200).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  },
  async ({ query, limit = 20 }) => {
    const page = await apiRequest(`/tasks?limit=${limit}`) as {
      data?: Array<{ _id: string; title: string; description: string; status: string; priority: string; dueDate?: string | null }>;
    };
    const needle = query?.trim().toLocaleLowerCase();
    const tasks = (page.data ?? [])
      .filter((task) => !needle || `${task.title}\n${task.description}`.toLocaleLowerCase().includes(needle))
      .map(({ _id, title, description, status, priority, dueDate }) => ({
        id: _id,
        title,
        description,
        status,
        priority,
        dueDate: dueDate ?? null,
      }));
    return { content: [{ type: 'text', text: JSON.stringify(tasks) }] };
  },
);

server.tool(
  'create_task',
  'Create one TaskFlow task. Always show the proposed fields and get explicit user approval before calling with confirm=true.',
  {
    title: z.string().trim().min(1).max(200),
    description: z.string().max(2000).optional(),
    status: z.enum(['todo', 'in-progress', 'done']).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    dueDate: z.string().datetime().optional(),
    confirm: z.boolean().describe('Set true only after the user has reviewed and approved this exact task.'),
  },
  async ({ confirm, ...task }) => {
    if (!confirm) {
      return {
        isError: true,
        content: [{ type: 'text', text: 'Task not created. Show the proposed task to the user and call again with confirm=true only after approval.' }],
      };
    }
    const created = await apiRequest('/tasks', {
      method: 'POST',
      body: JSON.stringify(task),
    });
    return { content: [{ type: 'text', text: JSON.stringify(created) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
