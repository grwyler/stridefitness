import assert from 'node:assert/strict';
import test from 'node:test';
import { readCoachResponse } from '../lib/coach-stream.ts';

const event = (value) => `data: ${JSON.stringify(value)}\n\n`;
const streamResponse = (body, contentType = 'text/event-stream; charset=utf-8') =>
  new Response(body, { headers: { 'Content-Type': contentType } });

test('reads a normal streamed coach reply and forwards text as it arrives', async () => {
  const deltas = [];
  const response = streamResponse(
    event({ type: 'delta', text: 'Try ' }) +
    event({ type: 'delta', text: 'leg press.' }) +
    event({ type: 'done', plan: { message: 'Try leg press.' } }),
  );

  const result = await readCoachResponse(response, (text) => deltas.push(text));

  assert.deepEqual(deltas, ['Try ', 'leg press.']);
  assert.deepEqual(result, { message: 'Try leg press.' });
});

test('recognizes an SSE body when a proxy changes its content type', async () => {
  const response = streamResponse(
    event({ type: 'done', plan: { message: 'Template change ready.' } }),
    'application/json',
  );

  assert.deepEqual(await readCoachResponse(response, () => {}), { message: 'Template change ready.' });
});

test('continues to accept ordinary JSON coach replies', async () => {
  const response = new Response(JSON.stringify({ message: 'A direct reply.' }), {
    headers: { 'Content-Type': 'application/json' },
  });

  assert.deepEqual(await readCoachResponse(response, () => {}), { message: 'A direct reply.' });
});

test('turns malformed event data into a friendly retry error', async () => {
  const response = streamResponse('data: {not-json}\n\n');

  await assert.rejects(
    readCoachResponse(response, () => {}),
    { message: 'The coach reply was incomplete. Your workout was not changed. Please try again.' },
  );
});

test('does not show internal parser details sent in an error event', async () => {
  const response = streamResponse(event({
    type: 'error',
    message: `SyntaxError: Unexpected token 'd', "data: {\\"type\\"..." is not valid JSON`,
  }));

  await assert.rejects(
    readCoachResponse(response, () => {}),
    { message: 'The coach reply was incomplete. Your workout was not changed. Please try again.' },
  );
});

test('keeps a concise actionable server error for the user', async () => {
  const response = streamResponse(event({ type: 'error', message: 'Please shorten your request.' }));

  await assert.rejects(readCoachResponse(response, () => {}), { message: 'Please shorten your request.' });
});

test('explains when the stream ends before a complete reply arrives', async () => {
  const response = streamResponse(event({ type: 'delta', text: 'A partial answer' }));

  await assert.rejects(
    readCoachResponse(response, () => {}),
    { message: 'The coach reply ended before it was complete. Please try again.' },
  );
});

test('does not expose JSON parser errors for unreadable non-stream responses', async () => {
  const response = streamResponse('not a JSON response', 'application/json');

  await assert.rejects(
    readCoachResponse(response, () => {}),
    { message: 'The coach reply could not be read. Your workout was not changed. Please try again.' },
  );
});

test('preserves a useful server error returned for a rejected prompt', async () => {
  const response = new Response(JSON.stringify({ error: 'Please shorten this request.' }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });

  await assert.rejects(readCoachResponse(response, () => {}), { message: 'Please shorten this request.' });
});

test('replaces low-level network failures with a retryable message', async () => {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(event({ type: 'delta', text: 'Starting…' })));
      controller.error(new Error('socket closed'));
    },
  });
  const response = new Response(body, { headers: { 'Content-Type': 'text/event-stream' } });

  await assert.rejects(
    readCoachResponse(response, () => {}),
    { message: 'The coach connection was interrupted. Your message is still here—please try again.' },
  );
});
