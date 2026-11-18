import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import StickyNote2Outlined from '@mui/icons-material/StickyNote2Outlined';
import MenuBookOutlined from '@mui/icons-material/MenuBookOutlined';
import VolumeUpRounded from '@mui/icons-material/VolumeUpRounded';
import CloseRounded from '@mui/icons-material/CloseRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { ROUTES } from '../../../shared/constants/routes';
import { AuthContext } from '../../auth/context/AuthContext';
import usePro from '../../pro/hooks/usePro';
import { toeicApi } from '../api/toeicApi';
import { lookupDictionaryTerm, normalizeLookupTerm, speakEnglishText } from '../utils/dictionaryClient';
import '../styles/notes-dictionary.css';

const NOTE_COLORS = [
  { id: 'yellow', label: 'Vàng' },
  { id: 'blue', label: 'Xanh dương' },
  { id: 'green', label: 'Xanh lá' },
  { id: 'pink', label: 'Hồng' },
];

const FREE_LIMIT = 100;

function clampPopoverPosition(rect) {
  const vw = globalThis.window?.innerWidth || 1280;
  const vh = globalThis.window?.innerHeight || 800;
  const width = Math.min(390, vw - 24);
  const rawLeft = rect ? rect.left + rect.width / 2 - width / 2 : vw / 2 - width / 2;
  const left = Math.max(12, Math.min(rawLeft, vw - width - 12));
  const rawTop = rect ? rect.bottom + 10 : 120;
  const top =
    rawTop + 310 > vh && rect ? Math.max(16, rect.top - 295) : Math.max(16, Math.min(rawTop, vh - 260));
  return { top, left };
}

function getSelectionAnchorRect() {
  const selection = globalThis.window?.getSelection?.();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;
  try {
    const rect = selection.getRangeAt(0).getBoundingClientRect();
    if (!rect || (rect.width === 0 && rect.height === 0)) return null;
    return rect;
  } catch {
    return null;
  }
}

