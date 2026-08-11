import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { studioApi } from './api.js';
import type { StudioMode, StudioSnapshot } from './types.js';
import type { TranscriptTargetLanguage } from './api.js';

const INITIAL_QUERY = 'Nhớ chủ động và ôn cách quãng phối hợp ra sao?';

const initialSnapshot: StudioSnapshot = {
  meta: null,
  sources: [],
  activeSourceId: null,
  mode: 'chat',
  query: INITIAL_QUERY,
  busy: true,
  error: null,
  citations: [],
  answer: null,
  mindmap: null,
  quiz: null,
  quizGrade: null,
  guide: null,
  clips: [],
  debate: null,
};

export function useStudio() {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void (async () => {
      try {
        const [meta, currentSources] = await Promise.all([
          studioApi.meta(),
          studioApi.listSources(),
        ]);
        const sources = currentSources.length > 0 ? currentSources : [await studioApi.seedDemo()];
        setSnapshot((current) => ({
          ...current,
          meta,
          sources,
          activeSourceId: sources[0]?.id ?? null,
          busy: false,
        }));
      } catch (error) {
        setSnapshot((current) => ({ ...current, busy: false, error: messageOf(error) }));
      }
    })();
  }, []);

  const activeSource = useMemo(
    () => snapshot.sources.find((source) => source.id === snapshot.activeSourceId) ?? null,
    [snapshot.activeSourceId, snapshot.sources],
  );

  const setMode = useCallback((mode: StudioMode) => {
    setSnapshot((current) => ({ ...current, mode, error: null }));
  }, []);

  const setQuery = useCallback((query: string) => {
    setSnapshot((current) => ({ ...current, query }));
  }, []);

  const selectSource = useCallback((activeSourceId: string) => {
    setSnapshot((current) => ({ ...current, activeSourceId, error: null }));
  }, []);

  const addSource = useCallback(
    async (input: { title: string; text: string; sourceUrl?: string }) => {
      setSnapshot((current) => ({ ...current, busy: true, error: null }));
      try {
        const source = await studioApi.addSource(input);
        setSnapshot((current) => ({
          ...current,
          busy: false,
          sources: [source, ...current.sources],
          activeSourceId: source.id,
        }));
        return true;
      } catch (error) {
        setSnapshot((current) => ({ ...current, busy: false, error: messageOf(error) }));
        return false;
      }
    },
    [],
  );

  const importYouTube = useCallback(async (input: { url: string; language?: 'vi' | 'en' }) => {
    setSnapshot((current) => ({ ...current, busy: true, error: null }));
    try {
      const source = await studioApi.importYouTube(input);
      setSnapshot((current) => ({
        ...current,
        busy: false,
        sources: [source, ...current.sources.filter((item) => item.id !== source.id)],
        activeSourceId: source.id,
        mode: 'editor',
      }));
      return true;
    } catch (error) {
      setSnapshot((current) => ({ ...current, busy: false, error: messageOf(error) }));
      return false;
    }
  }, []);

  const editSource = useCallback(
    async (sourceId: string, targetLanguage: TranscriptTargetLanguage) => {
      setSnapshot((current) => ({ ...current, busy: true, error: null }));
      try {
        const source = await studioApi.editSource(sourceId, targetLanguage);
        setSnapshot((current) => ({
          ...current,
          busy: false,
          sources: current.sources.map((item) => (item.id === source.id ? source : item)),
          activeSourceId: source.id,
        }));
        return true;
      } catch (error) {
        setSnapshot((current) => ({ ...current, busy: false, error: messageOf(error) }));
        return false;
      }
    },
    [],
  );

  const run = useCallback(
    async (agentIds?: string[]) => {
      const sourceIds = snapshot.activeSourceId ? [snapshot.activeSourceId] : [];
      if (sourceIds.length === 0) {
        setSnapshot((current) => ({ ...current, error: 'Hãy chọn một nguồn trước.' }));
        return;
      }
      setSnapshot((current) => ({ ...current, busy: true, error: null }));
      try {
        switch (snapshot.mode) {
          case 'chat': {
            const answer = await studioApi.answer(snapshot.query, sourceIds);
            setSnapshot((current) => ({
              ...current,
              answer,
              citations: answer.citations,
              busy: false,
            }));
            break;
          }
          case 'mindmap': {
            const mindmap = await studioApi.mindmap(snapshot.query, sourceIds);
            setSnapshot((current) => ({
              ...current,
              mindmap,
              citations: mindmap.citations,
              busy: false,
            }));
            break;
          }
          case 'quiz': {
            const quiz = await studioApi.quiz(snapshot.query, sourceIds);
            setSnapshot((current) => ({ ...current, quiz, quizGrade: null, busy: false }));
            break;
          }
          case 'guide': {
            const guide = await studioApi.studyGuide(snapshot.query, sourceIds);
            setSnapshot((current) => ({
              ...current,
              guide,
              citations: guide.citations,
              busy: false,
            }));
            break;
          }
          case 'clips': {
            const clips = await studioApi.clips(snapshot.query, sourceIds);
            setSnapshot((current) => ({ ...current, clips, busy: false }));
            break;
          }
          case 'agora': {
            const defaultIds =
              snapshot.meta?.debateAgents.slice(0, 3).map((agent) => agent.id) ?? [];
            const debate = await studioApi.debate(
              snapshot.query,
              sourceIds,
              agentIds ?? defaultIds,
            );
            const citations = debate.messages.flatMap((message) => message.citations);
            setSnapshot((current) => ({ ...current, debate, citations, busy: false }));
            break;
          }
        }
      } catch (error) {
        setSnapshot((current) => ({ ...current, busy: false, error: messageOf(error) }));
      }
    },
    [snapshot.activeSourceId, snapshot.meta?.debateAgents, snapshot.mode, snapshot.query],
  );

  const grade = useCallback(
    async (answers: Record<string, string>) => {
      if (!snapshot.quiz) return;
      setSnapshot((current) => ({ ...current, busy: true, error: null }));
      try {
        const quizGrade = await studioApi.gradeQuiz(snapshot.quiz.id, answers);
        setSnapshot((current) => ({ ...current, quizGrade, busy: false }));
      } catch (error) {
        setSnapshot((current) => ({ ...current, busy: false, error: messageOf(error) }));
      }
    },
    [snapshot.quiz],
  );

  const clearError = useCallback(() => {
    setSnapshot((current) => ({ ...current, error: null }));
  }, []);

  return {
    snapshot,
    activeSource,
    setMode,
    setQuery,
    selectSource,
    addSource,
    importYouTube,
    editSource,
    run,
    grade,
    clearError,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Có lỗi không xác định.';
}
