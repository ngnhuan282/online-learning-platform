import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import Add from '@mui/icons-material/Add';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import PublishOutlined from '@mui/icons-material/PublishOutlined';
import { learningApi } from '../api/learningApi';
import { courseApi } from '../../courses/api/courseApi';
import ErrorState from '../../../shared/components/ErrorState';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
import LearningHeader from '../components/LearningHeader';
import { getSessionVersion } from '../../../shared/utils/tokenUtils';
import '../styles/quiz.css';

const blankOption = () => ({ optionText: '', correct: false });
const blankQuestion = () => ({
  questionText: '',
  questionType: 'SINGLE_CHOICE',
  points: 1,
  options: [blankOption(), blankOption()],
});
const blankQuiz = () => ({
  courseId: '',
  lessonId: '',
  title: '',
  description: '',
  passingScore: 70,
  timeLimitMinutes: '',
  questions: [blankQuestion()],
});

const definitionPayload = form => ({
  ...form,
  title: form.title.trim(),
  description: form.description.trim(),
  courseId: Number(form.courseId),
  lessonId: form.lessonId ? Number(form.lessonId) : null,
  passingScore: Number(form.passingScore),
  timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
  questions: form.questions.map(question => ({
    ...question,
    questionText: question.questionText.trim(),
    points: Number(question.points),
    options: question.options.map(option => ({ ...option, optionText: option.optionText.trim() })),
  })),
});

function definitionError(form) {
  const positiveInteger = value => Number.isSafeInteger(Number(value)) && Number(value) > 0;
  if (!positiveInteger(form.courseId)) return 'Mã khóa học phải là số nguyên dương.';
  if (form.lessonId && !positiveInteger(form.lessonId)) return 'Mã bài học phải là số nguyên dương.';
  if (!form.title.trim()) return 'Vui lòng nhập tên quiz.';
  if (
    !Number.isInteger(Number(form.passingScore)) ||
    form.passingScore === '' ||
    Number(form.passingScore) < 0 ||
    Number(form.passingScore) > 100
  ) {
    return 'Điểm đạt phải là số nguyên từ 0 đến 100.';
  }
  if (form.timeLimitMinutes && !positiveInteger(form.timeLimitMinutes)) {
    return 'Giới hạn thời gian phải là số phút nguyên dương.';
  }
  for (const [index, question] of form.questions.entries()) {
    if (!question.questionText.trim()) return `Vui lòng nhập nội dung câu ${index + 1}.`;
    if (!positiveInteger(question.points)) return `Điểm câu ${index + 1} phải là số nguyên dương.`;
    if (question.options.length < 2 || question.options.some(option => !option.optionText.trim())) {
      return `Câu ${index + 1} cần ít nhất hai đáp án có nội dung.`;
    }
    const correct = question.options.filter(option => option.correct).length;
    if (!correct || (question.questionType === 'SINGLE_CHOICE' && correct !== 1)) {
      return `Câu ${index + 1} cần ${question.questionType === 'SINGLE_CHOICE' ? 'đúng một' : 'ít nhất một'} đáp án đúng.`;
    }
  }
  return null;
}

