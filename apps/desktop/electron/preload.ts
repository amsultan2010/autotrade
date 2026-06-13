/**
 * Preload bridge. Exposes only a tiny, explicit API to the renderer — no Node,
 * no ipcRenderer surface. The renderer can manage its refresh token and open
 * external links, nothing else.
 */
import { contextBridge, ipcRenderer } from 'electron';

const api = {
  getRefreshToken: (): Promise<string | null> => ipcRenderer.invoke('token:get'),
  setRefreshToken: (token: string): Promise<boolean> => ipcRenderer.invoke('token:set', token),
  clearRefreshToken: (): Promise<boolean> => ipcRenderer.invoke('token:clear'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('open-external', url),
};

contextBridge.exposeInMainWorld('alphabot', api);

export type AlphabotBridge = typeof api;
