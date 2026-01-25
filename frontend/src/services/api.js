import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
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

// Auth APIs
export const authAPI = {
  firstLogin: (email, firstName, lastName, conferenceCode) => 
    api.post('/auth/attendee/first-login', { email, firstName, lastName, conferenceCode }),
  attendeeLogin: (email, password, conferenceCode) => 
    api.post('/auth/attendee/login', { email, password, conferenceCode }),
  adminLogin: (email, password) => 
    api.post('/auth/admin/login', { email, password })
};

// Conference APIs
export const conferenceAPI = {
  list: () => api.get('/conferences'),
  create: (data) => api.post('/conferences', data),
  get: (id) => api.get(`/conferences/${id}`),
  getByCode: (code) => api.get(`/conferences/by-code/${code}`),
  update: (id, data) => api.put(`/conferences/${id}`, data),
  activate: (id) => api.post(`/conferences/${id}/activate`),
  delete: (id) => api.delete(`/conferences/${id}`),
  downloadQRPng: (id) => api.get(`/conferences/${id}/qr-code/png`, { responseType: 'blob' }),
  downloadQRSvg: (id) => api.get(`/conferences/${id}/qr-code/svg`, { responseType: 'blob' })
};

// Survey APIs
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

// Question APIs
export const questionAPI = {
  listBySurvey: (surveyId) => api.get(`/questions/survey/${surveyId}`),
  create: (data) => api.post('/questions', data),
  update: (id, data) => api.put(`/questions/${id}`, data),
  reorder: (surveyId, questionIds) => api.put('/questions/reorder', { surveyId, questionIds }),
  delete: (id) => api.delete(`/questions/${id}`)
};

// Response APIs
export const responseAPI = {
  submit: (surveyId, responses) => api.post(`/responses/survey/${surveyId}`, { responses }),
  getBySurvey: (surveyId) => api.get(`/responses/survey/${surveyId}`),
  getMyResponses: () => api.get('/responses/attendee')
};

// Statistics APIs
export const statisticsAPI = {
  getSurveyStats: (surveyId) => api.get(`/statistics/survey/${surveyId}`),
  getConferenceSummary: (conferenceId) => api.get(`/statistics/conference/${conferenceId}/summary`)
};

// Attendee APIs
export const attendeeAPI = {
  listByConference: (conferenceId, params = {}) => 
    api.get(`/attendees/conference/${conferenceId}`, { params }),
  unlock: (id) => api.put(`/attendees/${id}/unlock`),
  delete: (id) => api.delete(`/attendees/${id}`)
};

// Export APIs
export const exportAPI = {
  surveyCSV: (surveyId) => api.get(`/export/survey/${surveyId}/csv`, { responseType: 'blob' }),
  surveyPDF: (surveyId) => api.get(`/export/survey/${surveyId}/pdf`, { responseType: 'blob' }),
  attendeeList: (conferenceId) => api.get(`/export/conference/${conferenceId}/attendees`, { responseType: 'blob' })
};

export default api;
