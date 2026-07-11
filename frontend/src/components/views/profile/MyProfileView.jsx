import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { User as UserIcon, Clock, Pencil, X } from 'lucide-react';
import api from '../../../services/apiClient';
import { updateUserProfile } from '../../../store/slices/authSlice';

// A read-only section that turns into an editable form when you click Edit.
const SectionCard = ({
  title, hint, isEditing, onEdit, onCancel, onSubmit,
  saving, successMsg, err, submitLabel = 'Update', display, children
}) => (
  <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm p-6 flex flex-col gap-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <h3 className="text-sm font-heading font-semibold text-text-primary">{title}</h3>
        {hint && <p className="text-xs text-text-secondary mt-0.5">{hint}</p>}
      </div>
      {!isEditing && (
        <button
          type="button"
          onClick={onEdit}
          title={`Edit ${title}`}
          className="w-8 h-8 rounded-lg bg-transparent hover:bg-slate-100 text-slate-400 hover:text-primary flex items-center justify-center cursor-pointer transition-all duration-150 shrink-0"
        >
          <Pencil size={14} />
        </button>
      )}
    </div>

    {successMsg && <div className="bg-success-bg text-success border border-success/15 p-2.5 rounded-lg text-xs text-center">{successMsg}</div>}
    {err && <div className="bg-danger-bg text-danger border border-danger/15 p-2.5 rounded-lg text-xs text-center">{err}</div>}

    {isEditing ? (
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {children}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-5 h-10 bg-gradient-to-r from-primary to-secondary text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-sm hover:-translate-y-0.5 transition-all duration-150 cursor-pointer disabled:opacity-50 text-xs"
          >
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div> : submitLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 h-10 bg-white border border-slate-200 hover:bg-slate-50 text-text-secondary hover:text-text-primary font-semibold rounded-xl flex items-center gap-1.5 transition-all duration-150 cursor-pointer disabled:opacity-50 text-xs"
          >
            <X size={13} /> Cancel
          </button>
        </div>
      </form>
    ) : (
      display
    )}
  </div>
);

