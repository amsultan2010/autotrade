/**
 * Unit tests for AlpacaBroker — uses mocked fetch (no real API keys required).
 */
import { describe, it, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AlpacaBroker, verifyAlpacaCredentials } from './alpaca.broker.ts';

const PAPER_BASE = 'https://paper-api.alpaca.markets';

describe('AlpacaBroker', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it('routes to paper trading base URL', async () => {
    const calls: string[] = [];
    globalThis.fetch = mock.fn(async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ cash: '10000', equity: '10000', buying_power: '20000' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }) as typeof fetch;

    const broker = new AlpacaBroker({ keyId: 'key', secret: 'secret', paper: true });
    assert.equal(broker.mode, 'paper');
    const account = await broker.getAccount();
    assert.equal(account.equity, 10000);
    assert.ok(calls[0]?.startsWith(PAPER_BASE));
  });

  it('routes to live trading base URL', async () => {
    const calls: string[] = [];
    globalThis.fetch = mock.fn(async (input: string | URL | Request) => {
      calls.push(String(input));
      return new Response(JSON.stringify({ cash: '5000', equity: '5000', buying_power: '10000' }), {
        status: 200,
      });
    }) as typeof fetch;

    const broker = new AlpacaBroker({ keyId: 'key', secret: 'secret', paper: false });
    assert.equal(broker.mode, 'live');
    await broker.getAccount();
    assert.ok(calls[0]?.startsWith('https://api.alpaca.markets'));
  });

  it('polls for market order fill when initially accepted', async () => {
    let orderPolls = 0;
    globalThis.fetch = mock.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v2/orders') && init?.method === 'POST') {
        return new Response(JSON.stringify({ id: 'ord-1', status: 'accepted' }), { status: 200 });
      }
      if (url.includes('/v2/orders/ord-1')) {
        orderPolls += 1;
        const status = orderPolls >= 2 ? 'filled' : 'accepted';
        return new Response(
          JSON.stringify({
            id: 'ord-1',
            status,
            filled_avg_price: status === 'filled' ? '150.25' : undefined,
            filled_qty: status === 'filled' ? '10' : undefined,
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const broker = new AlpacaBroker({ keyId: 'key', secret: 'secret', paper: true });
    const result = await broker.submitOrder({
      symbol: 'AAPL',
      side: 'LONG',
      qty: 10,
      type: 'market',
      clientOrderId: 'test-1',
    });
    assert.equal(result.status, 'filled');
    assert.equal(result.filledPrice, 150.25);
    assert.ok(orderPolls >= 2);
  });

  it('submits bracket order when stop and target provided', async () => {
    let postedBody = '';
    globalThis.fetch = mock.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/v2/orders') && init?.method === 'POST') {
        postedBody = String(init.body);
        return new Response(JSON.stringify({ id: 'ord-2', status: 'filled', filled_avg_price: '100', filled_qty: '1' }), {
          status: 200,
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    }) as typeof fetch;

    const broker = new AlpacaBroker({ keyId: 'key', secret: 'secret', paper: true });
    await broker.submitOrder({
      symbol: 'AAPL',
      side: 'LONG',
      qty: 1,
      type: 'market',
      stopLoss: 95,
      takeProfit: 110,
      clientOrderId: 'test-2',
    });
    const body = JSON.parse(postedBody) as Record<string, unknown>;
    assert.equal(body.order_class, 'bracket');
    assert.deepEqual(body.stop_loss, { stop_price: 95 });
    assert.deepEqual(body.take_profit, { limit_price: 110 });
  });
});

describe('verifyAlpacaCredentials', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    mock.restoreAll();
  });

  it('returns ok for valid credentials', async () => {
    globalThis.fetch = mock.fn(async () => new Response('{}', { status: 200 })) as typeof fetch;
    const result = await verifyAlpacaCredentials(' key ', ' secret ', true);
    assert.equal(result.ok, true);
  });

  it('returns error for unauthorized credentials', async () => {
    globalThis.fetch = mock.fn(async () => new Response('{}', { status: 401 })) as typeof fetch;
    const result = await verifyAlpacaCredentials('bad', 'bad', true);
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /Invalid API keys/);
  });
});
