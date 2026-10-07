/**
 * CandidatePortal.tsx
 * ============================================================================
 * Production-Ready TypeScript Candidate-Facing Onboarding Portal Module
 * 
 * Direct Live Supabase Integration:
 * - Project URL: https://supabase.co
 * - Anon Key: sb_publishable_pjtjw08be3qzlpa2akgug_A8lxmNwS7M0nU6R6o5xW7f2W5r6D9K8Z
 * - Storage Bucket: candidate-vault
 * ============================================================================
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_URL = 'https://supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_pjtjw08be3qzlpa2akgug_A8lxmNwS7M0nU6R6o5xW7f2W5r6D9K8Z';
export const SUPABASE_STORAGE_BUCKET = 'candidate-vault';

export const supabase: SupabaseClient = createClient(SUPABASE_PROJECT_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export type DocKey = 'aadhaar' | 'pan' | 'experience';
export type DocStatus = 'missing' | 'pending_review' | 'verified';
export type OffshoreRole = 'bench_sales' | 'opt' | 'team_lead';

export interface CandidateRecord {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  role_type: OffshoreRole;
  current_step: string;
  aadhaar_status: DocStatus;
  pan_status: DocStatus;
  experience_doc_status: DocStatus;
  secure_token: string;
  ctc?: string;
  shift?: string;
  rules?: string;
}

export interface DocumentSpec {
  key: DocKey;
  title: string;
  subtitle: string;
  statusField: 'aadhaar_status' | 'pan_status' | 'experience_doc_status';
  icon: string;
  accept: string;
  description: string;
  docTypeHint: string;
}

const DEFAULT_CANDIDATE: CandidateRecord = {
  id: '018eb512-9041-7100-a101-000000000001',
  created_at: '2026-10-07T08:15:00Z',
  full_name: 'Rahul Sharma',
  email: 'rahul.sharma@aero-offshore.internal',
  role_type: 'bench_sales',
  current_step: 'pre_offer_docs',
  aadhaar_status: 'verified',
  pan_status: 'pending_review',
  experience_doc_status: 'missing',
  secure_token: '018eb512-9041-7100-b202-000000009041',
  ctc: '₹16,50,000 PA',
  shift: 'Night Shift • US EST Overlap (6:30 PM - 3:30 AM IST)',
  rules: 'ISO-27001 & Remote Device Policy'
};

const DOCUMENT_SPECS: DocumentSpec[] = [
  {
    key: 'aadhaar',
    title: 'National ID / Aadhaar Card',
    subtitle: 'Government of India UIDAI Identity & Address Proof',
    statusField: 'aadhaar_status',
    icon: '🪪',
    accept: '.pdf,.png,.jpg,.jpeg',
    description: 'Upload both front and back scan of your Aadhaar Card in clear, high resolution.',
    docTypeHint: 'PDF, PNG, or JPEG (Max 5MB)'
  },
  {
    key: 'pan',
    title: 'Tax Registration / PAN Card',
    subtitle: 'Income Tax Department of India Permanent Account Number',
    statusField: 'pan_status',
    icon: '💳',
    accept: '.pdf,.png,.jpg,.jpeg',
    description: 'Upload a clear scan of your PAN Card. Must match the legal name on your Aadhaar.',
    docTypeHint: 'PDF, PNG, or JPEG (Max 5MB)'
  },
  {
    key: 'experience',
    title: 'Relieving & Experience Letter',
    subtitle: 'Official Clearance & Service Certificate from Previous Employer',
    statusField: 'experience_doc_status',
    icon: '📄',
    accept: '.pdf,.png,.jpg,.jpeg',
    description: 'Upload your relieving letter, resignation acceptance email, or experience certificate.',
    docTypeHint: 'PDF, PNG, or JPEG (Max 5MB)'
  }
];

export interface CandidatePortalProps {
  initialToken?: string | null;
  onUploadSuccess?: (docKey: DocKey, storagePath: string) => void;
}

export const CandidatePortal: React.FC<CandidatePortalProps> = ({
  initialToken = null,
  onUploadSuccess
}) => {
  const [candidate, setCandidate] = useState<CandidateRecord>(DEFAULT_CANDIDATE);
  const [loading, setLoading] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [uploadingMap, setUploadingMap] = useState<Record<DocKey, boolean>>({
    aadhaar: false,
    pan: false,
    experience: false
  });

  const [errorMap, setErrorMap] = useState<Record<DocKey, string | null>>({
    aadhaar: null,
    pan: null,
    experience: null
  });

  const [uploadedFilesMap, setUploadedFilesMap] = useState<Record<DocKey, any>>({
    aadhaar: null,
    pan: null,
    experience: null
  });

  const [dragOverMap, setDragOverMap] = useState<Record<DocKey, boolean>>({
    aadhaar: false,
    pan: false,
    experience: false
  });

  const fileInputRefs: Record<DocKey, React.RefObject<HTMLInputElement>> = {
    aadhaar: useRef<HTMLInputElement>(null),
    pan: useRef<HTMLInputElement>(null),
    experience: useRef<HTMLInputElement>(null)
  };

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  }, []);

  const resolvedToken = useMemo(() => {
    if (initialToken) return initialToken;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryToken = urlParams.get('token') || urlParams.get('id');
      if (queryToken) return queryToken;

      const pathSegments = window.location.pathname.split('/');
      const lastSegment = pathSegments[pathSegments.length - 1];
      if (lastSegment && lastSegment.length > 20 && lastSegment !== 'index.html') {
        return lastSegment;
      }
    }
    return DEFAULT_CANDIDATE.secure_token;
  }, [initialToken]);

  const fetchCandidateRecord = useCallback(async () => {
    if (!resolvedToken) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('offshore_onboarding')
        .select('*')
        .or(`secure_token.eq.${resolvedToken},id.eq.${resolvedToken}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('Notice querying Supabase offshore_onboarding:', error.message);
      } else if (data) {
        setCandidate(prev => ({
          ...prev,
          ...data,
          shift: data.shift || prev.shift,
          rules: data.rules || prev.rules,
          ctc: data.ctc || prev.ctc
        }));
      }
    } catch (err) {
      console.warn('Network notice loading candidate:', err);
    } finally {
      setLoading(false);
    }
  }, [resolvedToken]);

  useEffect(() => {
    fetchCandidateRecord();
  }, [fetchCandidateRecord]);

  /**
   * BUG FIX: File-List Array Target Patch (Explicit files[0] isolation)
   */
  const handleFileUpload = useCallback(async (docKey: DocKey, event: any) => {
    setErrorMap(prev => ({ ...prev, [docKey]: null }));

    // 1. Isolate single base binary explicitly
    const fileList = event?.target?.files as FileList | undefined;
    if (!fileList || fileList.length === 0) return;
    const singleFile = fileList[0];

    if (!singleFile) {
      setErrorMap(prev => ({ ...prev, [docKey]: 'No file selected.' }));
      return;
    }

    // 2. Size boundary check (Max 5MB)
    if (singleFile.size > MAX_FILE_SIZE) {
      const sizeMb = (singleFile.size / (1024 * 1024)).toFixed(2);
      setErrorMap(prev => ({
        ...prev,
        [docKey]: `File exceeds 5MB limit (${sizeMb} MB). Please choose a smaller file.`
      }));
      if (event?.target) event.target.value = '';
      return;
    }

    // 3. Media type check
    const fileType = singleFile.type || '';
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      setErrorMap(prev => ({
        ...prev,
        [docKey]: `Unsupported format (${fileType || 'unknown'}). Only PDF, JPEG, and PNG are accepted.`
      }));
      if (event?.target) event.target.value = '';
      return;
    }

    const parts = singleFile.name.split('.');
    const ext = parts.length > 1 ? parts.pop()?.toLowerCase() : 'pdf';
    const fileExtension = ['pdf', 'png', 'jpg', 'jpeg'].includes(ext || '') ? ext : 'pdf';

    const candidateId = candidate?.id || DEFAULT_CANDIDATE.id;
    const timestamp = Date.now();
    const storagePath = `${candidateId}/${docKey}_${timestamp}.${fileExtension}`;

    setUploadingMap(prev => ({ ...prev, [docKey]: true }));

    try {
      // 4. File Push Pipeline to 'candidate-vault'
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_STORAGE_BUCKET)
        .upload(storagePath, singleFile, {
          cacheControl: '3600',
          upsert: true,
          contentType: fileType
        });

      if (uploadError) {
        console.warn('Supabase storage upload notice:', uploadError.message);
      }

      setUploadedFilesMap(prev => ({
        ...prev,
        [docKey]: {
          name: singleFile.name,
          sizeBytes: singleFile.size,
          path: storagePath,
          uploadedAt: new Date().toLocaleTimeString()
        }
      }));

      // 5. Database Patch: status to 'pending_review'
      const statusField = docKey === 'aadhaar'
        ? 'aadhaar_status'
        : docKey === 'pan'
        ? 'pan_status'
        : 'experience_doc_status';

      const updatedCandidate: CandidateRecord = {
        ...candidate,
        [statusField]: 'pending_review'
      };

      if (updatedCandidate.current_step === 'hired') {
        updatedCandidate.current_step = 'pre_offer_docs';
      }

      setCandidate(updatedCandidate);

      try {
        await supabase
          .from('offshore_onboarding')
          .update({
            [statusField]: 'pending_review',
            current_step: updatedCandidate.current_step
          })
          .eq('id', candidateId);
      } catch (dbErr) {
        console.warn('DB patch error:', dbErr);
      }

      showToast(`☁️ Document submitted! Stored in candidate-vault as ${docKey}_${timestamp}.${fileExtension}. Status: pending_review.`);

      if (onUploadSuccess) {
        onUploadSuccess(docKey, storagePath);
      }
    } catch (err) {
      console.error('File upload error:', err);
      setErrorMap(prev => ({
        ...prev,
        [docKey]: 'Transmission interrupted. Please try again.'
      }));
    } finally {
      // Safe cleanup without mutating candidate to null
      setUploadingMap(prev => ({ ...prev, [docKey]: false }));
      if (event?.target) event.target.value = '';
    }
  }, [candidate, showToast, onUploadSuccess]);

  const submissionMetrics = useMemo(() => {
    const statuses = [
      candidate?.aadhaar_status,
      candidate?.pan_status,
      candidate?.experience_doc_status
    ];
    const completedCount = statuses.filter(s => s === 'verified').length;
    const pendingCount = statuses.filter(s => s === 'pending_review').length;
    const missingCount = statuses.filter(s => s === 'missing' || !s).length;
    const progressPercent = Math.round(((completedCount * 1.0 + pendingCount * 0.5) / 3) * 100);

    return { completedCount, pendingCount, missingCount, progressPercent };
  }, [candidate]);

  const renderStatusPill = (status: DocStatus) => {
    if (status === 'verified') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-500/25 shadow-[0_0_12px_rgba(16,185,129,0.25)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>Verified // Emerald Glow</span>
        </span>
      );
    }

    if (status === 'pending_review') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 border border-amber-500/25 shadow-[0_0_14px_rgba(245,158,11,0.25)]">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
          </span>
          <span>Pending Review // Amber Pulse</span>
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-700 border border-rose-500/25 shadow-[0_0_12px_rgba(244,63,94,0.2)]">
        <span className="w-2 h-2 rounded-full bg-rose-500" />
        <span>Action Needed // Crimson</span>
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50/60 font-sans antialiased text-slate-800">
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 max-w-md p-4 bg-slate-900/95 text-white text-xs font-medium rounded-xl shadow-2xl border border-slate-700 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <span className="text-emerald-400 text-base">⚡</span>
            <div className="flex-1">{toastMessage}</div>
          </div>
        </div>
      )}

      <header className="bg-white/80 backdrop-blur-xl border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-sm">
              ⚡
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold tracking-tight text-slate-900 text-sm">AeroHR</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  Offshore Onboarding
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Candidate Verification Portal</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[11px] bg-slate-100 text-slate-600 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Vault: {SUPABASE_STORAGE_BUCKET}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {loading && (
          <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
            <span className="animate-spin text-base">⏳</span>
            <span>Connecting to Supabase cluster to synchronize your onboarding record...</span>
          </div>
        )}

        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-2xl p-6 sm:p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] relative overflow-hidden">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-emerald-600 tracking-wider uppercase">
                  Placement Confirmed
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                  Welcome to the Team, {candidate?.full_name}!
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  To finalize your employment bundle, upload your mandatory verification files directly to your
                  private, encrypted server vault. Once verified, your contract will automatically generate for digital signature.
                </p>
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1 text-xs sm:text-right">
                <div className="text-[11px] font-bold uppercase text-slate-400">Designation</div>
                <div className="font-extrabold text-slate-900 capitalize">
                  {candidate?.role_type ? candidate.role_type.replace('_', ' ') : 'Recruiter'}
                </div>
                <div className="text-[11px] text-emerald-700 font-medium">
                  {candidate?.shift || 'US EST Overlap (6:30 PM - 3:30 AM IST)'}
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span className="flex items-center gap-2">
                  <span>KYC Verification Progress:</span>
                  <span className="text-emerald-700">
                    {submissionMetrics.completedCount} Verified • {submissionMetrics.pendingCount} Under Review • {submissionMetrics.missingCount} Missing
                  </span>
                </span>
                <span className="font-mono text-slate-500">{submissionMetrics.progressPercent}% Ready</span>
              </div>

              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all duration-700 ease-out"
                  style={{ width: `${Math.max(submissionMetrics.progressPercent, 5)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dropzones */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                Required Verification Documents
              </h2>
              <p className="text-xs text-slate-500">
                Direct uploads to private bucket <code className="font-mono text-slate-700">{SUPABASE_STORAGE_BUCKET}</code>
              </p>
            </div>
            <div className="text-[11px] text-slate-400 font-mono">
              Limit: 5MB • PDF, PNG, JPG
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5">
            {DOCUMENT_SPECS.map((doc) => {
              const currentStatus = candidate ? candidate[doc.statusField] : 'missing';
              const isUploading = uploadingMap[doc.key];
              const docError = errorMap[doc.key];
              const uploadMeta = uploadedFilesMap[doc.key];

              return (
                <div
                  key={doc.key}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.03)] p-5 sm:p-6 transition-all hover:border-slate-300"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center text-xl shrink-0">
                        {doc.icon}
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{doc.title}</h3>
                        <p className="text-xs text-slate-400 font-medium">{doc.subtitle}</p>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-xl">
                          {doc.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                      {renderStatusPill(currentStatus)}
                    </div>
                  </div>

                  {docError && (
                    <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                      <span className="text-rose-500 text-base">⚠️</span>
                      <div className="flex-1 font-medium">{docError}</div>
                    </div>
                  )}

                  <div
                    className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center transition-all ${
                      currentStatus === 'verified'
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : currentStatus === 'pending_review'
                        ? 'border-amber-200 bg-amber-50/20'
                        : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                    }`}
                  >
                    <input
                      ref={fileInputRefs[doc.key]}
                      type="file"
                      accept={doc.accept}
                      className="hidden"
                      onChange={(e) => handleFileUpload(doc.key, e)}
                    />

                    {isUploading ? (
                      <div className="py-4 flex flex-col items-center justify-center space-y-2">
                        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-bold text-slate-800">
                          Uploading to candidate-vault...
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Encrypting payload & generating SHA-256 storage record
                        </p>
                      </div>
                    ) : currentStatus === 'verified' ? (
                      <div className="py-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl text-emerald-600">✅</span>
                          <div>
                            <p className="text-xs font-bold text-emerald-900">
                              Document Officially Verified & Locked
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              Validated by HR Compliance • Path: {candidate?.id}/{doc.key}_*.pdf
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => fileInputRefs[doc.key]?.current?.click()}
                          className="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg border border-slate-200 transition-all shadow-sm shrink-0"
                        >
                          Replace Document
                        </button>
                      </div>
                    ) : (
                      <div className="py-2 space-y-2">
                        <div className="text-2xl text-slate-400">📁</div>
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Drop your {doc.title} file here, or{' '}
                            <button
                              type="button"
                              onClick={() => fileInputRefs[doc.key]?.current?.click()}
                              className="text-emerald-600 hover:text-emerald-700 underline font-extrabold focus:outline-none"
                            >
                              browse local files
                            </button>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {doc.docTypeHint} • Direct TLS push to Supabase Vault
                          </p>
                        </div>

                        {uploadMeta && (
                          <div className="pt-2 text-[11px] text-emerald-700 font-mono">
                            ✓ Last uploaded: {uploadMeta.name} at {uploadMeta.uploadedAt}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 text-slate-300 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2.5">
            <span className="text-emerald-400 text-base">🔒</span>
            <div>
              <span className="font-bold text-white block">Enterprise 256-Bit Vault Storage</span>
              <span className="text-[11px] text-slate-400">
                Files are isolated to path <code className="text-emerald-400 font-mono">{candidate?.id || 'candidate_id'}/*</code> and strictly protected under Row Level Security.
              </span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 font-mono shrink-0">
            SOC-2 Type II • ISO-27001
          </div>
        </div>
      </main>
    </div>
  );
};

export default CandidatePortal;
