export function normalizeLessonFormData(lesson = {}) {
  return {
    title: lesson.title ?? '',
    lessonType: lesson.lessonType ?? 'VIDEO',
    videoUrl: lesson.videoUrl ?? '',
    content: lesson.content ?? '',
    duration: Number.isFinite(Number(lesson.duration)) ? Number(lesson.duration) : 0,
    orderIndex: Number.isFinite(Number(lesson.orderIndex)) ? Number(lesson.orderIndex) : 0,
    preview: Boolean(lesson.preview),
  };
}

export function buildLessonPayload(form = {}) {
  const title = String(form.title ?? '').trim();
  return {
    title,
    lessonType: form.lessonType ?? 'VIDEO',
    videoUrl: form.lessonType === 'VIDEO' ? String(form.videoUrl ?? '').trim() : null,
    content: String(form.content ?? '').trim() || null,
    duration: Number(form.duration) || 0,
    orderIndex: Number(form.orderIndex) || 0,
    preview: Boolean(form.preview),
  };
}
