export const ALPACA_SETUP_STEPS = [
  {
    step: 1,
    title: 'Create your Alpaca account',
    body: "Sign up at Alpaca Markets. It's free and takes a few minutes. Choose paper trading so you practice with simulated money before going live.",
    link: { href: 'https://app.alpaca.markets/signup', label: 'Create Alpaca account' },
  },
  {
    step: 2,
    title: 'Open Paper Trading',
    body: 'After signing in, switch to Paper Trading in the Alpaca dashboard. This gives you a sandbox account with virtual funds. No real money at risk.',
    link: { href: 'https://app.alpaca.markets/paper/dashboard/overview', label: 'Open paper dashboard' },
  },
  {
    step: 3,
    title: 'Generate API keys',
    body: 'Go to Paper Trading → API Keys → Generate new key. Copy both the Key ID and Secret Key immediately. The secret is only shown once.',
    link: { href: 'https://app.alpaca.markets/paper/dashboard/overview', label: 'Generate keys in Alpaca' },
  },
  {
    step: 4,
    title: 'Paste keys below',
    body: 'Paste your Key ID and Secret Key into the fields below. Keep “Paper trading” checked, then connect. Keys are encrypted and never exposed to the browser after saving.',
  },
] as const;
