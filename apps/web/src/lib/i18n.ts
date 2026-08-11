import { createContext, useContext } from 'react';
import { ApiError } from './api.js';

export type Locale = 'vi' | 'en';

export const LOCALE_STORAGE_KEY = '360gnh-locale';

export const PAGE_COPY: Record<Locale, { title: string; description: string }> = {
  vi: {
    title: '360GNH · Xưởng tri thức',
    description:
      '360GNH biến nguồn dài thành câu trả lời có trích dẫn, bản đồ, bài kiểm tra, sách nói và tranh luận nhiều góc nhìn.',
  },
  en: {
    title: '360GNH · Knowledge Studio',
    description:
      '360GNH turns long sources into cited answers, mind maps, quizzes, audiobooks, and multi-perspective debates.',
  },
};

const DEFAULT_QUERIES: Record<Locale, string> = {
  vi: 'Nhớ chủ động và ôn cách quãng phối hợp ra sao?',
  en: 'How do active recall and spaced practice work together?',
};

const ERROR_COPY: Record<string, Record<Locale, string>> = {
  FEATURE_UNAVAILABLE: {
    vi: 'Tính năng này chưa được cấu hình trên máy chủ.',
    en: 'This feature is not configured on the server.',
  },
  TRANSCRIPT_UNAVAILABLE: {
    vi: 'Video này không có phụ đề công khai để nhập.',
    en: 'This video has no public transcript available to import.',
  },
  TRANSCRIPT_PROVIDER_ERROR: {
    vi: 'Dịch vụ lấy phụ đề đang bận hoặc phản hồi sai. Hãy thử lại sau.',
    en: 'The transcript service is unavailable or returned an invalid response. Try again later.',
  },
  SPEECH_MODEL_UNAVAILABLE: {
    vi: 'Khóa máy chủ chưa được cấp quyền cho mô hình giọng đọc đã chọn.',
    en: 'The server key does not have access to the selected speech model.',
  },
  SPEECH_PROVIDER_ERROR: {
    vi: 'Dịch vụ giọng đọc đang bận hoặc trả về dữ liệu không hợp lệ.',
    en: 'The speech service is unavailable or returned invalid audio.',
  },
  SOURCE_NOT_FOUND: {
    vi: 'Nguồn không còn tồn tại.',
    en: 'The source is no longer available.',
  },
  QUIZ_NOT_FOUND: {
    vi: 'Bài kiểm tra không còn tồn tại hoặc đã hết hạn.',
    en: 'The quiz was not found or has expired.',
  },
  UNKNOWN_AGENT: {
    vi: 'Có góc nhìn tranh luận không hợp lệ.',
    en: 'An unknown debate perspective was selected.',
  },
  VALIDATION_ERROR: {
    vi: 'Dữ liệu gửi lên chưa hợp lệ.',
    en: 'The submitted data is invalid.',
  },
  INVALID_JSON: {
    vi: 'Dữ liệu gửi lên không phải JSON hợp lệ.',
    en: 'The request body is not valid JSON.',
  },
  UNAUTHORIZED: {
    vi: 'Cần mã truy cập máy chủ hợp lệ.',
    en: 'A valid server access token is required.',
  },
  NOT_FOUND: {
    vi: 'Không tìm thấy đường dẫn yêu cầu.',
    en: 'The requested route was not found.',
  },
  INTERNAL_ERROR: {
    vi: 'Máy chủ gặp lỗi ngoài dự kiến.',
    en: 'The server encountered an unexpected error.',
  },
};

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  pick: (vietnamese: string, english: string) => string;
}

export const I18nContext = createContext<I18nContextValue>({
  locale: 'vi',
  setLocale: () => undefined,
  pick: (vietnamese) => vietnamese,
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function defaultQuery(locale: Locale): string {
  return DEFAULT_QUERIES[locale];
}

export function localizedError(error: unknown, locale: Locale, fallback?: string): string {
  if (error instanceof ApiError && error.code) {
    const known = ERROR_COPY[error.code];
    if (known) return known[locale];
  }
  if (error instanceof Error && error.message) {
    if (locale === 'vi' || isAscii(error.message)) return error.message;
  }
  return fallback ?? (locale === 'vi' ? 'Có lỗi không xác định.' : 'Something went wrong.');
}

export function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === 'vi' || stored === 'en') return stored;
  } catch {
    // Fall through to browser language detection.
  }
  const languages =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  return languages.some((language) => language.toLowerCase().startsWith('vi')) ? 'vi' : 'en';
}

function isAscii(value: string): boolean {
  return [...value].every((character) => (character.codePointAt(0) ?? 128) <= 127);
}
