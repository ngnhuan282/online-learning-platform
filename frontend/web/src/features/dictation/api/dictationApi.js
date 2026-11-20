import axiosClient from '../../../shared/apis/axiosClient';

const base = '/api/v1/learning/dictation';
const admin = '/api/v1/learning/admin/dictation';
const part = value => encodeURIComponent(value);
const multipart = file => {
  const data = new FormData();
  data.append('file', file);
  return data;
};

export const dictationApi = {
  query: (path, params, signal) => axiosClient.get(path, { params, signal }),
  catalogPath: base,
  topicGroupsPath: `${base}/topic-groups`,
  adminPath: admin,
  historyPath: `${base}/attempts`,
  attemptPath: id => `${base}/attempts/${part(id)}`,
  start: (id, payload) => axiosClient.post(`${base}/exercises/${part(id)}/attempts`, payload),
  progress: (id, payload) => axiosClient.put(`${base}/attempts/${part(id)}/progress`, payload),
  check: (id, payload) => axiosClient.post(`${base}/attempts/${part(id)}/check`, payload),
  hint: (id, index, wordIndex) => axiosClient.post(`${base}/attempts/${part(id)}/hint`, { index, wordIndex }),
  reveal: (id, index) => axiosClient.post(`${base}/attempts/${part(id)}/reveal`, { index }),
  skip: (id, index) => axiosClient.post(`${base}/attempts/${part(id)}/skip`, { index }),
  finish: id => axiosClient.post(`${base}/attempts/${part(id)}/finish`),
  audio: (id, signal) =>
    axiosClient.get(`${base}/attempts/${part(id)}/audio`, { responseType: 'blob', signal }),
  adminAudio: (key, signal) =>
    axiosClient.get(`${admin}/audio/${part(key)}`, { responseType: 'blob', signal }),
  upload: file => axiosClient.post(`${admin}/audio`, multipart(file), { timeout: 120000 }),
  detail: id => axiosClient.get(`${admin}/${part(id)}`),
  save: (id, payload) =>
    id ? axiosClient.put(`${admin}/${part(id)}`, payload) : axiosClient.post(admin, payload),
  publish: (id, version, definition) =>
    axiosClient.post(id ? `${admin}/${part(id)}/publish` : `${admin}/publish`, {
      version,
      ...(definition ? { definition } : {}),
    }),
  visibility: (id, archived) => axiosClient.put(`${admin}/${part(id)}/visibility`, { archived }),
  template: () => axiosClient.get(`${admin}/template`, { responseType: 'blob' }),
  import: file => axiosClient.post(`${admin}/import`, multipart(file)),
};

export function downloadWorkbook(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'transcript-template.xlsx';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
