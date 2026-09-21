export const demoLearningDashboard = {
  activeEnrollments: 2,
  completedEnrollments: 1,
  completedLessons: 14,
  unreadNotifications: 3,
  recentEnrollments: [
    {
      id: 1,
      courseId: 101,
      status: 'ACTIVE',
      enrolledAt: '2026-09-01T08:00:00Z',
      completedAt: null,
      lastAccessedAt: '2026-09-17T02:40:00Z',
    },
    {
      id: 2,
      courseId: 102,
      status: 'ACTIVE',
      enrolledAt: '2026-08-20T08:00:00Z',
      completedAt: null,
      lastAccessedAt: '2026-09-15T11:20:00Z',
    },
  ],
  recentQuizResults: [
    {
      attemptId: 11,
      quizId: 401,
      courseId: 101,
      status: 'GRADED',
      score: 86,
      passed: true,
      startedAt: '2026-09-15T09:00:00Z',
      submittedAt: '2026-09-15T09:24:00Z',
    },
  ],
  notifications: [
    {
      id: 21,
      type: 'QUIZ',
      title: 'Quiz mới đã sẵn sàng',
      body: 'Bạn có bài kiểm tra ngắn sau bài học Speaking foundation.',
      actionUrl: '/my-courses',
      read: false,
      createdAt: '2026-09-17T02:30:00Z',
    },
    {
      id: 22,
      type: 'PROGRESS',
      title: 'Tiến độ học tập tăng tốt',
      body: 'Bạn đã hoàn thành 4 bài học trong tuần này.',
      actionUrl: '/dashboard',
      read: false,
      createdAt: '2026-09-16T10:00:00Z',
    },
  ],
};

export const demoCourseProgress = [
  {
    id: 1,
    courseId: 101,
    lessonId: 1001,
    status: 'COMPLETED',
    progressPercent: 100,
    timeSpentSeconds: 2400,
    updatedAt: '2026-09-14T09:00:00Z',
  },
  {
    id: 2,
    courseId: 101,
    lessonId: 1002,
    status: 'IN_PROGRESS',
    progressPercent: 65,
    timeSpentSeconds: 1800,
    updatedAt: '2026-09-16T12:00:00Z',
  },
  {
    id: 3,
    courseId: 101,
    lessonId: 1003,
    status: 'NOT_STARTED',
    progressPercent: 0,
    timeSpentSeconds: 0,
    updatedAt: '2026-09-16T12:10:00Z',
  },
];

export const demoQuizResult = {
  attemptId: 11,
  quizId: 401,
  courseId: 101,
  status: 'GRADED',
  score: 86,
  passed: true,
  startedAt: '2026-09-15T09:00:00Z',
  submittedAt: '2026-09-15T09:24:00Z',
};
