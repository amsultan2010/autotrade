'use client';

import { useState } from 'react';
import { useAction } from 'convex/react';
import { api as convexApi } from '@/convex/_generated/api';
import { ErrorCodes } from '@autotrade/shared';
import { formatUserError, reportTrackedError } from '@/lib/error-tracking';

export function useAlpacaConnect(onError?: (msg: string) => void) {
  const connectBroker = useAction(convexApi.brokerCredentialActions.connect);
  const disconnectBroker = useAction(convexApi.brokerCredentialActions.disconnect);
  const syncBroker = useAction(convexApi.brokerSyncActions.sync);

  const [keyId, setKeyId] = useState('');
  const [secret, setSecret] = useState('');
  const [paper, setPaper] = useState(true);
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
      await connectBroker({ keyId, secret, paper });
      setKeyId('');
      setSecret('');
      await syncBroker({});
      return true;
    } catch (err) {
      reportTrackedError(ErrorCodes.BROKER, err, { route: 'alpaca-connect', action: 'connectBroker' });
      onError?.(formatUserError(err, 'Could not connect — check your keys and try again.'));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setConfirming(false);
    setLoading(true);
    try {
      await disconnectBroker({});
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
    paper,
    setPaper,
    loading,
    confirming,
    setConfirming,
    connect,
    disconnect,
  };
}
