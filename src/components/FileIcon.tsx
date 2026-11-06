import React from 'react';
import {
  Folder,
  FileText,
  FileCode,
  FileArchive,
  FileImage,
  FileVideo,
  FileAudio,
  File,
} from 'lucide-react';
import { getFileCategory } from '../utils/format';

interface FileIconProps {
  extension: string;
  isDir: boolean;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({ extension, isDir, className = 'w-6 h-6' }) => {
  const category = getFileCategory(extension, isDir);

  if (category === 'folder') {
    return <Folder className={`${className} text-amber-500 fill-amber-500/20`} />;
  }

  switch (category) {
    case 'image':
      return <FileImage className={`${className} text-emerald-500`} />;
    case 'video':
      return <FileVideo className={`${className} text-purple-500`} />;
    case 'audio':
      return <FileAudio className={`${className} text-pink-500`} />;
    case 'document':
      return <FileText className={`${className} text-blue-500`} />;
    case 'archive':
      return <FileArchive className={`${className} text-orange-500`} />;
    case 'code':
      return <FileCode className={`${className} text-cyan-500`} />;
    default:
      return <File className={`${className} text-slate-400`} />;
  }
};
