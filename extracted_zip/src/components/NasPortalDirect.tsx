import React, { useState } from 'react';
import {
  Globe,
  ExternalLink,
  Copy,
  Check,
  Eye,
  EyeOff,
  ShieldCheck,
  Server,
  Lock,
  User,
  KeyRound,
  Download,
  Share2,
  HardDrive,
  CheckCircle,
} from 'lucide-react';
import { NasStatus, WebCredentials } from '../types';

interface NasPortalDirectProps {
  nasStatus: NasStatus | null;
  credentials: WebCredentials | null;
}

export const NasPortalDirect: React.FC<NasPortalDirectProps> = ({
  nasStatus,
  credentials,
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const nasUrl = 'http://nas.e1cloud.biz.id:55582/files/';
  const username = credentials?.username || 'admin';
  const password = credentials?.password || 'djoko92m';

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 pb-24 md:pb-8 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-5xl mx-auto space-y-6 sm:space-y-8">
        {/* Banner with Visual Anchor */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-900 border border-slate-800 text-white shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-12 items-stretch">
            {/* Left Content */}
            <div className="md:col-span-7 p-5 sm:p-8 md:p-10 flex flex-col justify-between space-y-4 sm:space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-mono tracking-wider text-emerald-400 uppercase font-semibold">
                    Portal Akses Langsung Aktif
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                  Cloudku @joko92m - Cloud Pribadi
                </h2>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Akses langsung antarmuka asli FileBrowser di server <span className="text-blue-400 font-mono">nas.e1cloud.biz.id:55582</span>. Anda dapat langsung membuka situs ini secara daring dengan akun admin yang telah disediakan.
                </p>
              </div>

              {/* Direct Open Button */}
              <div className="pt-2">
                <a
                  href={nasUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-blue-500/20 group"
                >
                  <Globe className="w-4 h-4 text-blue-200" />
                  <span>Buka Website NAS Langsung</span>
                  <ExternalLink className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
            </div>

            {/* Right Image */}
            <div className="md:col-span-5 relative min-h-[240px] md:min-h-full">
              <img
                src="/src/assets/images/cloud_nas_hardware_1792645541233.jpg"
                alt="Cloud NAS Server"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-slate-900 via-transparent to-transparent opacity-80" />
            </div>
          </div>
        </div>

        {/* Credentials Card & Connection Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* URL Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-4">
                <Server className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Alamat Website NAS
              </div>
              <div className="text-sm font-mono text-slate-800 dark:text-slate-200 break-all select-all font-medium">
                {nasUrl}
              </div>
            </div>
            <button
              onClick={() => handleCopy(nasUrl, 'url')}
              className="mt-4 w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedField === 'url' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Salin Alamat URL</span>
                </>
              )}
            </button>
          </div>

          {/* Username Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-4">
                <User className="w-5 h-5" />
              </div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Username Login
              </div>
              <div className="text-xl font-mono font-bold text-slate-800 dark:text-slate-100">
                {username}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Hak akses: Administrator Penuh</p>
            </div>
            <button
              onClick={() => handleCopy(username, 'user')}
              className="mt-4 w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedField === 'user' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Salin Username</span>
                </>
              )}
            </button>
          </div>

          {/* Password Box */}
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
                <KeyRound className="w-5 h-5" />
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Password Login
                </div>
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="text-xl font-mono font-bold text-slate-800 dark:text-slate-100">
                {showPassword ? password : '••••••••'}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">Password bawaan akun admin</p>
            </div>
            <button
              onClick={() => handleCopy(password, 'pass')}
              className="mt-4 w-full py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors"
            >
              {copiedField === 'pass' ? (
                <>
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-slate-400" />
                  <span>Salin Password</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Access Guides & Protocols */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Metode &amp; Protokol Akses Berkas Daring
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-500" />
                Web Browser Langsung
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Akses melalui Chrome, Safari, atau Firefox dari laptop maupun smartphone tanpa perlu menginstal aplikasi tambahan.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500" />
                Aplikasi Android &amp; iOS
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Gunakan klien FileBrowser atau aplikasi pengelola berkas berkemampuan WebDAV untuk sinkronisasi folder galeri otomatis.
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 space-y-2">
              <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-purple-500" />
                Network Drive (PC &amp; Mac)
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Petakan folder NAS sebagai drive lokal (misalnya Z: di Windows atau Network Share di macOS Finder) untuk transfer cepat.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