const MyProfileView = () => {
  const dispatch = useDispatch();

  const [loading, setLoading] = useState(true);

  // Photo section
  const [avatar, setAvatar] = useState('');
  const [avatarDraft, setAvatarDraft] = useState('');
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState('');
  const [avatarErr, setAvatarErr] = useState('');

  // Name section
  const [name, setName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [nameErr, setNameErr] = useState('');

  // Qualification section (doctors only)
  const [role, setRole] = useState('');
  const [qualification, setQualification] = useState('');
  const [qualificationDraft, setQualificationDraft] = useState('');
  const [pendingQualification, setPendingQualification] = useState(null);
  const [editingQual, setEditingQual] = useState(false);
  const [qualSaving, setQualSaving] = useState(false);
  const [qualMsg, setQualMsg] = useState('');
  const [qualErr, setQualErr] = useState('');

  // Password section (no "current value" to show, just collapsed by default)
  const [editingPassword, setEditingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passErr, setPassErr] = useState('');

  const fetchMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me');
      setAvatar(res.data.data.avatar || '');
      setName(res.data.data.name || '');
      setRole(res.data.data.role || '');
      setQualification(res.data.data.qualification || '');
      setPendingQualification(res.data.data.pendingQualification || null);
    } catch (e) {
      console.error('Failed to load profile:', e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  // --- Photo ---
  const startEditAvatar = () => {
    setAvatarDraft(avatar);
    setAvatarErr('');
    setAvatarMsg('');
    setEditingAvatar(true);
  };
  const cancelEditAvatar = () => setEditingAvatar(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarErr('');
    if (file.size > 2 * 1024 * 1024) {
      setAvatarErr('File size is too large. Please select an image under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setAvatarDraft(reader.result);
    reader.onerror = () => setAvatarErr('Failed to read file.');
    reader.readAsDataURL(file);
  };

  const handleSaveAvatar = async (e) => {
    e.preventDefault();
    setAvatarErr('');
    setAvatarMsg('');
    setAvatarSaving(true);
    try {
      const res = await api.put('/auth/me', { avatar: avatarDraft });
      dispatch(updateUserProfile({ avatar: res.data.data.avatar }));
      setAvatar(res.data.data.avatar || '');
      setAvatarMsg('Profile photo updated.');
      setEditingAvatar(false);
    } catch (e) {
      setAvatarErr(e.response?.data?.message || 'Failed to update photo.');
    } finally {
      setAvatarSaving(false);
    }
  };

  // --- Name ---
  const startEditName = () => {
    setNameDraft(name);
    setNameErr('');
    setNameMsg('');
    setEditingName(true);
  };
  const cancelEditName = () => setEditingName(false);

  const handleSaveName = async (e) => {
    e.preventDefault();
    setNameErr('');
    setNameMsg('');
    if (!nameDraft.trim()) {
      setNameErr('Name cannot be empty.');
      return;
    }
    setNameSaving(true);
    try {
      const res = await api.put('/auth/me', { name: nameDraft });
      dispatch(updateUserProfile({ name: res.data.data.name }));
      setName(res.data.data.name || '');
      setNameMsg('Name updated.');
      setEditingName(false);
    } catch (e) {
      setNameErr(e.response?.data?.message || 'Failed to update name.');
    } finally {
      setNameSaving(false);
    }
  };

  // --- Qualification ---
  const startEditQual = () => {
    setQualificationDraft(qualification);
    setQualErr('');
    setQualMsg('');
    setEditingQual(true);
  };
  const cancelEditQual = () => setEditingQual(false);

  const handleSaveQualification = async (e) => {
    e.preventDefault();
    setQualErr('');
    setQualMsg('');
    setQualSaving(true);
    try {
      const res = await api.put('/auth/me', { qualification: qualificationDraft });
      setPendingQualification(res.data.data.pendingQualification || null);
      setQualMsg(res.data.meta?.qualificationPending
        ? 'Submitted for admin approval.'
        : 'Qualification updated.');
      setEditingQual(false);
    } catch (e) {
      setQualErr(e.response?.data?.message || 'Failed to update qualification.');
    } finally {
      setQualSaving(false);
    }
  };

  // --- Password ---
  const startEditPassword = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPassErr('');
    setPassMsg('');
    setEditingPassword(true);
  };
  const cancelEditPassword = () => setEditingPassword(false);

  const handleSavePassword = async (e) => {
    e.preventDefault();
    setPassErr('');
    setPassMsg('');
    if (!currentPassword || !newPassword) {
      setPassErr('Enter both your current password and a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setPassErr('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassErr('New password and confirmation do not match.');
      return;
    }
    setPassSaving(true);
    try {
      await api.put('/auth/me', { currentPassword, newPassword });
      setPassMsg('Password updated.');
      setEditingPassword(false);
    } catch (e) {
      setPassErr(e.response?.data?.message || 'Failed to update password.');
    } finally {
      setPassSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 border-t-primary-light"></div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[560px] animate-[fadeIn_0.2s_ease-out] flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-heading font-bold text-text-primary mb-1">My Profile</h2>
        <p className="text-text-secondary text-sm">Click the pencil on any section to edit it — each one saves independently.</p>
      </div>

      <SectionCard
        title="Profile Photo"
        isEditing={editingAvatar}
        onEdit={startEditAvatar}
        onCancel={cancelEditAvatar}
        onSubmit={handleSaveAvatar}
        saving={avatarSaving}
        successMsg={avatarMsg}
        err={avatarErr}
        submitLabel="Save Photo"
        display={
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 bg-white flex items-center justify-center">
              {avatar ? (
                <img src={avatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                  <UserIcon size={24} className="text-white" />
                </div>
              )}
            </div>
          </div>
        }
      >
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shadow-sm shrink-0 bg-white flex items-center justify-center">
            {avatarDraft ? (
              <img src={avatarDraft} alt="Preview" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <UserIcon size={24} className="text-white" />
              </div>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="text-xs text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Full Name"
        isEditing={editingName}
        onEdit={startEditName}
        onCancel={cancelEditName}
        onSubmit={handleSaveName}
        saving={nameSaving}
        successMsg={nameMsg}
        err={nameErr}
        submitLabel="Save Name"
        display={<p className="text-sm text-text-primary font-semibold">{name}</p>}
      >
        <input
          type="text"
          className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          autoFocus
          required
        />
      </SectionCard>

      {role === 'doctor' && (
        <SectionCard
          title="Qualification"
          hint="Changes require admin approval before they take effect."
          isEditing={editingQual}
          onEdit={startEditQual}
          onCancel={cancelEditQual}
          onSubmit={handleSaveQualification}
          saving={qualSaving}
          successMsg={qualMsg}
          err={qualErr}
          submitLabel="Submit for Approval"
          display={
            <div className="flex flex-col gap-2">
              <p className="text-sm text-text-primary font-semibold">{qualification || <span className="text-slate-300 italic font-normal">Not set</span>}</p>
              {pendingQualification && (
                <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2 w-fit">
                  <Clock size={12} />
                  Awaiting admin approval: "{pendingQualification}"
                </p>
              )}
            </div>
          }
        >
          <input
            type="text"
            placeholder="e.g. MBBS, MD, FRCS"
            className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
            value={qualificationDraft}
            onChange={(e) => setQualificationDraft(e.target.value)}
            autoFocus
          />
          {pendingQualification && (
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 rounded-lg px-3 py-2">
              <Clock size={12} />
              Awaiting admin approval: "{pendingQualification}"
            </p>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="Password"
        isEditing={editingPassword}
        onEdit={startEditPassword}
        onCancel={cancelEditPassword}
        onSubmit={handleSavePassword}
        saving={passSaving}
        successMsg={passMsg}
        err={passErr}
        submitLabel="Update Password"
        display={<p className="text-sm text-slate-400 tracking-widest">••••••••</p>}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary">Current Password</label>
            <input
              type="password"
              className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary">New Password</label>
            <input
              type="password"
              className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-text-secondary">Confirm New Password</label>
            <input
              type="password"
              className="w-full bg-white border border-slate-200 rounded-lg p-3 outline-none text-text-primary focus:border-primary-light focus:ring-3 focus:ring-primary/10 transition-all duration-150 text-sm"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
        </div>
      </SectionCard>
    </div>
  );
};

export default MyProfileView;
