'use client';

/* oxlint-disable next/no-img-element -- Local avatar choices have explicit dimensions and do not need the preview runtime image shim. */
import { useId, useState, useSyncExternalStore, type SubmitEvent } from 'react';
import '@/app/profile-editor.css';

// Adapted from WorkBuddy WB-002: form and preview remain local to the dialog.
export type Profile = { name: string; bio: string; avatar: string };
export type ProfileSaveResult = 'persisted' | 'memory' | 'invalid';

const STORAGE_KEY = 'kkapp:profile';
const DEFAULT_PROFILE: Profile = {
  name: 'KK闪闪星',
  bio: '',
  avatar: '/avatars/avatar-18.jpg',
};
const AVATAR_OPTIONS = [
  '/avatars/avatar-18.jpg',
  '/avatars/avatar-06.webp',
  '/avatars/avatar-07.jpg',
  '/avatars/avatar-11.webp',
  '/avatars/avatar-15.jpg',
  '/avatars/avatar-17.webp',
] as const;
const NAME_MIN = 2;
const NAME_MAX = 20;
const BIO_MAX = 100;

function validateName(value: string): string | null {
  const length = value.trim().length;
  if (length < NAME_MIN) return `名字至少 ${NAME_MIN} 个字`;
  if (length > NAME_MAX) return `名字最多 ${NAME_MAX} 个字`;
  return null;
}

function validateBio(value: string): string | null {
  return value.length > BIO_MAX ? `简介最多 ${BIO_MAX} 个字` : null;
}

function validateProfile(value: unknown): Profile | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const profile = value as Partial<Profile>;
  if (typeof profile.name !== 'string' || validateName(profile.name)) return null;
  if (typeof profile.bio !== 'string' || validateBio(profile.bio)) return null;
  if (typeof profile.avatar !== 'string' || !AVATAR_OPTIONS.some(src => src === profile.avatar)) return null;
  return { name: profile.name.trim(), bio: profile.bio.trim(), avatar: profile.avatar };
}

function parseProfile(raw: string | null): Profile {
  try {
    return raw ? validateProfile(JSON.parse(raw)) ?? DEFAULT_PROFILE : DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

// One in-memory snapshot keeps personal and wallet views in sync, even when
// localStorage is unavailable. The server snapshot is never changed.
const serverSnapshot = { profile: DEFAULT_PROFILE, hydrated: false };
let snapshot = serverSnapshot;
let initialized = false;
const listeners = new Set<() => void>();

function publishProfile(profile: Profile) {
  snapshot = { profile, hydrated: true };
  listeners.forEach(listener => listener());
}

function onStorage(event: StorageEvent) {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    if (event.storageArea !== window.localStorage) return;
  } catch {
    return;
  }
  publishProfile(parseProfile(event.newValue));
}

function subscribe(listener: () => void) {
  if (!initialized) {
    initialized = true;
    let profile = DEFAULT_PROFILE;
    try {
      profile = parseProfile(window.localStorage.getItem(STORAGE_KEY));
    } catch {
      // Storage restrictions still allow an in-memory profile for this page.
    }
    snapshot = { profile, hydrated: true };
  }
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

function saveProfile(next: Profile): ProfileSaveResult {
  const valid = validateProfile(next);
  if (!valid) return 'invalid';
  let result: ProfileSaveResult = 'persisted';
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(valid));
  } catch {
    result = 'memory';
  }
  publishProfile(valid);
  return result;
}

function resetProfile(): ProfileSaveResult {
  let result: ProfileSaveResult = 'persisted';
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    result = 'memory';
  }
  publishProfile(DEFAULT_PROFILE);
  return result;
}

export function useLocalProfile() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => serverSnapshot);
  return { ...state, setProfile: saveProfile, resetProfile };
}

type ProfileEditorProps = {
  profile: Profile;
  titleId: string;
  onSave: (next: Profile) => ProfileSaveResult;
  onClose: () => void;
};

export function ProfileEditor({ profile, titleId, onSave, onClose }: ProfileEditorProps) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [errors, setErrors] = useState<{ name?: string | null; bio?: string | null; form?: string }>({});
  const fieldId = useId();
  const previewName = name.trim() || profile.name;

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const nameError = validateName(name);
    const bioError = validateBio(bio);
    if (nameError || bioError) {
      setErrors({ name: nameError, bio: bioError });
      return;
    }
    const result = onSave({ name: name.trim(), bio: bio.trim(), avatar });
    if (result === 'invalid') setErrors({ form: '资料格式有误，请检查后重试。' });
  }

  return (
    <form onSubmit={handleSubmit} className="profile-editor profile-editor-form" noValidate>
      <header className="profile-editor-header">
        <h2 id={titleId}>编辑个人资料</h2>
        <button type="button" className="profile-editor-close" onClick={onClose} aria-label="关闭编辑">✕</button>
      </header>
      <section className="profile-editor-preview" aria-label="资料预览">
        <img className="profile-editor-preview-avatar" src={avatar} alt={`${previewName}的头像预览`} width={56} height={56} />
        <div className="profile-editor-preview-info"><strong>{previewName}</strong><p>{bio.trim() || '还没有写简介'}</p></div>
      </section>
      <fieldset className="profile-editor-fieldset">
        <legend>选择头像</legend>
        <div className="profile-editor-avatar-grid">
          {AVATAR_OPTIONS.map((src, index) => (
            <label key={src} className={`profile-editor-avatar-option ${avatar === src ? 'selected' : ''}`}>
              <input type="radio" name={`${fieldId}-avatar`} value={src} checked={avatar === src} onChange={() => setAvatar(src)} aria-label={`头像 ${index + 1}`} />
              <img src={src} alt="" width={56} height={56} />
              {avatar === src && <span className="profile-editor-avatar-check" aria-hidden="true">✓</span>}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="profile-editor-field">
        <span className="profile-editor-label-text">名字<em>{name.trim().length} / {NAME_MAX}</em></span>
        <input type="text" className="profile-editor-input" value={name} onChange={event => { setName(event.target.value); setErrors(previous => ({ ...previous, name: null, form: undefined })); }} maxLength={NAME_MAX} minLength={NAME_MIN} placeholder="给自己取个名字吧" aria-label="名字" aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? `${fieldId}-name-error` : undefined} required />
        {errors.name && <span id={`${fieldId}-name-error`} className="profile-editor-error" role="alert">{errors.name}</span>}
      </label>
      <label className="profile-editor-field">
        <span className="profile-editor-label-text">简介<em>{bio.length} / {BIO_MAX}</em></span>
        <textarea className="profile-editor-textarea" value={bio} onChange={event => { setBio(event.target.value); setErrors(previous => ({ ...previous, bio: null, form: undefined })); }} maxLength={BIO_MAX} placeholder="写一句话介绍自己" aria-label="简介" aria-invalid={Boolean(errors.bio)} aria-describedby={errors.bio ? `${fieldId}-bio-error` : undefined} rows={3} />
        {errors.bio && <span id={`${fieldId}-bio-error`} className="profile-editor-error" role="alert">{errors.bio}</span>}
      </label>
      {errors.form && <p className="profile-editor-error" role="alert">{errors.form}</p>}
      <p className="profile-editor-hint">资料仅保存在当前浏览器。</p>
      <div className="profile-editor-actions">
        <button type="button" className="profile-editor-cancel" onClick={onClose}>取消</button>
        <button type="submit" className="profile-editor-save">保存</button>
      </div>
    </form>
  );
}
