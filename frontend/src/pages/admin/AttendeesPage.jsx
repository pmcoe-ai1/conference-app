import React, { useState, useEffect } from 'react';
import { Search, Download, Unlock, Trash2, Eye, Loader2, Users } from 'lucide-react';
import { conferenceAPI, attendeeAPI, exportAPI } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, Card, Select, StatusBadge, EmptyState, Modal } from '../../components/ui';

export default function AttendeesPage() {
  const toast = useToast();
  const [conferences, setConferences] = useState([]);
  const [selectedConference, setSelectedConference] = useState(null);
  const [attendees, setAttendees] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedAttendee, setSelectedAttendee] = useState(null);

  useEffect(() => { loadConferences(); }, []);
  useEffect(() => { if (selectedConference) loadAttendees(); }, [selectedConference, search, statusFilter]);

  const loadConferences = async () => {
    try {
      const { data } = await conferenceAPI.list();
      setConferences(data);
      if (data.length > 0) setSelectedConference(data[0]);
    } catch (err) { toast.error('Failed to load conferences'); }
    finally { setLoading(false); }
  };

  const loadAttendees = async (page = 1) => {
    try {
      const params = { page, limit: 50 };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const { data } = await attendeeAPI.listByConference(selectedConference.id, params);
      setAttendees(data.attendees);
      setPagination(data.pagination);
    } catch (err) { toast.error('Failed to load attendees'); }
  };

  const handleUnlock = async (attendee) => {
    try {
      await attendeeAPI.unlock(attendee.id);
      toast.success('Account unlocked');
      loadAttendees();
    } catch (err) { toast.error('Failed to unlock account'); }
  };

  const handleDelete = async (attendee) => {
    if (!confirm(`Remove ${attendee.email}? This will delete all their responses.`)) return;
    try {
      await attendeeAPI.delete(attendee.id);
      toast.success('Attendee removed');
      loadAttendees();
    } catch (err) { toast.error('Failed to remove attendee'); }
  };

  const downloadList = async () => {
    try {
      const response = await exportAPI.attendeeList(selectedConference.id);
      const url = window.URL.createObjectURL(response.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedConference.urlCode}_attendees.csv`;
      a.click();
      toast.success('List downloaded');
    } catch (err) { toast.error('Download failed'); }
  };

  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><Loader2 className="w-8 h-8 text-indigo-500 animate-spin" /></div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Attendees</h1>
          <p className="text-slate-400">{pagination.total} registered for {selectedConference?.name}</p>
        </div>
        <Button variant="secondary" onClick={downloadList}><Download size={18} />Export List</Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <Select value={selectedConference?.id || ''} onChange={(e) => setSelectedConference(conferences.find(c => c.id === e.target.value))} className="w-64">
          {conferences.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email..." className="w-full pl-10 pr-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-48">
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="first_login">Pending Password</option>
          <option value="locked">Locked</option>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {attendees.length === 0 ? (
          <div className="p-8"><EmptyState icon={Users} title="No attendees found" description={search ? 'Try a different search term' : 'No one has registered yet'} /></div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-800/50">
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Email</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">First Login</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Last Login</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-slate-400">Responses</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody>
              {attendees.map((attendee) => (
                <tr key={attendee.id} className="border-b border-slate-700/50 hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-white">{attendee.email}</td>
                  <td className="px-4 py-3"><StatusBadge status={attendee.status} /></td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{attendee.firstLoginAt ? new Date(attendee.firstLoginAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-slate-400 text-sm">{attendee.lastLoginAt ? new Date(attendee.lastLoginAt).toLocaleDateString() : '-'}</td>
                  <td className="px-4 py-3 text-white">{attendee.responseCount || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {attendee.status === 'locked' && (
                        <button onClick={() => handleUnlock(attendee)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-emerald-400" title="Unlock"><Unlock size={16} /></button>
                      )}
                      <button onClick={() => setSelectedAttendee(attendee)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-white" title="View"><Eye size={16} /></button>
                      <button onClick={() => handleDelete(attendee)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400" title="Remove"><Trash2 size={16} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((page) => (
            <button key={page} onClick={() => loadAttendees(page)} className={`px-3 py-1 rounded ${pagination.page === page ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{page}</button>
          ))}
        </div>
      )}

      {/* Attendee Detail Modal */}
      <Modal isOpen={!!selectedAttendee} onClose={() => setSelectedAttendee(null)} title="Attendee Details">
        {selectedAttendee && (
          <div className="space-y-4">
            <div><label className="text-sm text-slate-400">Email</label><p className="text-white">{selectedAttendee.email}</p></div>
            <div><label className="text-sm text-slate-400">Status</label><div className="mt-1"><StatusBadge status={selectedAttendee.status} /></div></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="text-sm text-slate-400">First Login</label><p className="text-white">{selectedAttendee.firstLoginAt ? new Date(selectedAttendee.firstLoginAt).toLocaleString() : 'Never'}</p></div>
              <div><label className="text-sm text-slate-400">Last Login</label><p className="text-white">{selectedAttendee.lastLoginAt ? new Date(selectedAttendee.lastLoginAt).toLocaleString() : 'Never'}</p></div>
            </div>
            <div><label className="text-sm text-slate-400">Responses Submitted</label><p className="text-white">{selectedAttendee.responseCount || 0}</p></div>
            {selectedAttendee.status === 'locked' && (
              <div className="pt-4"><Button onClick={() => { handleUnlock(selectedAttendee); setSelectedAttendee(null); }}><Unlock size={18} />Unlock Account</Button></div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
