import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { Upload, File, Download, Trash2, Eye, HardDrive, FolderOpen, Search, Grid, List } from 'lucide-react';
import { motion } from 'framer-motion';

interface FileRecord {
  id: string;
  filename: string;
  storage_path: string;
  byte_size: number | null;
  mime_type: string | null;
  visibility: string;
  virus_scan_status: string;
  created_at: string;
}

export function FilesPage() {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    if (user) {
      loadFiles();
    }
  }, [user]);

  async function loadFiles() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setFiles(data);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('it_files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from('files')
        .insert({
          owner_id: user.id,
          filename: file.name,
          storage_path: filePath,
          byte_size: file.size,
          mime_type: file.type,
          visibility: 'private'
        });

      if (dbError) throw dbError;

      await loadFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  }

  async function downloadFile(file: FileRecord) {
    try {
      const { data, error } = await supabase.storage
        .from('it_files')
        .download(file.storage_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const filteredFiles = files.filter(file =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalSize = files.reduce((acc, file) => acc + (file.byte_size || 0), 0);
  const recentFiles = files.filter(file => {
    const uploadDate = new Date(file.created_at);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return uploadDate > dayAgo;
  }).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-teal-50 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-900">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="hero-content text-white py-20 px-6"
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <div className="flex items-center justify-between mb-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-5"
            >
              <motion.div
                animate={{
                  y: [0, -10, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
              >
                <HardDrive size={52} className="text-white" />
              </motion.div>
              <div>
                <h1 className="text-6xl font-black mb-2 tracking-tight">Files</h1>
                <p className="text-2xl text-cyan-100 font-medium">Upload and manage your files</p>
              </div>
            </motion.div>
            <motion.label
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-8 py-4 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl transition-all font-semibold border-2 border-white/30 shadow-2xl hover:shadow-white/20 text-lg cursor-pointer"
            >
              <Upload className="h-6 w-6" />
              {uploading ? 'Uploading...' : 'Upload File'}
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </motion.label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Total Files</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{files.length}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center">
                  <FolderOpen className="text-cyan-600 dark:text-cyan-300" size={24} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Storage Used</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{formatFileSize(totalSize)}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-500/20 flex items-center justify-center">
                  <HardDrive className="text-teal-600 dark:text-teal-300" size={24} />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="stat-card"
            >
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <div className="text-sm text-neutral-600 dark:text-neutral-400 mb-1">Recent (24h)</div>
                  <div className="text-3xl font-bold text-neutral-900 dark:text-white">{recentFiles}</div>
                </div>
                <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center">
                  <Upload className="text-orange-600 dark:text-orange-300" size={24} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="glass-card p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 glass-card border-0 focus:ring-2 focus:ring-teal-500 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-teal-500 text-white glow-effect'
                    : 'glass-card hover:bg-white/10'
                }`}
              >
                <Grid className="h-5 w-5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-teal-500 text-white glow-effect'
                    : 'glass-card hover:bg-white/10'
                }`}
              >
                <List className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {files.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Upload className="h-24 w-24 text-teal-400 mx-auto mb-6 floating" />
            </motion.div>
            <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">No files yet</h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto">
              Upload your first file to get started with file management
            </p>
            <label className="neon-button cursor-pointer inline-flex">
              <Upload className="h-5 w-5 mr-2" />
              Upload File
              <input
                type="file"
                onChange={handleFileUpload}
                disabled={uploading}
                className="hidden"
              />
            </label>
          </div>
        ) : filteredFiles.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Search className="h-16 w-16 text-neutral-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-2">No files found</h3>
            <p className="text-neutral-600 dark:text-neutral-400">Try adjusting your search query</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file, index) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-6 hover:scale-105 transition-all cursor-pointer group"
              whileHover={{ y: -4 }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-gradient-to-br from-teal-500/20 to-primary-900/20 rounded-lg">
                  <File className="h-8 w-8 text-teal-500" />
                </div>
                <span className="modern-badge bg-gradient-to-r from-teal-500/20 to-primary-900/20 text-teal-600 dark:text-teal-400 capitalize">
                  {file.visibility}
                </span>
              </div>

              <h3 className="font-semibold text-neutral-900 dark:text-white mb-2 truncate group-hover:text-teal-500 transition-colors">
                {file.filename}
              </h3>

              <div className="flex items-center justify-between text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                <span>{formatFileSize(file.byte_size)}</span>
                <span>{new Date(file.created_at).toLocaleDateString()}</span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => downloadFile(file)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl hover:bg-teal-500/20 transition-all hover:scale-105"
                >
                  <Download className="h-4 w-4" />
                  <span className="text-sm font-medium">Download</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gradient-to-r from-teal-500/10 to-primary-900/10">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Visibility
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Uploaded
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-neutral-700 dark:text-neutral-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {filteredFiles.map((file, index) => (
                  <motion.tr
                    key={file.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <File className="h-5 w-5 text-teal-500" />
                        <span className="text-sm font-medium text-neutral-900 dark:text-white">{file.filename}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {formatFileSize(file.byte_size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="modern-badge bg-gradient-to-r from-teal-500/20 to-primary-900/20 text-teal-600 dark:text-teal-400 capitalize">
                        {file.visibility}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {new Date(file.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => downloadFile(file)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl hover:bg-teal-500/20 transition-all hover:scale-105"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
