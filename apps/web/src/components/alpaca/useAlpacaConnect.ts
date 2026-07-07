'use client';

import { useState } from 'react';
import { dataApi } from '@/src/hooks/data';
import { ErrorCodes } from '@autotrade/shared';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';

export function useAlpacaConnect(paper: boolean, onError?: (msg: string) => void) {
    const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function connect() {
    if (!keyId || !secret) {
      onError?.('Enter both Key ID and Secret Key.');
      return false;
    }
    setLoading(true);
    onError?.('');
    try {
      await dataApi.connectBroker(keyId, secret, paper);
      setKeyId('');
      setSecret('');
      await dataApi.syncBroker();
      return true;
    } catch (err) {
      reportTrackedError(ErrorCodes.BROKER, err, { route: 'alpaca-connect', action: 'connectBroker' });
      onError?.(formatUserError(err, 'Could not connect. Check your keys and try again.'));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setConfirming(false);
    setLoading(true);
    try {
      await dataApi.disconnectBroker(paper);
    } catch (err) {
      reportTrackedError(ErrorCodes.BROKER, err, { route: 'alpaca-connect', action: 'disconnectBroker' });
      onError?.(formatUserError(err, 'Could not disconnect. Try again.'));
    } finally {
      setLoading(false);
    }
  }

  return {
    keyId,
    setKeyId,
    secret,
    setSecret,
    loading,
    confirming,
    setConfirming,
    connect,
    disconnect,
  };
}
