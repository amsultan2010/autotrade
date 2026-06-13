export {};

interface AlphabotBridge {
  getRefreshToken(): Promise<string | null>;
  setRefreshToken(token: string): Promise<boolean>;
  clearRefreshToken(): Promise<boolean>;
  openExternal(url: string): Promise<void>;
}

declare global {
  interface Window {
    alphabot: AlphabotBridge;
  }
}
