import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, MenuItem, TextField } from '@mui/material';
import { Add, DeleteOutlined, SaveOutlined, PublishOutlined } from '@mui/icons-material';
import { learningApi } from '../api/learningApi';
import { courseApi } from '../../courses/api/courseApi';
import ErrorState from '../../../shared/components/ErrorState';
import ConfirmDialog from '../../../shared/components/ConfirmDialog';
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
  courseId: Number(form.courseId),
  lessonId: form.lessonId ? Number(form.lessonId) : null,
  passingScore: Number(form.passingScore),
  timeLimitMinutes: form.timeLimitMinutes ? Number(form.timeLimitMinutes) : null,
  questions: form.questions.map(question => ({
    ...question,
    points: Number(question.points),
  })),
});

export default function AdminQuizPage() {
  const editorRef = useRef(null);
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

  useEffect(() => {
    let active = true;
    Promise.allSettled([learningApi.getAdminQuizzes(), courseApi.adminList({ page: 0, size: 100 })])
      .then(([quizResult, courseResult]) => {
        if (!active) return;
        if (quizResult.status === 'fulfilled') setQuizzes(quizResult.value.data ?? []);
        else setError(quizResult.reason);
        if (courseResult.status === 'fulfilled') {
          setCourses(courseResult.value.data?.content ?? []);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function startNew() {
    setEditingId(null);
    setPublished(false);
    setForm(blankQuiz());
    setSavedForm(null);
    setError(null);
    setMessage('');
  }

  async function selectQuiz(id) {
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const { data } = await learningApi.getAdminQuiz(id);
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
      setError(loadError);
    } finally {
      setBusy(false);
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
    if (busy || published) return;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      const response = editingId
        ? await learningApi.updateQuiz(editingId, definitionPayload(form))
        : await learningApi.createQuiz(definitionPayload(form));
      setEditingId(response.data.id);
      setSavedForm(JSON.stringify(form));
      setQuizzes((await learningApi.getAdminQuizzes()).data ?? []);
      setMessage('Đã lưu bản nháp quiz.');
    } catch (saveError) {
      setError(saveError);
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!editingId || busy || published) return;
    if (!editorRef.current?.reportValidity()) return;
    setBusy(true);
    setError(null);
    setMessage('');
    try {
      if (JSON.stringify(form) !== savedForm) {
        await learningApi.updateQuiz(editingId, definitionPayload(form));
        setSavedForm(JSON.stringify(form));
      }
      await learningApi.publishQuiz(editingId);
      setPublished(true);
      setQuizzes((await learningApi.getAdminQuizzes()).data ?? []);
      setMessage('Quiz đã xuất bản. Học viên đã ghi danh có thể làm bài.');
    } catch (publishError) {
      setError(publishError);
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft() {
    if (!editingId || busy || published) return;
    setBusy(true);
    setError(null);
    try {
      await learningApi.deleteQuiz(editingId);
      setQuizzes((await learningApi.getAdminQuizzes()).data ?? []);
      startNew();
      setMessage('Đã xóa bản nháp quiz.');
    } catch (deleteError) {
      setError(deleteError);
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  return (
    <section className="admin-quiz-page">
      <div className="admin-page-heading">
        <div>
          <p>Học tập</p>
          <h1>Quản lý quiz</h1>
        </div>
        <Button variant="outlined" startIcon={<Add />} onClick={startNew}>
          Quiz mới
        </Button>
      </div>
      {error && <ErrorState error={error} title="Không thể xử lý quiz" />}
      {message && <Alert severity="success">{message}</Alert>}
      <div className="quiz-admin-layout">
        <aside className="quiz-admin-list" aria-busy={loading}>
          <h2>Danh sách quiz</h2>
          {loading && <p>Đang tải...</p>}
          {!loading && quizzes.length === 0 && <p>Chưa có quiz.</p>}
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
