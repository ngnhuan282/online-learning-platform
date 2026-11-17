import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

const paths = ENDPOINTS.toeic;

export const toeicApi = {
  list: options => axiosClient.get(paths.exams, { ...options, skipAuth: true }),
  detail: (id, options) => axiosClient.get(paths.exam(id), options),
  progress: (id, options) => axiosClient.get(paths.progress(id), options),
  completeLesson: (id, lessonId) => axiosClient.put(paths.completeLesson(id, lessonId)),
  start: (id, mode, part = null) => axiosClient.post(paths.start(id), { mode, part }),
  attempt: (id, options) => axiosClient.get(paths.attempt(id), options),
  saveAnswers: (id, answers, options) => axiosClient.put(paths.answers(id), { answers }, options),
  submit: (id, answers) => axiosClient.post(paths.submit(id), { answers }),
  adminList: options => axiosClient.get(paths.adminExams, options),
  adminDetail: (id, options) => axiosClient.get(paths.adminExam(id), options),
  create: definition => axiosClient.post(paths.adminExams, definition),
  update: (id, definition) => axiosClient.put(paths.adminExam(id), definition),
  publish: (id, published) => axiosClient.patch(paths.publish(id), { published }),
  remove: id => axiosClient.delete(paths.adminExam(id)),
};
