import { useCallback, useEffect, useRef, useState } from 'react';
import { sectionApi } from '../api/sectionApi';
import { lessonApi } from '../api/lessonApi';

/**
 * Hook quản lý toàn bộ curriculum (sections + lessons) của một course.
 * @param {string|number} courseId
 */
export function useCurriculum(courseId) {
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetch = useCallback(async () => {
    if (!courseId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await sectionApi.listByCourse(courseId);
      const data = res?.data?.data ?? res?.data ?? [];
      if (mountedRef.current) setSections(Array.isArray(data) ? data : []);
    } catch (err) {
      if (mountedRef.current) setError(err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  /* ── Sections ── */

  const createSection = useCallback(
    async payload => {
      const res = await sectionApi.create(courseId, payload);
      const newSection = res?.data?.data ?? res?.data;
      setSections(prev => [...prev, { ...newSection, lessons: [] }]);
      return newSection;
    },
    [courseId],
  );

  const updateSection = useCallback(
    async (sectionId, payload) => {
      const res = await sectionApi.update(courseId, sectionId, payload);
      const updated = res?.data?.data ?? res?.data;
      setSections(prev =>
        prev.map(s => (s.id === sectionId ? { ...s, ...updated } : s)),
      );
      return updated;
    },
    [courseId],
  );

  const deleteSection = useCallback(
    async sectionId => {
      await sectionApi.delete(courseId, sectionId);
      setSections(prev => prev.filter(s => s.id !== sectionId));
    },
    [courseId],
  );

  /**
   * @param {Array<{id: number, orderIndex: number}>} orderedItems
   */
  const reorderSections = useCallback(
    async orderedItems => {
      await sectionApi.reorder(courseId, orderedItems);
      setSections(prev => {
        const updated = prev.map(s => {
          const found = orderedItems.find(item => item.id === s.id);
          return found ? { ...s, orderIndex: found.orderIndex } : s;
        });
        return [...updated].sort((a, b) => a.orderIndex - b.orderIndex);
      });
    },
    [courseId],
  );

  /* ── Lessons ── */

  const createLesson = useCallback(async (sectionId, payload) => {
    const res = await lessonApi.create(sectionId, payload);
    const newLesson = res?.data?.data ?? res?.data;
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId
          ? { ...s, lessons: [...(s.lessons ?? []), newLesson] }
          : s,
      ),
    );
    return newLesson;
  }, []);

  const updateLesson = useCallback(async (sectionId, lessonId, payload) => {
    const res = await lessonApi.update(lessonId, payload);
    const updated = res?.data?.data ?? res?.data;
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId
          ? {
              ...s,
              lessons: (s.lessons ?? []).map(l =>
                l.id === lessonId ? { ...l, ...updated } : l,
              ),
            }
          : s,
      ),
    );
    return updated;
  }, []);

  const deleteLesson = useCallback(async (sectionId, lessonId) => {
    await lessonApi.delete(lessonId);
    setSections(prev =>
      prev.map(s =>
        s.id === sectionId
          ? { ...s, lessons: (s.lessons ?? []).filter(l => l.id !== lessonId) }
          : s,
      ),
    );
  }, []);

  /**
   * @param {number} sectionId
   * @param {Array<{id: number, orderIndex: number}>} orderedItems
   */
  const reorderLessons = useCallback(async (sectionId, orderedItems) => {
    await lessonApi.reorder(sectionId, orderedItems);
    setSections(prev =>
      prev.map(s => {
        if (s.id !== sectionId) return s;
        const updatedLessons = (s.lessons ?? []).map(l => {
          const found = orderedItems.find(item => item.id === l.id);
          return found ? { ...l, orderIndex: found.orderIndex } : l;
        });
        return {
          ...s,
          lessons: [...updatedLessons].sort((a, b) => a.orderIndex - b.orderIndex),
        };
      }),
    );
  }, []);

  return {
    sections,
    loading,
    error,
    refresh: fetch,
    // section actions
    createSection,
    updateSection,
    deleteSection,
    reorderSections,
    // lesson actions
    createLesson,
    updateLesson,
    deleteLesson,
    reorderLessons,
  };
}
