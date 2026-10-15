const coerceCourse = course => ({
  ...course,
  id: course.id ?? course.courseId ?? Date.now(),
  title: course.title ?? 'Khóa học mới',
  description: course.description ?? 'Mô tả khóa học',
  categoryId: course.categoryId ?? course.category_id ?? null,
  categoryName: course.categoryName ?? course.category ?? 'Luyện thi IELTS',
  level: course.level ?? 'beginner',
  price: Number(course.price ?? 0),
  originalPrice: Number(course.originalPrice ?? course.price ?? 0),
  thumbnailUrl: course.thumbnailUrl ?? course.image ?? '/images/english-ielts.jpg',
  status: course.status ?? 'PUBLISHED',
  createdAt: course.createdAt ?? new Date().toISOString(),
});

export const normalizeCourseList = response => {
  const payload = response?.data ?? response;

  if (Array.isArray(payload)) return payload.map(coerceCourse);
  if (Array.isArray(payload?.content)) return payload.content.map(coerceCourse);
  if (Array.isArray(payload?.data?.content)) return payload.data.content.map(coerceCourse);
  if (Array.isArray(payload?.items)) return payload.items.map(coerceCourse);
  if (Array.isArray(payload?.data)) return payload.data.map(coerceCourse);
  return [];
};

export const normalizeCoursePayload = payload => ({
  title: payload.title,
  description: payload.description,
  ...payload,
  categoryId: Number(payload.categoryId),
  level: payload.level ? String(payload.level).toUpperCase() : undefined,
  status: payload.status ? String(payload.status).toUpperCase() : 'PUBLISHED',
  price: Number(payload.price ?? 0),
  originalPrice: Number(payload.originalPrice ?? 0),
  thumbnailUrl: payload.thumbnailUrl || '/images/english-ielts.jpg',
});
