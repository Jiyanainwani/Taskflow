import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const client = new Client({ name: 'taskflow-mcp-smoke-client', version: '1.0.0' })
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [
    path.join(backendRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'),
    path.join(backendRoot, 'src', 'mcp', 'taskflow-mcp-server.ts'),
  ],
  env: process.env,
})

try {
  await client.connect(transport)
  const { tools } = await client.listTools()
  const toolNames = new Set(tools.map((tool) => tool.name))
  assert.ok(toolNames.has('list_tasks'), 'MCP server should expose list_tasks')
  assert.ok(toolNames.has('create_task'), 'MCP server should expose create_task')

  const guardedCreate = await client.callTool({
    name: 'create_task',
    arguments: { title: 'MCP approval smoke check', confirm: false },
  })
  assert.equal(guardedCreate.isError, true, 'create_task must reject calls without approval')
  assert.match(guardedCreate.content[0].text, /Task not created/)

  process.stdout.write('MCP client smoke passed: tools listed and unconfirmed writes were rejected.\n')
} finally {
  await client.close()
}
