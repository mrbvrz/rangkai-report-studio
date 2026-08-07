export type Attachment = { id: number; filename: string; original_name: string; mime_type: string; size: number; caption: string }
export type Report = {
  id: number; title: string; report_date: string; content: string; status: 'draft' | 'published';
  project_id: number; project_name: string; project_color: string; source_path?: string; sync_status: 'manual' | 'synced' | 'modified';
  tags: string[]; attachments: Attachment[]; created_at: string; updated_at: string
}
export type SourceFile = { id: number; source_id: number; report_id?: number; file_path: string; relative_path: string; file_mtime: number; status: 'pending' | 'imported' | 'ignored' | 'missing'; change_type: 'new' | 'modified' | 'unchanged' | 'missing'; updated_at: string }
export type ProjectSource = { id: number; project_id: number; folder_path: string; is_watching: number; last_synced_at?: string; last_status: 'idle' | 'success' | 'error'; last_message: string; files: SourceFile[] }
export type Project = { id: number; name: string; description: string; color: string; report_count?: number; source_count?: number; sources?: ProjectSource[] }
export type Template = { id: number; name: string; description: string; content: string; is_default: number }
export type MonthlyReport = { id: number; month: string; title: string; content: string; report_count: number; created_at: string }
