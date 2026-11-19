import { useCallback, useEffect, useRef, useState } from 'react';
import AddRounded from '@mui/icons-material/AddRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import PublishOutlined from '@mui/icons-material/PublishOutlined';
import FileUploadOutlined from '@mui/icons-material/FileUploadOutlined';
import ErrorState from '../../../shared/components/ErrorState';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import { t } from '../../../shared/i18n/locale';
import useLocale from '../../../shared/i18n/useLocale';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import useAuth from '../../auth/hooks/useAuth';
import { toeicApi } from '../api/toeicApi';
import useLearningResource from '../hooks/useLearningResource';
import ToeicQuestion from '../components/ToeicQuestion';
import ToeicQuestionImportDialog from '../components/ToeicQuestionImportDialog';
import '../styles/toeic.css';

const EMPTY = [];
const LETTERS = ['A', 'B', 'C', 'D'];
let sequence = 0;
const uniqueId = prefix => `${prefix}-${Date.now().toString(36)}-${++sequence}`;
const blankDefinition = () => ({
  slug: '',
  title: '',
  description: '',
  durationMinutes: 75,
  sourceLabel: '',
  lessons: [],
  questions: [],
  published: false,
  version: null,
});
const asForm = data => ({
  ...blankDefinition(),
  ...data,
  lessons: data.lessons ?? [],
  questions: (data.questions ?? []).map(question => ({
    ...question,
    passage: question.passage ?? '',
    imageUrl: question.imageUrl ?? '',
    passageImageUrls: question.passageImageUrls ?? [],
    explanation: question.explanation ?? '',
    source: question.source ?? '',
  })),
});
const payload = form => ({
  slug: form.slug.trim(),
  title: form.title.trim(),
  description: form.description.trim(),
  sourceLabel: form.sourceLabel.trim(),
  durationMinutes: Number(form.durationMinutes),
  version: form.version,
  published: Boolean(form.published),
  lessons: form.lessons.map(lesson => ({ ...lesson, title: lesson.title.trim() })),
  questions: form.questions.map(question => ({
    ...question,
    number: Number(question.number),
    part: Number(question.part),
    prompt: question.prompt.trim(),
    passage: question.passage.trim(),
    imageUrl: question.imageUrl?.trim() || null,
    passageImageUrls: question.passageImageUrls ?? [],
    correctOptionId: question.correctOptionId || 'A',
    explanation: question.explanation.trim(),
    options: question.options.map(option => ({ ...option, text: option.text.trim() })),
  })),
});

