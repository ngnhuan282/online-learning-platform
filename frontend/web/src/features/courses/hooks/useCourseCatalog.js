import { useEffect, useState } from 'react';
import { courseApi } from '../api/courseApi';
import { categoryApi } from '../api/categoryApi';
import { normalizeCourseList } from '../utils/courseForm';
import { normalizeCategoryList, toCourseCard } from '../utils/courseCatalog';

export default function useCourseCatalog(queryParams = null) {
  const queryKey = queryParams == null ? null : JSON.stringify(queryParams);
  const [pagination, setPagination] = useState({ page: 0, totalPages: 0, totalElements: 0 });
  const [courses, setCourses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [categoryError, setCategoryError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const options = { signal: controller.signal };

    async function loadCourses() {
      setLoading(true);
      setError(null);
      try {
        const filters = queryKey == null ? null : JSON.parse(queryKey);
        if (filters) {
          const response = await courseApi.list(filters, options);
          if (controller.signal.aborted) return;
          const payload = response?.data?.data ?? response?.data ?? response;
          setCourses(normalizeCourseList(response).map(toCourseCard));
          setPagination({
            page: payload?.page ?? filters.page ?? 0,
            totalPages: payload?.totalPages ?? 1,
            totalElements: payload?.totalElements ?? normalizeCourseList(response).length,
          });
          return;
        }
        const items = [];
        let page = 0;
        let totalPages = 1;
        // The UI filters locally, so include every page rather than only the first 20 courses.
        do {
          const response = await courseApi.list({ page, size: 100 }, options);
          if (controller.signal.aborted) return;
          items.push(...normalizeCourseList(response));
          const payload = response?.data?.data ?? response?.data ?? response;
          totalPages = payload?.totalPages ?? 1;
          page++;
        } while (page < totalPages);
        setCourses([...new Map(items.map(course => [course.id, toCourseCard(course)])).values()]);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    async function loadCategories() {
      setCategoryError(null);
      try {
        const response = await categoryApi.list(options);
        if (!controller.signal.aborted) setCategories(normalizeCategoryList(response));
      } catch (failure) {
        if (!controller.signal.aborted) setCategoryError(failure);
      }
    }

    // A failed category request must not discard a successful course response.
    loadCourses();
    loadCategories();
    return () => controller.abort();
  }, [attempt, queryKey]);

  return {
    courses,
    categories,
    pagination,
    loading,
    error,
    categoryError,
    retry: () => setAttempt(value => value + 1),
  };
}
