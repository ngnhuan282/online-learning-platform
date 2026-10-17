import { API_PREFIX } from '../constants/appConstants';

export const ENDPOINTS = Object.freeze({
  auth: {
    login: `${API_PREFIX}/auth/login`,
    register: `${API_PREFIX}/auth/register`,
    refresh: `${API_PREFIX}/auth/refresh`,
    logout: `${API_PREFIX}/auth/logout`,
    forgotPassword: `${API_PREFIX}/auth/forgot-password`,
    resetPassword: `${API_PREFIX}/auth/reset-password`,
    googleStart: `${API_PREFIX}/auth/google/start`,
    googleExchange: `${API_PREFIX}/auth/google/exchange`,
  },
  users: {
    me: `${API_PREFIX}/users/me`,
    changePassword: `${API_PREFIX}/users/change-password`,
    linkedAccounts: `${API_PREFIX}/users/me/linked-accounts`,
  },
  googleLink: {
    start: `${API_PREFIX}/auth/google/link/start`,
    complete: `${API_PREFIX}/auth/google/link/complete`,
  },
  adminUsers: `${API_PREFIX}/admin/users`,
  courses: `${API_PREFIX}/courses`,
  adminCourses: `${API_PREFIX}/admin/courses`,
  categories: `${API_PREFIX}/categories`,
  learning: {
    dashboard: `${API_PREFIX}/learning/dashboard`,
    enrollments: `${API_PREFIX}/learning/enrollments/me`,
    enroll: `${API_PREFIX}/learning/enrollments`,
    progress: courseId => `${API_PREFIX}/learning/progress/courses/${courseId}`,
    lessonAccess: (courseId, lessonId) =>
      `${API_PREFIX}/learning/progress/courses/${courseId}/lessons/${lessonId}/access`,
    lessonComplete: (courseId, lessonId) =>
      `${API_PREFIX}/learning/progress/courses/${courseId}/lessons/${lessonId}/complete`,
    quiz: quizId => `${API_PREFIX}/learning/quizzes/${quizId}`,
    courseQuizzes: courseId => `${API_PREFIX}/learning/courses/${courseId}/quizzes`,
    quizStart: quizId => `${API_PREFIX}/learning/quizzes/${quizId}/attempts`,
    quizSubmit: attemptId => `${API_PREFIX}/learning/quizzes/attempts/${attemptId}/submit`,
    quizResult: quizId => `${API_PREFIX}/learning/quizzes/${quizId}/result`,
    quizReview: attemptId => `${API_PREFIX}/learning/quizzes/attempts/${attemptId}/review`,
    adminQuizzes: `${API_PREFIX}/learning/admin/quizzes`,
    adminQuiz: quizId => `${API_PREFIX}/learning/admin/quizzes/${quizId}`,
    adminQuizPublish: quizId => `${API_PREFIX}/learning/admin/quizzes/${quizId}/publish`,
    notifications: `${API_PREFIX}/learning/notifications`,
    notificationFeed: `${API_PREFIX}/learning/notifications/feed`,
    notificationSummary: `${API_PREFIX}/learning/notifications/summary`,
    notificationsReadAll: `${API_PREFIX}/learning/notifications/read-all`,
    notificationStream: `${API_PREFIX}/learning/notifications/stream`,
    notificationRead: notificationId => `${API_PREFIX}/learning/notifications/${notificationId}/read`,
  },
  payments: `${API_PREFIX}/payments`,
  ai: `${API_PREFIX}/ai`,
});
