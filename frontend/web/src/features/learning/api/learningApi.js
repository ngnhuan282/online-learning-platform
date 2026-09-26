import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

export const learningApi = {
  getDashboard: () => axiosClient.get(ENDPOINTS.learning.dashboard),
  getMyEnrollments: () => axiosClient.get(ENDPOINTS.learning.enrollments),
  enroll: courseId => axiosClient.post(ENDPOINTS.learning.enroll, { courseId }),
  getCourseProgress: courseId => axiosClient.get(ENDPOINTS.learning.progress(courseId)),
  accessLesson: (courseId, lessonId) =>
    axiosClient.post(ENDPOINTS.learning.lessonAccess(courseId, lessonId)),
  markLessonComplete: (courseId, lessonId) =>
    axiosClient.patch(ENDPOINTS.learning.lessonComplete(courseId, lessonId)),
  getQuiz: quizId => axiosClient.get(ENDPOINTS.learning.quiz(quizId)),
  getQuizResult: quizId => axiosClient.get(ENDPOINTS.learning.quizResult(quizId)),
  getNotifications: () => axiosClient.get(ENDPOINTS.learning.notifications),
  markNotificationRead: notificationId => axiosClient.patch(ENDPOINTS.learning.notificationRead(notificationId)),
};
