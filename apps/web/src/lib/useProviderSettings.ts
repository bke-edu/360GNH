import { useCallback, useEffect, useState } from 'react';
import { studioApi } from './api.js';
import { localizedError } from './i18n.js';
import type { Locale } from './i18n.js';
import type { ProviderSettingsStatus } from './types.js';

const SETUP_DISMISSED_KEY = '360gnh-setup-dismissed';

export type ProviderNotice =
  'openai_saved' | 'openai_deleted' | 'supadata_saved' | 'supadata_deleted';

export interface OpenAISettingsDraft {
  apiKey: string;
  model: 'gpt-5.6-luna' | 'gpt-5.6-terra' | 'gpt-5.6' | 'gpt-5.6-sol';
  budgetUsd: number;
  ttsModel: 'gpt-4o-mini-tts' | 'tts-1' | 'tts-1-hd';
}

export function useProviderSettings(locale: Locale, onChanged: () => Promise<void>) {
  const [status, setStatus] = useState<ProviderSettingsStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ProviderNotice | null>(null);

  const load = useCallback(async () => {
    try {
      const nextStatus = await studioApi.providerSettings();
      setError(null);
      setStatus(nextStatus);
      let dismissed = false;
      try {
        dismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === 'yes';
      } catch {
        // A storage-blocked browser can still configure providers for this page view.
      }
      if (nextStatus.setupRecommended && !dismissed) setOpen(true);
    } catch (reason) {
      setError(localizedError(reason, locale));
    }
  }, [locale]);

  useEffect(() => {
    let active = true;
    void studioApi
      .providerSettings()
      .then((nextStatus) => {
        if (!active) return;
        setError(null);
        setStatus(nextStatus);
        let dismissed = false;
        try {
          dismissed = localStorage.getItem(SETUP_DISMISSED_KEY) === 'yes';
        } catch {
          // A storage-blocked browser can still configure providers for this page view.
        }
        if (nextStatus.setupRecommended && !dismissed) setOpen(true);
      })
      .catch((reason: unknown) => {
        if (active) setError(localizedError(reason, locale));
      });
    return () => {
      active = false;
    };
  }, [locale]);

  const openPanel = useCallback(() => {
    setError(null);
    setNotice(null);
    setOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    if (status?.setupRecommended) {
      try {
        localStorage.setItem(SETUP_DISMISSED_KEY, 'yes');
      } catch {
        // Dismissal persistence is optional; provider keys never use browser storage.
      }
    }
    setOpen(false);
  }, [status?.setupRecommended]);

  const runMutation = useCallback(
    async (
      operation: () => Promise<ProviderSettingsStatus>,
      nextNotice: ProviderNotice,
    ): Promise<boolean> => {
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const nextStatus = await operation();
        setStatus(nextStatus);
        setNotice(nextNotice);
        await onChanged();
        return true;
      } catch (reason) {
        setError(localizedError(reason, locale));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [locale, onChanged],
  );

  const saveOpenAI = useCallback(
    (draft: OpenAISettingsDraft) => runMutation(() => studioApi.saveOpenAI(draft), 'openai_saved'),
    [runMutation],
  );
  const deleteOpenAI = useCallback(
    () => runMutation(studioApi.deleteOpenAI, 'openai_deleted'),
    [runMutation],
  );
  const saveSupadata = useCallback(
    (apiKey: string) => runMutation(() => studioApi.saveSupadata({ apiKey }), 'supadata_saved'),
    [runMutation],
  );
  const deleteSupadata = useCallback(
    () => runMutation(studioApi.deleteSupadata, 'supadata_deleted'),
    [runMutation],
  );

  return {
    status,
    open,
    busy,
    error,
    notice,
    openPanel,
    closePanel,
    reload: load,
    saveOpenAI,
    deleteOpenAI,
    saveSupadata,
    deleteSupadata,
  };
}
