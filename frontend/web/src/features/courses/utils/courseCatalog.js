import { normalizeSearch } from '../data/demoCourses';

const CATEGORY_FALLBACK_IMAGES = {
  ielts: '/images/english-ielts.jpg',
  toeic: '/images/english-toeic.jpg',
  communication: '/images/english-speaking.jpg',
  tech: '/images/english-workplace.jpg',
  pronunciation: '/images/english-speaking.jpg',
  business: '/images/english-workplace.jpg',
  grammar: '/images/english-ielts.jpg',
  mentor: '/images/english-speaking.jpg',
};

const DEFAULT_FALLBACK_IMAGE = '/images/english-ielts.jpg';

function resolveFallbackImage(course) {
  const categoryId = String(course.categoryId || '').toLowerCase();
  const categoryName = normalizeSearch(course.categoryName || course.category || '');
  // Match by categoryId first, then by keyword in categoryName
  if (CATEGORY_FALLBACK_IMAGES[categoryId]) return CATEGORY_FALLBACK_IMAGES[categoryId];
  for (const [key, img] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (categoryName.includes(key)) return img;
  }
  return DEFAULT_FALLBACK_IMAGE;
}

export function toCourseCard(course) {
  const category = course.categoryName || course.category || '';
  const topic = normalizeSearch(`${category} ${course.title}`);
  const price = Number(course.price ?? 0);
  const originalPrice = Number(course.originalPrice ?? 0);
  const fallbackImage = resolveFallbackImage(course);

  return {
    ...course,
    category,
    group: /ielts|toeic|toefl|chung chi/.test(topic) ? 'certificates' : 'communication',
    tag: category || 'Khóa học',
    image: course.thumbnailUrl || fallbackImage,
    fallbackImage,
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