export default function AdminToeicPage() {
  useLocale();
  const { user } = useAuth();
  const [form, setForm] = useState(blankDefinition);
  const [editingId, setEditingId] = useState(null);
  const [saved, setSaved] = useState(() => JSON.stringify(blankDefinition()));
  const [questionId, setQuestionId] = useState(null);
  const [questionSearch, setQuestionSearch] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const discardAction = useRef(null);
  const pending = useRef(false);
  const generation = useRef(0);
  const load = useCallback(options => toeicApi.adminList(options), []);
  const { data: exams, loading, error: listError, reload } = useLearningResource(load, EMPTY);
  const dirty = JSON.stringify(form) !== saved;
  const selectedQuestion = form.questions.find(item => item.id === questionId) ?? form.questions[0];

  useEffect(() => {
    const activeGeneration = ++generation.current;
    return () => {
      generation.current = activeGeneration + 1;
      pending.current = false;
    };
  }, [user?.id]);
  useEffect(() => {
    function warn(event) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function apply(data) {
    const next = asForm(data);
    setForm(next);
    setSaved(JSON.stringify(next));
    setEditingId(data.id ?? null);
    setQuestionId(next.questions[0]?.id ?? null);
    setQuestionSearch('');
    setError(null);
    setImportOpen(false);
  }
  async function run(request) {
    if (pending.current) return;
    const captured = generation.current;
    const session = getSessionVersion();
    const isCurrent = () => captured === generation.current && session === getSessionVersion();
    pending.current = true;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      await request(isCurrent);
    } catch (failure) {
      if (isCurrent()) setError(failure);
    } finally {
      if (isCurrent()) {
        pending.current = false;
        setBusy(false);
      }
    }
  }
  function selectExam(id) {
    return run(async isCurrent => {
      const response = await toeicApi.adminDetail(id);
      if (isCurrent()) apply(response.data);
    });
  }
  function whenClean(action) {
    if (!dirty) {
      action();
      return;
    }
    discardAction.current = action;
    setConfirmDiscard(true);
  }
  function updateField(key, value) {
    setForm(previous => ({ ...previous, [key]: value }));
    setMessage('');
  }
  function editQuestion(key, value) {
    if (!selectedQuestion) return;
    setForm(previous => ({
      ...previous,
      questions: previous.questions.map(question =>
        question.id === selectedQuestion.id ? { ...question, [key]: value } : question,
      ),
    }));
    setMessage('');
  }
  function addQuestion() {
    const number = Math.max(100, ...form.questions.map(question => Number(question.number) || 100)) + 1;
    const question = {
      id: uniqueId('q'),
      number,
      part: number <= 130 ? 5 : number <= 146 ? 6 : 7,
      passage: '',
      prompt: '',
      options: LETTERS.map(id => ({ id, text: '' })),
      correctOptionId: 'A',
      explanation: '',
      source: '',
      imageUrl: '',
      passageImageUrls: [],
    };
    updateField('questions', [...form.questions, question]);
    setQuestionId(question.id);
    setQuestionSearch('');
  }
  function importQuestions(questions) {
    if (pending.current) return;
    const imported = questions.map(question => ({ ...question, id: uniqueId('q-import') }));
    setForm(previous => ({ ...previous, questions: [...previous.questions, ...imported] }));
    setQuestionId(imported[0]?.id ?? null);
    setQuestionSearch('');
    setImportOpen(false);
    setError(null);
    setMessage(
      t('Đã thêm {count} câu hỏi vào biểu mẫu. Bấm Lưu bộ đề để lưu thay đổi.', { count: imported.length }),
    );
  }
  function validate() {
    if (!form.title.trim() || !form.slug.trim()) return 'Vui lòng nhập tên và mã bộ đề.';
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim()))
      return 'Mã bộ đề dùng chữ thường, số và dấu gạch ngang.';
    if (
      !Number.isInteger(Number(form.durationMinutes)) ||
      Number(form.durationMinutes) < 1 ||
      Number(form.durationMinutes) > 180
    )
      return 'Thời gian thi phải là số nguyên từ 1 đến 180 phút.';
    const numbers = new Set();
    for (const question of form.questions) {
      if (
        !Number.isInteger(Number(question.number)) ||
        Number(question.number) < 1 ||
        numbers.has(Number(question.number))
      )
        return 'Số câu hỏi phải là số nguyên dương và không trùng nhau.';
      numbers.add(Number(question.number));
      if (
        (!question.prompt.trim() && !question.imageUrl?.trim()) ||
        question.options.some(option => !option.text.trim())
      )
        return t('Câu {number} cần nội dung câu hỏi và đủ bốn lựa chọn A–D.', { number: question.number });
      if (question.imageUrl && !question.imageUrl.startsWith('/toeic-assets/'))
        return 'Hình câu hỏi phải dùng đường dẫn nội bộ /toeic-assets/.';
      if (question.passageImageUrls.some(url => !url.startsWith('/toeic-assets/')))
        return 'Hình đoạn đọc phải dùng đường dẫn nội bộ /toeic-assets/.';
    }
    return null;
  }
  function saveDefinition(event) {
    event.preventDefault();
    const validation = validate();
    if (validation) {
      setError({ message: t(validation) });
      return;
    }
    return run(async isCurrent => {
      const definition = payload(form);
      const response = await (editingId == null
        ? toeicApi.create(definition)
        : toeicApi.update(editingId, definition));
      if (isCurrent()) {
        apply(response.data);
        setMessage(t('Đã lưu nội dung bộ đề.'));
        reload();
      }
    });
  }
  function togglePublished() {
    return run(async isCurrent => {
      const response = await toeicApi.publish(editingId, !form.published);
      if (isCurrent()) {
        apply(response.data);
        setMessage(t(response.data.published ? 'Đã xuất bản bộ đề.' : 'Đã ẩn bộ đề khỏi thư viện.'));
        reload();
      }
    });
  }
  function deleteDefinition() {
    setConfirmDelete(false);
    return run(async isCurrent => {
      await toeicApi.remove(editingId);
      if (isCurrent()) {
        apply(blankDefinition());
        setMessage(t('Đã xóa bộ đề khỏi thư viện. Lịch sử bài làm vẫn được giữ.'));
        reload();
      }
    });
  }
  return (
    <div className="toeic-app toeic-admin-app">
      <header className="toeic-page-heading">
        <div>
          <h1>{t('Quản lý TOEIC Reading')}</h1>
          <p>
            {t(
              'Tạo và quản lý ngân hàng câu hỏi TOEIC Reading trực tiếp. Nội dung đã xuất bản sẽ được đưa vào luồng luyện tập của học viên.',
            )}
          </p>
        </div>
        <button
          type="button"
          className="toeic-button button-primary"
          disabled={busy}
          onClick={() =>
            whenClean(() => {
              apply(blankDefinition());
              setMessage('');
            })
          }
        >
          <AddRounded fontSize="small" />
          {t('Thêm bộ đề')}
        </button>
      </header>
      <div className="toeic-admin-layout">
        <aside className="toeic-admin-list">
          <h2>{t('Bộ đề hiện có')}</h2>
          <input
            type="search"
            className="toeic-admin-search"
            placeholder={t('Tìm bộ đề...')}
            aria-label={t('Tìm bộ đề quản trị')}
            value={listSearch}
            onChange={event => setListSearch(event.target.value)}
          />
          {loading ? (
            <p role="status">{t('Đang tải bộ đề...')}</p>
          ) : listError ? (
            <ErrorState error={listError} onRetry={reload} />
          ) : (
            exams
              .filter(exam => exam.title.toLocaleLowerCase().includes(listSearch.trim().toLocaleLowerCase()))
              .map(exam => (
                <button
                  type="button"
                  key={exam.id}
                  className={String(editingId) === String(exam.id) ? 'is-active' : ''}
                  disabled={busy}
                  onClick={() => whenClean(() => selectExam(exam.id))}
                >
                  <strong>{exam.title}</strong>
                  <span>
                    {t(exam.published ? 'Đã xuất bản' : 'Bản nháp')} ·{' '}
                    {t('{count} câu hỏi', { count: exam.questionCount ?? exam.questions?.length ?? 0 })}
                  </span>
                </button>
              ))
          )}
          {!loading && !listError && !exams.length && (
            <p>{t('Chưa có bộ đề. Chọn Thêm bộ đề để bắt đầu.')}</p>
          )}
        </aside>
        <form className="toeic-admin-editor" onSubmit={saveDefinition}>
          <div className="toeic-admin-editor-heading">
            <h2>{t(editingId == null ? 'Bộ đề mới' : 'Chỉnh sửa bộ đề')}</h2>
            <span className={`toeic-status-badge ${form.published ? 'is-published' : ''}`}>
              {t(form.published ? 'Đã xuất bản' : 'Bản nháp')}
            </span>
          </div>
          {error && <ErrorState error={error} />}
          {message && (
            <p className="toeic-success" role="status">
              {message}
            </p>
          )}
          <fieldset disabled={busy} className="toeic-admin-fields">
            <label>
              {t('Tên bộ đề')}
              <input
                name="title"
                required
                maxLength={255}
                value={form.title}
                onChange={event => updateField('title', event.target.value)}
              />
            </label>
            <div className="toeic-field-pair">
              <label>
                {t('Mã bộ đề (slug)')}
                <input
                  name="slug"
                  required
                  maxLength={120}
                  value={form.slug}
                  placeholder="ets-2024-test-01"
                  onChange={event => updateField('slug', event.target.value)}
                />
              </label>
              <label>
                {t('Thời gian thi (phút)')}
                <input
                  name="durationMinutes"
                  type="number"
                  min="1"
                  max="180"
                  required
                  value={form.durationMinutes}
                  onChange={event => updateField('durationMinutes', event.target.value)}
                />
              </label>
            </div>
            <label>
              {t('Mô tả')}
              <textarea
                name="description"
                rows="2"
                value={form.description}
                onChange={event => updateField('description', event.target.value)}
              />
            </label>
            <label>
              {t('Nguồn nội dung')}
              <input
                name="sourceLabel"
                value={form.sourceLabel}
                onChange={event => updateField('sourceLabel', event.target.value)}
              />
            </label>
          </fieldset>
          <div className="toeic-tabs toeic-admin-tabs">
            <button type="button" className="is-active">
              {t('Ngân hàng câu hỏi')} ({form.questions.length})
            </button>
          </div>
          <section className="toeic-admin-content">
              <div className="toeic-editor-toolbar">
                <input
                  type="search"
                  aria-label={t('Tìm câu hỏi trong bộ đề')}
                  placeholder={t('Tìm số câu hoặc nội dung...')}
                  value={questionSearch}
                  onChange={event => setQuestionSearch(event.target.value)}
                />
                <button
                  type="button"
                  className="toeic-button toeic-button-outline"
                  disabled={busy}
                  onClick={() => setImportOpen(true)}
                >
                  <FileUploadOutlined fontSize="small" />
                  {t('Import Excel/CSV')}
                </button>
                <button
                  type="button"
                  className="toeic-button toeic-button-outline"
                  disabled={busy}
                  onClick={addQuestion}
                >
                  <AddRounded fontSize="small" />
                  {t('Thêm câu hỏi')}
                </button>
              </div>
              <div className="toeic-question-editor-layout">
                <nav className="toeic-admin-question-list" aria-label={t('Chọn câu hỏi để sửa')}>
                  {form.questions
                    .filter(question =>
                      `${question.number} ${question.prompt}`
                        .toLocaleLowerCase()
                        .includes(questionSearch.trim().toLocaleLowerCase()),
                    )
                    .map(question => (
                      <button
                        type="button"
                        key={question.id}
                        className={selectedQuestion?.id === question.id ? 'is-active' : ''}
                        onClick={() => setQuestionId(question.id)}
                      >
                        <strong>{t('Câu {number}', { number: question.number })}</strong>
                        <span>Part {question.part}</span>
                      </button>
                    ))}
                </nav>
                {selectedQuestion ? (
                  <fieldset disabled={busy} className="toeic-admin-fields">
                    <div className="toeic-field-pair">
                      <label>
                        {t('Số câu hỏi')}
                        <input
                          type="number"
                          min="1"
                          value={selectedQuestion.number}
                          onChange={event => editQuestion('number', event.target.value)}
                        />
                      </label>
                      <label>
                        Part
                        <select
                          value={selectedQuestion.part}
                          onChange={event => editQuestion('part', Number(event.target.value))}
                        >
                          {[5, 6, 7].map(part => (
                            <option value={part} key={part}>
                              Part {part}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      {t('Đoạn đọc')}
                      <textarea
                        rows="7"
                        value={selectedQuestion.passage}
                        onChange={event => editQuestion('passage', event.target.value)}
                      />
                    </label>
                    <label>
                      {t('Nội dung câu hỏi')}
                      <textarea
                        rows="3"
                        value={selectedQuestion.prompt}
                        onChange={event => editQuestion('prompt', event.target.value)}
                      />
                    </label>
                    {selectedQuestion.options.map(option => (
                      <label key={option.id}>
                        {t('Lựa chọn {letter}', { letter: option.id })}
                        <input
                          value={option.text}
                          onChange={event =>
                            editQuestion(
                              'options',
                              selectedQuestion.options.map(item =>
                                item.id === option.id ? { ...item, text: event.target.value } : item,
                              ),
                            )
                          }
                        />
                      </label>
                    ))}
                    <label>
                      {t('Đáp án đúng')}
                      <select
                        value={selectedQuestion.correctOptionId}
                        onChange={event => editQuestion('correctOptionId', event.target.value)}
                      >
                        {LETTERS.map(letter => (
                          <option key={letter} value={letter}>
                            {letter}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t('Giải thích đáp án')}
                      <textarea
                        rows="6"
                        value={selectedQuestion.explanation}
                        onChange={event => editQuestion('explanation', event.target.value)}
                      />
                    </label>
                    <details className="toeic-admin-source-fields">
                      <summary>{t('Nguồn và hình minh họa')}</summary>
                      <label>
                        {t('Tham chiếu nguồn câu hỏi')}
                        <input
                          value={selectedQuestion.source ?? ''}
                          onChange={event => editQuestion('source', event.target.value)}
                        />
                      </label>
                      <label>
                        {t('Đường dẫn hình câu hỏi')}
                        <input
                          value={selectedQuestion.imageUrl ?? ''}
                          placeholder="/toeic-assets/..."
                          onChange={event => editQuestion('imageUrl', event.target.value)}
                        />
                      </label>
                      <label>
                        {t('Hình đoạn đọc (mỗi đường dẫn một dòng)')}
                        <textarea
                          rows="3"
                          value={(selectedQuestion.passageImageUrls ?? []).join('\n')}
                          onChange={event =>
                            editQuestion(
                              'passageImageUrls',
                              event.target.value
                                .split('\n')
                                .map(value => value.trim())
                                .filter(Boolean),
                            )
                          }
                        />
                      </label>
                    </details>
                    <details className="toeic-admin-preview">
                      <summary>{t('Xem trước câu hỏi')}</summary>
                      <ToeicQuestion question={selectedQuestion} disabled />
                    </details>
                    <button
                      type="button"
                      className="toeic-button toeic-danger"
                      onClick={() => {
                        updateField(
                          'questions',
                          form.questions.filter(item => item.id !== selectedQuestion.id),
                        );
                        setQuestionId(null);
                      }}
                    >
                      <DeleteOutlineRounded fontSize="small" />
                      {t('Xóa câu hỏi')}
                    </button>
                  </fieldset>
                ) : (
                  <p className="toeic-admin-empty">
                    {t('Thêm câu hỏi để tạo phần luyện tập tương tác A–D.')}
                  </p>
                )}
              </div>
            </section>
          <div className="toeic-admin-savebar">
            <button type="submit" className="toeic-button button-primary" disabled={busy || !dirty}>
              <SaveOutlined fontSize="small" />
              {busy ? t('Đang xử lý...') : t('Lưu bộ đề')}
            </button>
            <button
              type="button"
              className="toeic-button toeic-button-outline"
              disabled={busy || editingId == null || dirty}
              onClick={togglePublished}
            >
              <PublishOutlined fontSize="small" />
              {t(form.published ? 'Ẩn bộ đề' : 'Xuất bản')}
            </button>
            <button
              type="button"
              className="toeic-button toeic-danger"
              disabled={busy || editingId == null}
              onClick={() => setConfirmDelete(true)}
            >
              <DeleteOutlineRounded fontSize="small" />
              {t('Xóa bộ đề')}
            </button>
            <small>
              {t(
                dirty
                  ? 'Có thay đổi chưa lưu. Hãy lưu trước khi xuất bản.'
                  : 'Bài làm cũ được giữ nguyên khi nội dung thay đổi.',
              )}
            </small>
          </div>
        </form>
      </div>
      {importOpen && (
        <ToeicQuestionImportDialog
          key={`${user?.id}:${editingId ?? 'new'}`}
          questions={form.questions}
          published={form.published}
          onImport={importQuestions}
          onClose={() => setImportOpen(false)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa bộ đề?"
        description="Bộ đề sẽ không còn trong thư viện. Bài làm và kết quả đã lưu của học viên vẫn được giữ."
        confirmLabel={t('Xóa bộ đề')}
        destructive
        pending={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteDefinition}
      />
      <ConfirmDialog
        open={confirmDiscard}
        title="Bỏ thay đổi chưa lưu?"
        description="Nội dung đang sửa chưa được lưu. Bạn có muốn tiếp tục chuyển bộ đề?"
        confirmLabel={t('Bỏ thay đổi và tiếp tục')}
        onClose={() => {
          discardAction.current = null;
          setConfirmDiscard(false);
        }}
        onConfirm={() => {
          const action = discardAction.current;
          discardAction.current = null;
          setConfirmDiscard(false);
          action?.();
        }}
      />
    </div>
  );
}
