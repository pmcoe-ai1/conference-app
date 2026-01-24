import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  firstLogin: (email, conferenceCode) => api.post('/auth/attendee/first-login', { email, conferenceCode }),
  attendeeLogin: (email, password, conferenceCode) => api.post('/auth/attendee/login', { email, password, conferenceCode }),
  forgotPassword: (email, conferenceCode) => api.post('/auth/attendee/forgot-password', { email, conferenceCode }),
  resetPassword: (token, newPassword, conferenceCode) => api.post('/auth/attendee/reset-password', { token, newPassword, conferenceCode }),
  adminLogin: (email, password) => api.post('/auth/admin/login', { email, password }),
  adminRegister: (email, password, name) => api.post('/auth/admin/register', { email, password, name })
};

export const conferenceAPI = {
  list: () => api.get('/conferences'),
  create: (data) => api.post('/conferences', data),
  get: (id) => api.get(`/conferences/${id}`),
  update: (id, data) => api.put(`/conferences/${id}`, data),
  archive: (id) => api.delete(`/conferences/${id}`),
  activate: (id) => api.post(`/conferences/${id}/activate`),
  getByCode: (code) => api.get(`/conferences/by-code/${code}`),
  regenerateQR: (id) => api.post(`/conferences/${id}/qr-code`),
  downloadQRPng: (id) => api.get(`/conferences/${id}/qr-code/png`, { responseType: 'blob' }),
  downloadQRSvg: (id) => api.get(`/conferences/${id}/qr-code/svg`, { responseType: 'blob' })
};

export const surveyAPI = {
  listByConference: (conferenceId) => api.get(`/surveys/conference/${conferenceId}`),
  getActive: () => api.get('/surveys/active'),
  create: (data) => api.post('/surveys', data),
  get: (id) => api.get(`/surveys/${id}`),
  update: (id, data) => api.put(`/surveys/${id}`, data),
  activate: (id) => api.put(`/surveys/${id}/activate`),
  deactivate: (id) => api.put(`/surveys/${id}/deactivate`),
  delete: (id) => api.delete(`/surveys/${id}`)
};

export const questionAPI = {
  listBySurvey: (surveyId) => api.get(`/questions/survey/${surveyId}`),
  create: (data) => api.post('/questions', data),
  update: (id, data) => api.put(`/questions/${id}`, data),
  reorder: (surveyId, questionIds) => api.put('/questions/reorder', { surveyId, questionIds }),
  delete: (id) => api.delete(`/questions/${id}`)
};

export const responseAPI = {
  submit: (surveyId, responses) => api.post(`/responses/survey/${surveyId}`, { responses }),
  getBySurvey: (surveyId) => api.get(`/responses/survey/${surveyId}`),
  getByAttendee: (attendeeId) => api.get(`/responses/attendee/${attendeeId}`)
};

export const statisticsAPI = {
  getSurveyStats: (surveyId) => api.get(`/statistics/survey/${surveyId}`),
  getQuestionStats: (questionId) => api.get(`/statistics/question/${questionId}`),
  getConferenceSummary: (conferenceId) => api.get(`/statistics/conference/${conferenceId}/summary`)
};

export const attendeeAPI = {
  listByConference: (conferenceId, params = {}) => api.get(`/attendees/conference/${conferenceId}`, { params }),
  get: (id) => api.get(`/attendees/${id}`),
  unlock: (id) => api.put(`/attendees/${id}/unlock`),
  delete: (id) => api.delete(`/attendees/${id}`),
  getNonResponders: (conferenceId) => api.get(`/attendees/conference/${conferenceId}/non-responders`)
};

export const exportAPI = {
  surveyCSV: (surveyId) => api.get(`/export/survey/${surveyId}/csv`, { responseType: 'blob' }),
  surveyPDF: (surveyId) => api.get(`/export/survey/${surveyId}/pdf`, { responseType: 'blob' }),
  attendeeList: (conferenceId) => api.get(`/export/conference/${conferenceId}/attendees`, { responseType: 'blob' })
};

export default api;
