import { normalizeSearch } from '../data/demoCourses';

export function toCourseCard(course) {
  const category = course.categoryName || course.category || '';
  const topic = normalizeSearch(`${category} ${course.title}`);
  const price = Number(course.price ?? 0);
  const originalPrice = Number(course.originalPrice ?? 0);

  return {
    ...course,
    category,
    group: /ielts|toeic|toefl|chung chi/.test(topic) ? 'certificates' : 'communication',
    tag: category || 'Khóa học',
    image: course.thumbnailUrl || '/images/english-ielts.jpg',
    imageAlt: course.title,
    rating: Number(course.avgRating ?? course.rating ?? 0).toFixed(1),
    reviews: String(course.reviewCount ?? course.reviews ?? 0),
    students: course.students ?? null,
    hours: course.hours ?? null,
    level: course.level ? String(course.level).toLowerCase() : '',
    price,
    originalPrice: originalPrice > price ? originalPrice : 0,
    discount: originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0,
    date: course.createdAt || '',
    keywords: `${course.title} ${course.description} ${category}`,
    lessons: course.lessons || [],
  };
}

export function normalizeCategoryList(response) {
  const payload = response?.data ?? response;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}