export default function AdminQuizPage() {
  const editorRef = useRef(null);
  const mounted = useRef(false);
  const pending = useRef(false);
  const [quizzes, setQuizzes] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(blankQuiz);
  const [editingId, setEditingId] = useState(null);
  const [published, setPublished] = useState(false);
  const [savedForm, setSavedForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [listError, setListError] = useState(null);
  const [courseError, setCourseError] = useState(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    Promise.resolve()
      .then(() => {
        if (!active) return [];
        setLoading(true);
        setListError(null);
        setCourseError(null);
        return Promise.allSettled([
          learningApi.getAdminQuizzes(),
          courseApi.adminList({ page: 0, size: 100 }),
        ]);
      })
      .then(([quizResult, courseResult]) => {
        if (!active) return;
        if (quizResult.status === 'fulfilled') setQuizzes(quizResult.value.data ?? []);
        else setListError(quizResult.reason);
        if (courseResult.status === 'fulfilled') {
          const data = courseResult.value.data;
          setCourses(data?.items ?? data?.content ?? (Array.isArray(data) ? data : []));
        } else setCourseError(courseResult.reason);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      mounted.current = false;
    };
  }, [retry]);

  function beginAction() {
    pending.current = true;
    const session = getSessionVersion();
    setBusy(true);
    setError(null);
    setMessage('');
    return () => mounted.current && session === getSessionVersion();
  }

  function endAction(active) {
    pending.current = false;
    if (active()) setBusy(false);
  }

  async function reloadQuizzes(active) {
    try {
      const response = await learningApi.getAdminQuizzes();
      if (active()) {
        setQuizzes(response.data ?? []);
        setListError(null);
      }
    } catch (loadError) {
      if (active()) setListError(loadError);
    }
  }

  function resetEditor() {
    setEditingId(null);
    setPublished(false);
    setForm(blankQuiz());
    setSavedForm(null);
    setError(null);
    setMessage('');
    setConfirmDelete(false);
  }

  function startNew() {
    if (!pending.current) resetEditor();
  }

  async function selectQuiz(id) {
    if (pending.current) return;
    const active = beginAction();
    try {
      const { data } = await learningApi.getAdminQuiz(id);
      if (!active()) return;
      setEditingId(data.id);
      setPublished(data.published);
      const nextForm = {
        courseId: String(data.courseId),
        lessonId: data.lessonId ? String(data.lessonId) : '',
        title: data.title,
        description: data.description ?? '',
        passingScore: data.passingScore,
        timeLimitMinutes: data.timeLimitMinutes ?? '',
        questions: data.questions.map(question => ({
          questionText: question.questionText,
          questionType: question.questionType,
          points: question.points,
          options: question.options.map(option => ({
            optionText: option.optionText,
            correct: option.correct,
          })),
        })),
      };
      setForm(nextForm);
      setSavedForm(JSON.stringify(nextForm));
    } catch (loadError) {
      if (active()) setError(loadError);
    } finally {
      endAction(active);
    }
  }

  function updateQuestion(index, next) {
    setForm(previous => ({
      ...previous,
      questions: previous.questions.map((question, current) => (current === index ? next : question)),
    }));
  }

  function updateOption(questionIndex, optionIndex, patch) {
    const question = form.questions[questionIndex];
    const options = question.options.map((option, index) => {
      if (index === optionIndex) return { ...option, ...patch };
      if (patch.correct && question.questionType === 'SINGLE_CHOICE') return { ...option, correct: false };
      return option;
    });
    updateQuestion(questionIndex, { ...question, options });
  }

  async function save(event) {
    event.preventDefault();
    if (pending.current || published) return;
    const validation = definitionError(form);
    if (validation) {
      setError(new Error(validation));
      return;
    }
    if (!editorRef.current?.reportValidity()) return;
    const active = beginAction();
    try {
      const response = editingId
        ? await learningApi.updateQuiz(editingId, definitionPayload(form))
        : await learningApi.createQuiz(definitionPayload(form));
      if (!active()) return;
      setEditingId(response.data.id);
      setSavedForm(JSON.stringify(form));
      setMessage('Đã lưu bản nháp quiz.');
      await reloadQuizzes(active);
    } catch (saveError) {
      if (active()) setError(saveError);
    } finally {
      endAction(active);
    }
  }

  async function publish() {
    if (!editingId || pending.current || published) return;
    const validation = definitionError(form);
    if (validation) {
      setError(new Error(validation));
      return;
    }
    if (!editorRef.current?.reportValidity()) return;
    const active = beginAction();
    try {
      if (JSON.stringify(form) !== savedForm) {
        await learningApi.updateQuiz(editingId, definitionPayload(form));
        if (!active()) return;
        setSavedForm(JSON.stringify(form));
      }
      await learningApi.publishQuiz(editingId);
      if (!active()) return;
      setPublished(true);
      setMessage('Quiz đã xuất bản. Học viên đã ghi danh có thể làm bài.');
      await reloadQuizzes(active);
    } catch (publishError) {
      if (active()) setError(publishError);
    } finally {
      endAction(active);
    }
  }

  async function deleteDraft() {
    if (!editingId || pending.current || published) return;
    const active = beginAction();
    try {
      await learningApi.deleteQuiz(editingId);
      if (!active()) return;
      resetEditor();
      setMessage('Đã xóa bản nháp quiz.');
      await reloadQuizzes(active);
    } catch (deleteError) {
      if (active()) setError(deleteError);
    } finally {
      endAction(active);
      if (active()) setConfirmDelete(false);
    }
  }

  return (
    <section className="admin-quiz-page learning-admin-workspace">
      <LearningHeader
        title="Quản lý quiz"
        description="Soạn câu hỏi, lưu bản nháp và xuất bản bài kiểm tra."
        navigation={false}
      >
        <Button variant="outlined" startIcon={<Add />} onClick={startNew} disabled={busy}>
          Quiz mới
        </Button>
      </LearningHeader>
      {error && <ErrorState error={error} title="Không thể xử lý quiz" />}
      {listError && (
        <ErrorState
          error={listError}
          title="Không thể tải danh sách quiz"
          onRetry={busy ? undefined : () => setRetry(value => value + 1)}
        />
      )}
      {courseError && (
        <ErrorState
          error={courseError}
          title="Không thể tải danh sách khóa học; bạn có thể nhập mã khóa học"
          onRetry={busy ? undefined : () => setRetry(value => value + 1)}
        />
      )}
      {message && <Alert severity="success">{message}</Alert>}
      <div className="quiz-admin-layout">
        <aside className="quiz-admin-list" aria-busy={loading}>
          <h2>Danh sách quiz</h2>
          {loading && <p>Đang tải...</p>}
          {!loading && !listError && quizzes.length === 0 && <p>Chưa có quiz.</p>}
          {quizzes.map(quiz => (
            <button
              key={quiz.id}
              type="button"
              className={editingId === quiz.id ? 'is-selected' : ''}
              onClick={() => selectQuiz(quiz.id)}
              disabled={busy}
            >
              <strong>{quiz.title}</strong>
              <span>
                Khóa #{quiz.courseId} · {quiz.published ? 'Đã xuất bản' : 'Bản nháp'}
              </span>
            </button>
          ))}
        </aside>
        <form ref={editorRef} className="quiz-editor" onSubmit={save}>
          <div className="quiz-editor-heading">
            <h2>{editingId ? `Quiz #${editingId}` : 'Tạo quiz'}</h2>
            {published && <span className="learning-chip is-success">Đã xuất bản</span>}
          </div>
          <div className="quiz-form-grid">
            <TextField
              label="Khóa học"
              select={courses.length > 0}
              type={courses.length ? undefined : 'number'}
              value={form.courseId}
              onChange={event => setForm({ ...form, courseId: event.target.value })}
              required
              slotProps={{ htmlInput: { min: 1, step: 1 } }}
              disabled={published || busy}
            >
              {courses.map(course => (
                <MenuItem key={course.id} value={String(course.id)}>
                  {course.title}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Bài học (tùy chọn)"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              value={form.lessonId}
              onChange={event => setForm({ ...form, lessonId: event.target.value })}
              disabled={published || busy}
            />
            <TextField
              label="Tên quiz"
              value={form.title}
              required
              slotProps={{ htmlInput: { maxLength: 255 } }}
              onChange={event => setForm({ ...form, title: event.target.value })}
              disabled={published || busy}
            />
            <TextField
              label="Điểm đạt (%)"
              type="number"
              slotProps={{ htmlInput: { min: 0, max: 100 } }}
              value={form.passingScore}
              onChange={event => setForm({ ...form, passingScore: event.target.value })}
              required
              disabled={published || busy}
            />
            <TextField
              label="Giới hạn thời gian (phút)"
              type="number"
              slotProps={{ htmlInput: { min: 1 } }}
              value={form.timeLimitMinutes}
              onChange={event => setForm({ ...form, timeLimitMinutes: event.target.value })}
              disabled={published || busy}
            />
            <TextField
              label="Mô tả"
              multiline
              rows={2}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              value={form.description}
              onChange={event => setForm({ ...form, description: event.target.value })}
              disabled={published || busy}
            />
          </div>
          <div className="quiz-editor-heading">
            <h3>Câu hỏi</h3>
          </div>
          {form.questions.map((question, questionIndex) => (
            <fieldset className="quiz-question-editor" key={questionIndex} disabled={published || busy}>
              <legend>Câu {questionIndex + 1}</legend>
              <div className="quiz-form-grid">
                <TextField
                  label="Nội dung câu hỏi"
                  value={question.questionText}
                  required
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                  onChange={event =>
                    updateQuestion(questionIndex, { ...question, questionText: event.target.value })
                  }
                />
                <TextField
                  select
                  label="Loại câu hỏi"
                  value={question.questionType}
                  onChange={event =>
                    updateQuestion(questionIndex, {
                      ...question,
                      questionType: event.target.value,
                      options:
                        event.target.value === 'SINGLE_CHOICE'
                          ? question.options.map((option, index) => ({
                              ...option,
                              correct: index === question.options.findIndex(item => item.correct),
                            }))
                          : question.options,
                    })
                  }
                >
                  <MenuItem value="SINGLE_CHOICE">Một đáp án</MenuItem>
                  <MenuItem value="MULTIPLE_CHOICE">Nhiều đáp án</MenuItem>
                </TextField>
                <TextField
                  label="Điểm"
                  type="number"
                  slotProps={{ htmlInput: { min: 1 } }}
                  value={question.points}
                  onChange={event =>
                    updateQuestion(questionIndex, { ...question, points: event.target.value })
                  }
                />
              </div>
              <div className="quiz-option-list">
                {question.options.map((option, optionIndex) => (
                  <div className="quiz-option-editor" key={optionIndex}>
                    <FormControlLabel
                      label="Đúng"
                      control={
                        <Checkbox
                          checked={option.correct}
                          onChange={event =>
                            updateOption(questionIndex, optionIndex, { correct: event.target.checked })
                          }
                        />
                      }
                    />
                    <TextField
                      label={`Đáp án ${optionIndex + 1}`}
                      value={option.optionText}
                      required
                      slotProps={{ htmlInput: { maxLength: 1000 } }}
                      onChange={event =>
                        updateOption(questionIndex, optionIndex, { optionText: event.target.value })
                      }
                    />
                    <Button
                      aria-label={`Xóa đáp án ${optionIndex + 1}`}
                      disabled={question.options.length <= 2}
                      onClick={() =>
                        updateQuestion(questionIndex, {
                          ...question,
                          options: question.options.filter((_, index) => index !== optionIndex),
                        })
                      }
                    >
                      <DeleteOutlined />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="quiz-editor-actions">
                <Button
                  startIcon={<Add />}
                  onClick={() =>
                    updateQuestion(questionIndex, {
                      ...question,
                      options: [...question.options, blankOption()],
                    })
                  }
                >
                  Đáp án
                </Button>
                <Button
                  color="error"
                  startIcon={<DeleteOutlined />}
                  disabled={form.questions.length <= 1}
                  onClick={() =>
                    setForm({
                      ...form,
                      questions: form.questions.filter((_, index) => index !== questionIndex),
                    })
                  }
                >
                  Xóa câu hỏi
                </Button>
              </div>
            </fieldset>
          ))}
          {!published && (
            <div className="quiz-editor-actions">
              <Button
                startIcon={<Add />}
                disabled={busy}
                onClick={() => setForm({ ...form, questions: [...form.questions, blankQuestion()] })}
              >
                Thêm câu hỏi
              </Button>
              <Button type="submit" variant="contained" startIcon={<SaveOutlined />} disabled={busy}>
                {editingId ? 'Lưu thay đổi' : 'Tạo bản nháp'}
              </Button>
              <Button
                type="button"
                variant="outlined"
                startIcon={<PublishOutlined />}
                onClick={publish}
                disabled={!editingId || busy}
              >
                Xuất bản
              </Button>
              {editingId && (
                <Button
                  type="button"
                  color="error"
                  startIcon={<DeleteOutlined />}
                  onClick={() => setConfirmDelete(true)}
                  disabled={busy}
                >
                  Xóa bản nháp
                </Button>
              )}
            </div>
          )}
        </form>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title="Xóa bản nháp quiz?"
        description="Câu hỏi và đáp án trong bản nháp sẽ bị xóa."
        confirmLabel="Xóa"
        destructive
        pending={busy}
        onConfirm={deleteDraft}
        onClose={() => setConfirmDelete(false)}
      />
    </section>
  );
}
