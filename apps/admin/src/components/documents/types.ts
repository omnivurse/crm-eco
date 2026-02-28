export interface DocFolder {
  id: string;
  org_id: string;
  parent_id: string | null;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_favorite?: boolean;
}

export interface Document {
  id: string;
  org_id: string;
  folder_id: string | null;
  name: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  current_version: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_favorite?: boolean;
}

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  storage_path: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface DocumentLink {
  id: string;
  org_id: string;
  document_id: string;
  token: string;
  expires_at: string | null;
  max_downloads: number | null;
  download_count: number;
  created_by: string | null;
  created_at: string;
}

export interface DocumentAuditEntry {
  id: number;
  org_id: string;
  document_id: string | null;
  folder_id: string | null;
  user_id: string;
  action: string;
  meta: Record<string, unknown>;
  created_at: string;
  profiles?: { full_name: string | null };
}

export type SortField = 'name' | 'size_bytes' | 'updated_at' | 'created_at';
export type SortDir = 'asc' | 'desc';
export type ViewMode = 'list' | 'grid';
export type ActiveTab = 'files' | 'favorites' | 'trash' | 'audit';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}