export default function StudyTextAssistant({
  children,
  allowNotes = false,
  examId = null,
  attemptId = null,
  questionNumber = null,
  part = null,
  showToolbar = true,
}) {
  useLocale();
  const auth = useContext(AuthContext);
  const user = auth?.user ?? null;
  const { membership } = usePro();
  const containerRef = useRef(null);
  const popoverRef = useRef(null);
  const lastDoubleClickAt = useRef(0);
  const toastTimer = useRef(null);

  const [quota, setQuota] = useState({
    count: 0,
    limit: membership?.active ? null : FREE_LIMIT,
    isPro: Boolean(membership?.active),
  });
  const [popover, setPopover] = useState(null);
  const [noteColor, setNoteColor] = useState('yellow');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [noteError, setNoteError] = useState('');
  const [toast, setToast] = useState('');

  const [dictInput, setDictInput] = useState('');
  const [dictLoading, setDictLoading] = useState(false);
  const [dictEntry, setDictEntry] = useState(null);

  const refreshQuota = useCallback(() => {
    if (!allowNotes || !user?.id) return;
    toeicApi
      .notes()
      .then(response => {
        if (response?.data) {
          setQuota({
            count: response.data.count ?? 0,
            limit: response.data.limit ?? (response.data.isPro ? null : FREE_LIMIT),
            isPro: Boolean(response.data.isPro),
          });
        }
      })
      .catch(() => {});
  }, [allowNotes, user?.id]);

  useEffect(() => {
    refreshQuota();
  }, [refreshQuota]);

  useEffect(() => {
    return () => globalThis.clearTimeout(toastTimer.current);
  }, []);

  useEffect(() => {
    if (!popover) return undefined;
    function onPointerDown(event) {
      if (popoverRef.current?.contains(event.target)) return;
      if (event.target.closest?.('.study-tool-btn')) return;
      setPopover(null);
      setNoteError('');
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setPopover(null);
        setNoteError('');
      }
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [popover]);

  const runDictionaryLookup = useCallback(async term => {
    const normalized = normalizeLookupTerm(term);
    setDictInput(normalized);
    if (!normalized) {
      setDictEntry(null);
      return;
    }
    setDictLoading(true);
    try {
      const result = await lookupDictionaryTerm(normalized);
      setDictEntry(result);
    } finally {
      setDictLoading(false);
    }
  }, []);

  function openDictionary(term, rect = null) {
    const position = clampPopoverPosition(rect);
    setPopover({
      mode: 'dictionary',
      selectedText: normalizeLookupTerm(term),
      position,
    });
    void runDictionaryLookup(term);
  }

  function openNoteDialog(selectedText, rect = null, initialNote = '') {
    if (!allowNotes || !examId) return;
    const cleaned = String(selectedText ?? '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    if (!cleaned) return;
    setNoteContent(initialNote);
    setNoteError('');
    setPopover({
      mode: 'note',
      selectedText: cleaned,
      position: clampPopoverPosition(rect),
    });
  }

  function handleDoubleClick(event) {
    if (event.target.closest?.('input, textarea, select, button, a, .study-floating-popover')) return;
    lastDoubleClickAt.current = Date.now();
    const raw = globalThis.window?.getSelection?.()?.toString?.() ?? '';
    const word = normalizeLookupTerm(raw);
    if (!word || word.length > 45) return;
    openDictionary(word, getSelectionAnchorRect());
  }

  function handleMouseUp(event) {
    if (event.target.closest?.('input, textarea, select, button, a, .study-floating-popover')) return;
    // Double-click (detail >= 2) is reserved strictly for Dictionary Lookup so the two gestures never conflict
    if (event.detail >= 2 || Date.now() - lastDoubleClickAt.current < 360) return;

    const raw = globalThis.window?.getSelection?.()?.toString?.() ?? '';
    const cleaned = raw.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;

    if (event.altKey) {
      openDictionary(cleaned, getSelectionAnchorRect());
      return;
    }

    // Highlighting text ("tô đen") opens Note creation ONLY in TOEIC mode
    if (!allowNotes || !examId) return;
    openNoteDialog(cleaned, getSelectionAnchorRect());
  }

  async function submitNote(event) {
    event?.preventDefault?.();
    if (!popover?.selectedText || !allowNotes || !examId || savingNote) return;
    setSavingNote(true);
    setNoteError('');
    try {
      const response = await toeicApi.createNote({
        examId: Number(examId),
        attemptId: attemptId != null ? Number(attemptId) : null,
        questionNumber: questionNumber != null ? Number(questionNumber) : null,
        part: part != null ? Number(part) : null,
        selectedText: popover.selectedText,
        noteContent,
        color: noteColor,
      });
      if (response?.data) {
        setQuota({
          count: response.data.count ?? quota.count + 1,
          limit: response.data.limit ?? quota.limit,
          isPro: Boolean(response.data.isPro),
        });
      }
      setPopover(null);
      setNoteContent('');
      globalThis.window?.getSelection?.()?.removeAllRanges?.();
      setToast(t('Đã lưu vào Ghi chú của tôi!'));
      globalThis.clearTimeout(toastTimer.current);
      toastTimer.current = globalThis.setTimeout(() => setToast(''), 3200);
    } catch (failure) {
      setNoteError(
        failure?.code === 'NOTE_LIMIT_REACHED'
          ? t('Gói Miễn phí chỉ lưu tối đa 100 ghi chú. Hãy nâng cấp Pro hoặc xóa bớt ghi chú cũ.')
          : failure?.message || t('Không thể lưu ghi chú. Vui lòng thử lại.'),
      );
      if (failure?.code === 'NOTE_LIMIT_REACHED') {
        setQuota(previous => ({ ...previous, count: Math.max(previous.count, FREE_LIMIT) }));
      }
    } finally {
      setSavingNote(false);
    }
  }

  const isPro = Boolean(quota.isPro || membership?.active);
  const limitReached = !isPro && quota.count >= (quota.limit ?? FREE_LIMIT);

  return (
    <div
      ref={containerRef}
      className="study-assistant-surface"
      onDoubleClick={handleDoubleClick}
      onMouseUp={handleMouseUp}
    >
      {showToolbar && (
        <div className="study-assistant-toolbar">
          <p className="study-assistant-hint">
            {allowNotes ? (
              <>
                <strong>{t('Thao tác nhanh:')}</strong>
                <span>
                  {t('Kéo chuột tô đen từ/cụm từ để Thêm ghi chú · Nhấp đúp chuột vào từ để Tra từ điển')}
                </span>
              </>
            ) : (
              <>
                <strong>{t('Tra từ nhanh:')}</strong>
                <span>{t('Nhấp đúp chuột vào từ tiếng Anh bất kỳ để xem nghĩa và phát âm')}</span>
              </>
            )}
          </p>
          <div className="study-assistant-actions">
            <button
              type="button"
              className="study-tool-btn"
              onClick={event => openDictionary('', event.currentTarget.getBoundingClientRect())}
            >
              <MenuBookOutlined fontSize="small" />
              {t('Tra từ điển')}
            </button>
            {allowNotes && user && (
              <Link className="study-tool-btn" to={ROUTES.MY_NOTES}>
                <StickyNote2Outlined fontSize="small" />
                {t('Ghi chú của tôi')}
                <span className="study-tool-badge">
                  {isPro ? quota.count : `${quota.count}/${quota.limit ?? FREE_LIMIT}`}
                </span>
              </Link>
            )}
          </div>
        </div>
      )}

      {children}

      {popover?.mode === 'note' && (
        <div
          ref={popoverRef}
          className="study-floating-popover"
          role="dialog"
          aria-label={t('Thêm ghi chú TOEIC')}
          style={{ top: `${popover.position.top}px`, left: `${popover.position.left}px` }}
        >
          <div className="study-popover-head">
            <span className="study-popover-title">
              <StickyNote2Outlined fontSize="small" />
              {t('Thêm ghi chú')}
            </span>
            <div className="study-popover-head-actions">
              <span className={`study-quota-pill ${isPro ? 'is-pro' : limitReached ? 'is-full' : ''}`}>
                {isPro ? t('PRO · Không giới hạn') : `${quota.count}/${quota.limit ?? FREE_LIMIT}`}
              </span>
              <button
                type="button"
                className="study-switch-btn"
                onClick={() => openDictionary(popover.selectedText, popover.position)}
              >
                {t('Tra từ')}
              </button>
              <button
                type="button"
                className="study-close-btn"
                aria-label={t('Đóng')}
                onClick={() => setPopover(null)}
              >
                <CloseRounded fontSize="small" />
              </button>
            </div>
          </div>

          <div className={`study-selected-quote color-${noteColor}`}>“{popover.selectedText}”</div>

          {limitReached ? (
            <div className="study-limit-box" role="alert">
              <strong>{t('Đã đạt giới hạn 100/100 ghi chú của gói Miễn phí.')}</strong>
              <p>{t('Nâng cấp gói Pro để lưu ghi chú không giới hạn hoặc quản lý lại ghi chú cũ.')}</p>
              <div className="study-limit-actions">
                <Link className="toeic-button button-primary" to={ROUTES.PRO}>
                  {t('Mở khóa PRO')}
                </Link>
                <Link className="toeic-button toeic-button-outline" to={ROUTES.MY_NOTES}>
                  {t('Quản lý ghi chú')}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={submitNote}>
              <div className="study-color-row">
                <span>
                  {questionNumber ? `${t('Câu {number}', { number: questionNumber })} · ` : ''}
                  {t('Nhãn màu')}
                </span>
                <div className="study-color-dots" role="radiogroup" aria-label={t('Chọn màu ghi chú')}>
                  {NOTE_COLORS.map(color => (
                    <button
                      key={color.id}
                      type="button"
                      className={`study-color-dot tone-${color.id} ${noteColor === color.id ? 'is-active' : ''}`}
                      aria-label={t(color.label)}
                      aria-pressed={noteColor === color.id}
                      onClick={() => setNoteColor(color.id)}
                    />
                  ))}
                </div>
              </div>

              <textarea
                className="study-note-textarea"
                value={noteContent}
                aria-label={t('Nội dung ghi chú')}
                placeholder={t('Nhập nghĩa, cấu trúc ngữ pháp hoặc mẹo nhớ nhanh...')}
                autoFocus
                onChange={event => setNoteContent(event.target.value)}
                onKeyDown={event => {
                  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                    void submitNote(event);
                  }
                }}
              />

              {noteError && (
                <p className="study-popover-error" role="alert">
                  {noteError}
                </p>
              )}

              <div className="study-popover-footer">
                <button
                  type="button"
                  className="toeic-button toeic-button-outline"
                  onClick={() => setPopover(null)}
                >
                  {t('Hủy')}
                </button>
                <button type="submit" className="toeic-button button-primary" disabled={savingNote}>
                  {savingNote ? t('Đang lưu...') : t('Lưu ghi chú')}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {popover?.mode === 'dictionary' && (
        <div
          ref={popoverRef}
          className="study-floating-popover"
          role="dialog"
          aria-label={t('Tra từ điển tiếng Anh')}
          style={{ top: `${popover.position.top}px`, left: `${popover.position.left}px` }}
        >
          <div className="study-popover-head">
            <span className="study-popover-title">
              <MenuBookOutlined fontSize="small" />
              {t('Từ điển nhanh')}
            </span>
            <div className="study-popover-head-actions">
              {allowNotes && examId && dictEntry?.term && (
                <button
                  type="button"
                  className="study-switch-btn"
                  onClick={() => {
                    const prefill = dictEntry.meanings?.[0]
                      ? `${dictEntry.meanings[0].partOfSpeech}: ${dictEntry.meanings[0].meaningVi}`
                      : dictEntry.englishMeanings?.[0]?.definitionEn || '';
                    openNoteDialog(dictEntry.term, popover.position, prefill);
                  }}
                >
                  <AddRounded fontSize="inherit" /> {t('Ghi chú')}
                </button>
              )}
              <button
                type="button"
                className="study-close-btn"
                aria-label={t('Đóng')}
                onClick={() => setPopover(null)}
              >
                <CloseRounded fontSize="small" />
              </button>
            </div>
          </div>

          <form
            className="dict-search-form"
            onSubmit={event => {
              event.preventDefault();
              void runDictionaryLookup(dictInput);
            }}
          >
            <input
              type="search"
              value={dictInput}
              aria-label={t('Nhập từ tiếng Anh cần tra')}
              placeholder={t('Nhập từ tiếng Anh...')}
              autoFocus={!popover.selectedText}
              onChange={event => setDictInput(event.target.value)}
            />
            <button type="submit">{t('Tra từ')}</button>
          </form>

          {dictLoading ? (
            <p className="dict-empty" role="status">
              {t('Đang tra từ...')}
            </p>
          ) : !dictEntry?.term ? (
            <p className="dict-empty">
              {t('Nhấp đúp chuột vào từ trên bài hoặc nhập từ bất kỳ để xem nghĩa và phát âm.')}
            </p>
          ) : (
            <>
              <div className="dict-word-header">
                <div>
                  <h4>{dictEntry.headword || dictEntry.term}</h4>
                  {dictEntry.phonetic && <span className="dict-phonetic">{dictEntry.phonetic}</span>}
                </div>
                <div className="dict-audio-btns">
                  <button
                    type="button"
                    className="dict-audio-btn"
                    aria-label={t('Phát âm chuẩn Mỹ')}
                    onClick={() =>
                      speakEnglishText(dictEntry.headword || dictEntry.term, 'en-US', dictEntry.audioUrl)
                    }
                  >
                    <VolumeUpRounded fontSize="small" /> US
                  </button>
                  <button
                    type="button"
                    className="dict-audio-btn"
                    aria-label={t('Phát âm chuẩn Anh')}
                    onClick={() => speakEnglishText(dictEntry.headword || dictEntry.term, 'en-GB')}
                  >
                    <VolumeUpRounded fontSize="small" /> UK
                  </button>
                </div>
              </div>

              {dictEntry.found ? (
                <div className="dict-body">
                  {dictEntry.meanings.map((item, idx) => (
                    <div className="dict-meaning-item" key={`${item.partOfSpeech}-${idx}`}>
                      {item.partOfSpeech && <span className="dict-pos-tag">{item.partOfSpeech}</span>}
                      <div className="dict-meaning-vi">{item.meaningVi}</div>
                      {item.exampleEn && (
                        <div className="dict-example">
                          “{item.exampleEn}”{item.exampleVi && <span>→ {item.exampleVi}</span>}
                        </div>
                      )}
                    </div>
                  ))}
                  {dictEntry.englishMeanings.map((item, idx) => (
                    <div className="dict-meaning-item" key={`en-${idx}`}>
                      {item.partOfSpeech && <span className="dict-pos-tag">EN · {item.partOfSpeech}</span>}
                      <div className="dict-meaning-en">{item.definitionEn}</div>
                      {item.exampleEn && <div className="dict-example">“{item.exampleEn}”</div>}
                    </div>
                  ))}
                  {dictEntry.relatedForms?.length > 0 && (
                    <div className="dict-related">
                      <span>{t('Từ liên quan:')}</span>
                      {dictEntry.relatedForms.map(word => (
                        <button key={word} type="button" onClick={() => void runDictionaryLookup(word)}>
                          {word}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="dict-empty">
                  <p>
                    {t(
                      'Chưa tìm thấy nghĩa chi tiết cho từ này. Bạn vẫn có thể nghe phát âm US/UK ở trên hoặc lưu vào ghi chú để ôn tập.',
                    )}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {toast && (
        <div className="study-toast" role="status">
          <StickyNote2Outlined fontSize="small" />
          <span>{toast}</span>
          <Link to={ROUTES.MY_NOTES}>{t('Xem tất cả')}</Link>
        </div>
      )}
    </div>
  );
}
