import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const learningApi = {
  getDashboard: options => axiosClient.get(ENDPOINTS.learning.dashboard, options),
  getMyEnrollments: options => axiosClient.get(ENDPOINTS.learning.enrollments, options),
  enroll: courseId => axiosClient.post(ENDPOINTS.learning.enroll, { courseId }),
  getLearningCourse: (courseId, options) => axiosClient.get(ENDPOINTS.learning.course(courseId), options),
  getCourseProgress: courseId => axiosClient.get(ENDPOINTS.learning.progress(courseId)),
  accessLesson: (courseId, lessonId) => axiosClient.post(ENDPOINTS.learning.lessonAccess(courseId, lessonId)),
  markLessonComplete: (courseId, lessonId) =>
    axiosClient.patch(ENDPOINTS.learning.lessonComplete(courseId, lessonId)),
  getQuiz: quizId => axiosClient.get(ENDPOINTS.learning.quiz(quizId)),
  getCourseQuizzes: courseId => axiosClient.get(ENDPOINTS.learning.courseQuizzes(courseId)),
  startQuiz: quizId => axiosClient.post(ENDPOINTS.learning.quizStart(quizId)),
  submitQuiz: (attemptId, answers) => axiosClient.post(ENDPOINTS.learning.quizSubmit(attemptId), { answers }),
  getQuizResult: quizId => axiosClient.get(ENDPOINTS.learning.quizResult(quizId)),
  getQuizReview: attemptId => axiosClient.get(ENDPOINTS.learning.quizReview(attemptId)),
  getAdminQuizzes: () => axiosClient.get(ENDPOINTS.learning.adminQuizzes),
  getAdminQuiz: quizId => axiosClient.get(ENDPOINTS.learning.adminQuiz(quizId)),
  createQuiz: payload => axiosClient.post(ENDPOINTS.learning.adminQuizzes, payload),
  updateQuiz: (quizId, payload) => axiosClient.put(ENDPOINTS.learning.adminQuiz(quizId), payload),
  publishQuiz: quizId => axiosClient.patch(ENDPOINTS.learning.adminQuizPublish(quizId)),
  deleteQuiz: quizId => axiosClient.delete(ENDPOINTS.learning.adminQuiz(quizId)),
  getNotifications: () => axiosClient.get(ENDPOINTS.learning.notifications),
  getNotificationFeed: (params, options = {}) =>
    axiosClient.get(ENDPOINTS.learning.notificationFeed, { ...options, params }),
  getNotificationSummary: options => axiosClient.get(ENDPOINTS.learning.notificationSummary, options),
  markAllNotificationsRead: () => axiosClient.patch(ENDPOINTS.learning.notificationsReadAll),
  openNotificationStream: options =>
    axiosClient.get(ENDPOINTS.learning.notificationStream, {
      ...options,
      adapter: 'fetch',
      responseType: 'stream',
      timeout: 0,
      headers: { Accept: 'text/event-stream' },
    }),
  markNotificationRead: notificationId =>
    axiosClient.patch(ENDPOINTS.learning.notificationRead(notificationId)),
  getAdminNotifications: (params, options = {}) =>
    axiosClient.get(ENDPOINTS.learning.adminNotifications, { ...options, params }),
  sendSystemNotification: payload => axiosClient.post(ENDPOINTS.learning.adminNotifications, payload),
};
