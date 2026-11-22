import axiosClient from '../../../shared/apis/axiosClient';
import { ENDPOINTS } from '../../../shared/apis/endpoints';

const paths = ENDPOINTS.toeic;
const uploadTimeout = 120_000;

function mediaForm(file) {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export const toeicApi = {
  list: options => axiosClient.get(paths.exams, { ...options, skipAuth: true }),
  dictionary: (term, options) =>
    axiosClient.get(paths.dictionary, { ...options, params: { term }, skipAuth: true }),
  notes: (examId = null, options = {}) =>
    axiosClient.get(paths.notes, {
      ...options,
      params: examId != null ? { examId } : undefined,
    }),
  createNote: payload => axiosClient.post(paths.notes, payload),
  updateNote: (id, payload) => axiosClient.put(paths.note(id), payload),
  deleteNote: id => axiosClient.delete(paths.note(id)),
  detail: (id, options) => axiosClient.get(paths.exam(id), options),
  progress: (id, options) => axiosClient.get(paths.progress(id), options),
  completeLesson: (id, lessonId) => axiosClient.put(paths.completeLesson(id, lessonId)),
  start: (id, mode, part = null, durationMinutes = null) =>
    axiosClient.post(paths.start(id), {
      mode,
      part,
      ...(durationMinutes != null ? { durationMinutes } : {}),
    }),
  attempt: (id, options) => axiosClient.get(paths.attempt(id), options),
  saveAnswers: (id, answers, options) => axiosClient.put(paths.answers(id), { answers }, options),
  submit: (id, answers) => axiosClient.post(paths.submit(id), { answers }),
  adminList: options => axiosClient.get(paths.adminExams, options),
  adminDetail: (id, options) => axiosClient.get(paths.adminExam(id), options),
  create: definition => axiosClient.post(paths.adminExams, definition),
  update: (id, definition) => axiosClient.put(paths.adminExam(id), definition),
  publish: (id, published) => axiosClient.patch(paths.publish(id), { published }),
  remove: id => axiosClient.delete(paths.adminExam(id)),
  mediaList: (kind, page, options) =>
    axiosClient.get(paths.adminMedia, { ...options, params: { kind, page } }),
  uploadMedia: (file, kind) =>
    axiosClient.post(paths.adminMedia, mediaForm(file), { params: { kind }, timeout: uploadTimeout }),
  replaceMedia: (id, version, file) =>
    axiosClient.put(paths.adminMediaItem(id), mediaForm(file), {
      params: { version },
      timeout: uploadTimeout,
    }),
  deleteMedia: (id, version) => axiosClient.delete(paths.adminMediaItem(id), { params: { version } }),
};
