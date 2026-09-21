import { API_PREFIX } from '../constants/appConstants';

export const ENDPOINTS = Object.freeze({
  auth: {
    login: `${API_PREFIX}/auth/login`,
    register: `${API_PREFIX}/auth/register`,
    refresh: `${API_PREFIX}/auth/refresh`,
    logout: `${API_PREFIX}/auth/logout`,
  },
  users: {
    me: `${API_PREFIX}/users/me`,
    changePassword: `${API_PREFIX}/users/change-password`,
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
    quiz: quizId => `${API_PREFIX}/learning/quizzes/${quizId}`,
    quizResult: quizId => `${API_PREFIX}/learning/quizzes/${quizId}/result`,
    notifications: `${API_PREFIX}/learning/notifications`,
    notificationRead: notificationId => `${API_PREFIX}/learning/notifications/${notificationId}/read`,
  },
  payments: `${API_PREFIX}/payments`,
  ai: `${API_PREFIX}/ai`,
});
