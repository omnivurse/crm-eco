import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../providers/AuthProvider';
import { Plus, Key, ExternalLink, Trash2, Shield, Lock, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PasswordRef {
  id: string;
  provider: string;
  item_ref: string;
  label: string;
  vault_url: string | null;
  metadata: any;
  created_at: string;
}

export function PasswordVaultPage() {
  const { user } = useAuth();
  const [refs, setRefs] = useState<PasswordRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRef, setNewRef] = useState({
    provider: 'onepassword',
    item_ref: '',
    label: '',
    vault_url: ''
  });

  useEffect(() => {
    if (user) {
      loadPasswordRefs();
    }
  }, [user]);

  async function loadPasswordRefs() {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('password_refs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setRefs(data);
    } catch (error) {
      console.error('Error loading password refs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addPasswordRef() {
    if (!user || !newRef.label || !newRef.item_ref) return;

    try {
      const { error } = await supabase
        .from('password_refs')
        .insert({
          user_id: user.id,
          provider: newRef.provider,
          item_ref: newRef.item_ref,
          label: newRef.label,
          vault_url: newRef.vault_url || null
        });

      if (error) throw error;

      setShowAddModal(false);
      setNewRef({
        provider: 'onepassword',
        item_ref: '',
        label: '',
        vault_url: ''
      });
      await loadPasswordRefs();
    } catch (error) {
      console.error('Error adding password ref:', error);
    }
  }

  async function deletePasswordRef(id: string) {
    if (!confirm('Are you sure you want to remove this password reference?')) return;

    try {
      const { error } = await supabase
        .from('password_refs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadPasswordRefs();
    } catch (error) {
      console.error('Error deleting password ref:', error);
    }
  }

  function getProviderIcon(provider: string) {
    switch (provider) {
      case 'onepassword':
        return '🔑';
      case 'bitwarden':
        return '🔐';
      case 'vault':
        return '🏦';
      default:
        return '🔒';
    }
  }

  function getProviderName(provider: string) {
    switch (provider) {
      case 'onepassword':
        return '1Password';
      case 'bitwarden':
        return 'Bitwarden';
      case 'vault':
        return 'HashiCorp Vault';
      default:
        return provider;
    }
  }

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
        className="hero-security text-white py-20 px-6"
      >
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-5 mb-8"
          >
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{
                duration: 4,
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="p-5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20"
            >
              <Shield size={52} className="text-white" />
            </motion.div>
            <div>
              <h1 className="text-6xl font-black mb-2 tracking-tight">Password Vault</h1>
              <p className="text-2xl text-cyan-100 font-medium">Securely reference passwords from your vault</p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="stat-card"
          >
            <div className="flex gap-3 relative z-10">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400 flex-shrink-0 mt-0.5 floating" />
              <div className="text-sm">
                <p className="font-semibold mb-1 text-orange-600 dark:text-orange-400">Security Notice</p>
                <p className="text-neutral-600 dark:text-neutral-400">This system only stores references to your vault items, never the actual passwords. Click the vault links to open items in your password manager app.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto px-6 py-12 space-y-6">
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Saved References</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="neon-button"
            >
              <Plus className="h-5 w-5 inline-block mr-2" />
              Add Reference
            </button>
          </div>

          {refs.length === 0 ? (
            <div className="p-12 text-center rounded-xl">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.5 }}
              >
                <Key className="h-24 w-24 text-teal-400 mx-auto mb-6 floating" />
              </motion.div>
              <h3 className="text-2xl font-bold text-neutral-900 dark:text-white mb-3">No password references yet</h3>
              <p className="text-neutral-600 dark:text-neutral-400 mb-8 max-w-md mx-auto">
                Add references to your vault items for quick access
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="neon-button inline-flex"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Reference
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {refs.map((ref, index) => (
              <motion.div
                key={ref.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="glass-card p-6 hover:scale-105 transition-all group"
                whileHover={{ y: -4 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-gradient-to-br from-teal-500/20 to-primary-900/20 rounded-lg text-2xl">
                      {getProviderIcon(ref.provider)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-neutral-900 dark:text-white group-hover:text-teal-500 transition-colors">{ref.label}</h3>
                      <p className="text-xs modern-badge bg-gradient-to-r from-teal-500/20 to-primary-900/20 text-teal-600 dark:text-teal-400 mt-1">{getProviderName(ref.provider)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => deletePasswordRef(ref.id)}
                    className="p-2 text-accent-500 hover:text-accent-600 hover:bg-accent-500/10 rounded-lg transition-all"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4 p-3 bg-gradient-to-br from-neutral-500/5 to-neutral-500/10 rounded-lg">
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1 font-semibold">Item Reference</p>
                  <p className="text-sm font-mono text-neutral-700 dark:text-neutral-300 break-all">{ref.item_ref}</p>
                </div>

                {ref.vault_url && (
                  <a
                    href={ref.vault_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-teal-500/10 to-primary-900/10 text-teal-600 dark:text-teal-400 rounded-xl hover:from-teal-500/20 hover:to-primary-900/20 transition-all text-sm font-medium group-hover:scale-105"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in Vault
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card max-w-md w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10">
                <h2 className="text-xl font-bold text-neutral-900 dark:text-white">Add Password Reference</h2>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Vault Provider
                  </label>
                  <select
                    value={newRef.provider}
                    onChange={(e) => setNewRef({ ...newRef, provider: e.target.value })}
                    className="w-full px-3 py-2 glass-card border-0 focus:ring-2 focus:ring-teal-500 dark:text-white"
                  >
                    <option value="onepassword">1Password</option>
                    <option value="bitwarden">Bitwarden</option>
                    <option value="vault">HashiCorp Vault</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Label
                  </label>
                  <input
                    type="text"
                    value={newRef.label}
                    onChange={(e) => setNewRef({ ...newRef, label: e.target.value })}
                    placeholder="e.g., Production Database"
                    className="w-full px-3 py-2 glass-card border-0 focus:ring-2 focus:ring-teal-500 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Item Reference / UUID
                  </label>
                  <input
                    type="text"
                    value={newRef.item_ref}
                    onChange={(e) => setNewRef({ ...newRef, item_ref: e.target.value })}
                    placeholder="uuid-from-vault-item"
                    className="w-full px-3 py-2 glass-card border-0 focus:ring-2 focus:ring-teal-500 dark:text-white"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    The UUID or item identifier from your vault (NOT the password)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    Vault Deep Link (Optional)
                  </label>
                  <input
                    type="text"
                    value={newRef.vault_url}
                    onChange={(e) => setNewRef({ ...newRef, vault_url: e.target.value })}
                    placeholder="onepassword://..."
                    className="w-full px-3 py-2 glass-card border-0 focus:ring-2 focus:ring-teal-500 dark:text-white"
                  />
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 glass-card hover:bg-white/10 text-neutral-700 dark:text-neutral-300 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={addPasswordRef}
                  disabled={!newRef.label || !newRef.item_ref}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-teal-500 to-primary-900 text-white rounded-xl hover:from-teal-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed glow-effect"
                >
                  Add Reference
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
