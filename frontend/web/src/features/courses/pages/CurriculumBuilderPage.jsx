import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurriculum } from '../hooks/useCurriculum';
import { courseApi } from '../api/courseApi';
import SectionItem from '../components/SectionItem';
import AddSectionDialog from '../components/AddSectionDialog';
import AddLessonDialog from '../components/AddLessonDialog';
import LessonResourcesModal from '../components/LessonResourcesModal';

export default function CurriculumBuilderPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const {
    sections,
    loading,
    error,
    refresh,
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    createLesson,
    updateLesson,
    deleteLesson,
    reorderLessons,
  } = useCurriculum(courseId);

  useEffect(() => {
    let active = true;
    if (courseId) {
      courseApi
        .adminGetById(courseId)
        .then(res => {
          if (!active) return;
          const data = res?.data?.data ?? res?.data ?? res;
          setCourse(data);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [courseId]);

  const [addSectionOpen, setAddSectionOpen] = useState(false);
  const [lessonDialogState, setLessonDialogState] = useState(null); // { sectionId, lesson? }
  const [resourceModalLesson, setResourceModalLesson] = useState(null);
  const [actionError, setActionError] = useState(null);

  /* ── Helpers ── */

  const handleError = err => {
    const msg =
      err?.response?.data?.message ||
      err?.message ||
      'Đã xảy ra lỗi, vui lòng thử lại.';
    setActionError(msg);
    setTimeout(() => setActionError(null), 4000);
  };

  /* ── Section handlers ── */

  const handleAddSection = async payload => {
    try {
      const nextOrder = sections.length;
      await createSection({ ...payload, orderIndex: nextOrder });
      setAddSectionOpen(false);
    } catch (err) {
      handleError(err);
    }
  };

  const handleUpdateSection = async (sectionId, payload) => {
    try {
      await updateSection(sectionId, payload);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteSection = async sectionId => {
    if (!window.confirm('Xóa chương này sẽ xóa toàn bộ bài học bên trong. Tiếp tục?')) return;
    try {
      await deleteSection(sectionId);
    } catch (err) {
      handleError(err);
    }
  };

  const handleMoveSectionUp = async section => {
    const idx = sections.findIndex(s => s.id === section.id);
    if (idx <= 0) return;
    const swapped = [...sections];
    [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
    const items = swapped.map((s, i) => ({ id: s.id, orderIndex: i }));
    try {
      await reorderSections(items);
    } catch (err) {
      handleError(err);
    }
  };

  const handleMoveSectionDown = async section => {
    const idx = sections.findIndex(s => s.id === section.id);
    if (idx < 0 || idx >= sections.length - 1) return;
    const swapped = [...sections];
    [swapped[idx], swapped[idx + 1]] = [swapped[idx + 1], swapped[idx]];
    const items = swapped.map((s, i) => ({ id: s.id, orderIndex: i }));
    try {
      await reorderSections(items);
    } catch (err) {
      handleError(err);
    }
  };

  /* ── Lesson handlers ── */

  const handleAddLesson = async payload => {
    if (!lessonDialogState) return;
    const { sectionId } = lessonDialogState;
    try {
      const section = sections.find(s => s.id === sectionId);
      const nextOrder = (section?.lessons ?? []).length;
      await createLesson(sectionId, { ...payload, orderIndex: nextOrder });
      setLessonDialogState(null);
    } catch (err) {
      handleError(err);
    }
  };

  const handleEditLesson = async (sectionId, lesson, payload) => {
    try {
      await updateLesson(sectionId, lesson.id, payload);
      setLessonDialogState(null);
    } catch (err) {
      handleError(err);
    }
  };

  const handleDeleteLesson = async (sectionId, lessonId) => {
    if (!window.confirm('Xóa bài học này?')) return;
    try {
      await deleteLesson(sectionId, lessonId);
    } catch (err) {
      handleError(err);
    }
  };

  const handleMoveLessonUp = async (sectionId, lesson) => {
    const section = sections.find(s => s.id === sectionId);
    const lessons = section?.lessons ?? [];
    const idx = lessons.findIndex(l => l.id === lesson.id);
    if (idx <= 0) return;
    const swapped = [...lessons];
    [swapped[idx - 1], swapped[idx]] = [swapped[idx], swapped[idx - 1]];
    const items = swapped.map((l, i) => ({ id: l.id, orderIndex: i }));
    try {
      await reorderLessons(sectionId, items);
    } catch (err) {
      handleError(err);
    }
  };

  const handleMoveLessonDown = async (sectionId, lesson) => {
    const section = sections.find(s => s.id === sectionId);
    const lessons = section?.lessons ?? [];
    const idx = lessons.findIndex(l => l.id === lesson.id);
    if (idx < 0 || idx >= lessons.length - 1) return;
    const swapped = [...lessons];
    [swapped[idx], swapped[idx + 1]] = [swapped[idx + 1], swapped[idx]];
    const items = swapped.map((l, i) => ({ id: l.id, orderIndex: i }));
    try {
      await reorderLessons(sectionId, items);
    } catch (err) {
      handleError(err);
    }
  };

  /* ── Render ── */

  return (
    <section className="container" style={{ padding: '32px 0 80px' }}>
      <div style={{ display: 'grid', gap: 24 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <button
              className="button button-soft"
              type="button"
              onClick={() => navigate('/admin/courses')}
              style={{ marginBottom: 10, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              ← Quay lại danh sách khóa học
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
              <span className="eyebrow">QUẢN LÝ KHÓA HỌC</span>
              {course?.categoryName && (
                <span style={{ fontSize: 12, padding: '2px 8px', background: '#e0f2fe', color: '#0369a1', borderRadius: 4, fontWeight: 600 }}>
                  {course.categoryName}
                </span>
              )}
            </div>
            <h1 style={{ marginTop: 2, fontSize: 24, fontWeight: 700 }}>
              {course?.title ? `Đề cương bài học: ${course.title}` : 'Quản lý Đề cương bài học'}
            </h1>
            <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: 14 }}>
              Cấu trúc chương học và các bài học (Video, Tài liệu PDF, Lý thuyết, Bài kiểm tra Quiz).
            </p>
          </div>
          <button
            id="btn-add-section"
            className="button button-primary"
            type="button"
            onClick={() => setAddSectionOpen(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 14 }}
          >
            ➕ Thêm chương học mới
          </button>
        </div>

        {/* Errors */}
        {error && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
            }}
          >
            Lỗi tải đề cương bài học:{' '}
            {error?.response?.data?.message || error?.message || 'Lỗi không xác định'}
            <button
              type="button"
              onClick={refresh}
              style={{ marginLeft: 12, textDecoration: 'underline', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
            >
              Thử lại
            </button>
          </div>
        )}

        {actionError && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 8,
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
            }}
          >
            {actionError}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div style={{ color: '#64748b', textAlign: 'center', padding: 40 }}>
            Đang tải đề cương bài học...
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sections.length === 0 && (
          <div
            className="course-card"
            style={{ padding: 40, textAlign: 'center', color: '#64748b' }}
          >
            <p style={{ fontSize: 16, marginBottom: 12 }}>Khóa học này chưa có chương học nào.</p>
            <button
              className="button button-primary"
              type="button"
              onClick={() => setAddSectionOpen(true)}
            >
              ➕ Thêm chương đầu tiên
            </button>
          </div>
        )}

        {/* Sections list */}
        {!loading && sections.map((section, idx) => (
          <SectionItem
            key={section.id}
            section={section}
            isFirst={idx === 0}
            isLast={idx === sections.length - 1}
            onUpdate={payload => handleUpdateSection(section.id, payload)}
            onDelete={() => handleDeleteSection(section.id)}
            onMoveUp={() => handleMoveSectionUp(section)}
            onMoveDown={() => handleMoveSectionDown(section)}
            onAddLesson={() => setLessonDialogState({ sectionId: section.id, lesson: null })}
            onEditLesson={lesson => setLessonDialogState({ sectionId: section.id, lesson })}
            onDeleteLesson={lessonId => handleDeleteLesson(section.id, lessonId)}
            onMoveLessonUp={lesson => handleMoveLessonUp(section.id, lesson)}
            onMoveLessonDown={lesson => handleMoveLessonDown(section.id, lesson)}
            onManageResources={lesson => setResourceModalLesson(lesson)}
          />
        ))}
      </div>

      {/* Dialogs */}
      {addSectionOpen && (
        <AddSectionDialog
          onConfirm={handleAddSection}
          onCancel={() => setAddSectionOpen(false)}
        />
      )}
      {lessonDialogState && (
        <AddLessonDialog
          courseId={courseId}
          initialLesson={lessonDialogState.lesson}
          mode={lessonDialogState.lesson ? 'edit' : 'create'}
          onConfirm={async payload => {
            if (lessonDialogState.lesson) {
              await handleEditLesson(lessonDialogState.sectionId, lessonDialogState.lesson, payload);
              return;
            }
            await handleAddLesson(payload);
          }}
          onCancel={() => setLessonDialogState(null)}
        />
      )}
      {resourceModalLesson && (
        <LessonResourcesModal
          lesson={resourceModalLesson}
          onClose={() => setResourceModalLesson(null)}
        />
      )}
    </section>
  );
}
