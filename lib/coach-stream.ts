export type OpenAIStreamResult = {
  status?: string;
  usage?: { input_tokens?: number; output_tokens?: number; input_tokens_details?: { cached_tokens?: number } };
  output?: { content?: { type: string; text?: string }[] }[];
};

export function messageFromStructuredJson(raw: string) {
  const match = /"message"\s*:\s*"/.exec(raw);
  if (!match) return '';
  let value = '';
  for (let i = match.index + match[0].length; i < raw.length; i++) {
    const char = raw[i];
    if (char === '"') break;
    if (char !== '\\') { value += char; continue; }
    const escape = raw[++i];
    if (escape === undefined) break;
    if (escape === '"' || escape === '\\' || escape === '/') value += escape;
    else if (escape === 'b') value += '\b';
    else if (escape === 'f') value += '\f';
    else if (escape === 'n') value += '\n';
    else if (escape === 'r') value += '\r';
    else if (escape === 't') value += '\t';
    else if (escape === 'u') {
      const hex = raw.slice(i + 1, i + 5);
      if (hex.length < 4 || !/^[\da-f]{4}$/i.test(hex)) break;
      value += String.fromCharCode(parseInt(hex, 16));
      i += 4;
    }
  }
  return value;
}

export function streamStructuredCoachResponse<T>(
  response: Response,
  finalize: (reply: Record<string, any>, result: OpenAIStreamResult) => Promise<T>,
  failureMessage: string,
) {
  const stream = new ReadableStream<Uint8Array>({ start(controller) {
    const encoder = new TextEncoder();
    let streamed = '';
    const emit = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    void (async () => {
      const reader = response.body?.getReader();
      if (!reader) throw new Error(failureMessage);
      const decoder = new TextDecoder();
      let buffer = '', eventData: string[] = [], completed: Record<string, unknown> | null = null, raw = '';
      const handle = (line: string) => {
        if (!line.startsWith('data:')) return;
        const value = line.slice(5).trim();
        if (!value || value === '[DONE]') return;
        const event = JSON.parse(value) as { type?: string; delta?: string; response?: Record<string, unknown> };
        if (event.type === 'response.output_text.delta' && typeof event.delta === 'string') {
          raw += event.delta;
          const message = messageFromStructuredJson(raw);
          if (message.startsWith(streamed) && message.length > streamed.length) {
            emit({ type: 'delta', text: message.slice(streamed.length) });
            streamed = message;
          }
        } else if (event.type === 'response.completed') completed = event.response || null;
        else if (event.type === 'response.failed' || event.type === 'error') throw new Error(failureMessage);
      };
      const flush = () => { for (const line of eventData) handle(`data:${line}`); eventData = []; };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newline: number;
        while ((newline = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, newline).replace(/\r$/, '');
          buffer = buffer.slice(newline + 1);
          if (!line) flush();
          else if (line.startsWith('data:')) eventData.push(line.slice(5).trimStart());
        }
      }
      buffer += decoder.decode();
      if (buffer.startsWith('data:')) eventData.push(buffer.slice(5).trim());
      flush();
      const result = completed as OpenAIStreamResult | null;
      if (!result || result.status !== 'completed') throw new Error(failureMessage);
      const text = result.output?.flatMap(item => item.content || []).filter(item => item.type === 'output_text').map(item => item.text || '').join('');
      const reply = JSON.parse(text || '{}') as Record<string, any>;
      emit({ type: 'done', reply: await finalize(reply, result) });
    })().catch(error => emit({ type: 'error', message: error instanceof Error ? error.message : failureMessage })).finally(() => controller.close());
  }});
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'X-Accel-Buffering': 'no' } });
}

export async function readCoachResponse<T extends { message?: string }>(response: Response, onDelta: (text: string) => void): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || 'Your coach could not respond.');
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) return await response.json() as T;
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The coach reply stream was unavailable.');
  const decoder = new TextDecoder();
  let buffer = '', eventData: string[] = [], result: T | null = null, streamError = '';
  const handle = (line: string) => {
    if (!line.startsWith('data:')) return;
    const value = line.slice(5).trim();
    if (!value) return;
    const event = JSON.parse(value) as { type?: string; text?: string; message?: string; reply?: T; plan?: T };
    if (event.type === 'delta' && event.text) onDelta(event.text);
    else if (event.type === 'done') result = event.reply || event.plan || null;
    else if (event.type === 'error') streamError = event.message || 'Your coach could not finish this reply. Please try again.';
  };
  const flush = () => { for (const line of eventData) handle(`data:${line}`); eventData = []; };
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline: number;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).replace(/\r$/, '');
      buffer = buffer.slice(newline + 1);
      if (!line) flush();
      else if (line.startsWith('data:')) eventData.push(line.slice(5).trimStart());
    }
  }
  buffer += decoder.decode();
  if (buffer.startsWith('data:')) eventData.push(buffer.slice(5).trim());
  flush();
  if (streamError) throw new Error(streamError);
  if (!result) throw new Error('The coach reply ended before it was complete. Please try again.');
  return result;
}
