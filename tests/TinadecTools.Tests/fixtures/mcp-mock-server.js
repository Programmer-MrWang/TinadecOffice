const readline = require('node:readline');

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

function respond(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');
}

function fail(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }) + '\n');
}

const tools = [
  {
    name: 'echo',
    description: 'Echoes the provided message.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo.' }
      },
      required: ['message']
    }
  },
  {
    name: 'read_file',
    description: 'Reads a file from the mock filesystem.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' }
      }
    }
  }
];

rl.on('line', (line) => {
  if (!line.trim()) return;
  const request = JSON.parse(line);
  if (request.id === undefined || request.id === null) return;

  if (request.method === 'initialize') {
    const initialize = () => respond(request.id, {
      protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'tinadec-mock-mcp', version: '1.0.0' }
    });
    if (process.env.TINADEC_MCP_INIT_DELAY_MS) setTimeout(initialize, Number(process.env.TINADEC_MCP_INIT_DELAY_MS));
    else initialize();
    return;
  }

  if (request.method === 'tools/list') {
    respond(request.id, { tools });
    return;
  }

  if (request.method === 'tools/call') {
    const name = request.params?.name;
    const args = request.params?.arguments ?? {};
    if (name === 'echo') {
      const send = () => respond(request.id, { content: [{ type: 'text', text: `${process.env.TINADEC_MCP_ECHO_PREFIX ?? 'echo'}:${args.message ?? ''}` }], isError: false });
      if (args.delay_ms > 0) setTimeout(send, args.delay_ms);
      else send();
      return;
    }

    if (name === 'read_file') {
      respond(request.id, { content: [{ type: 'text', text: `file:${args.path ?? ''}` }], isError: false });
      return;
    }

    fail(request.id, -32601, `Unknown tool: ${name}`);
    return;
  }

  fail(request.id, -32601, `Unknown method: ${request.method}`);
});
