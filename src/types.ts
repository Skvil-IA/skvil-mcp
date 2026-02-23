/** Skvil API response types. */

export interface BehavioralFinding {
  syscall: string;
  target: string;
  severity: string;
  description: string;
}

export interface VerifyResponse {
  known: boolean;
  reputation_score?: number;
  total_scans?: number;
  certification?: string | null;
  confirmed_malicious?: boolean;
  risk_summary?: {
    last_score: number;
    last_risk_level: 'safe' | 'caution' | 'danger';
    findings_by_severity: {
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
    };
  };
  crucible?: {
    status: 'clean' | 'suspicious' | 'malicious';
    score: number;
    certified: boolean;
    behavioral_findings: BehavioralFinding[];
    analyzed_at: string;
  } | null;
}

export interface RegisterResponse {
  api_key: string;
  key_prefix: string;
  tier: string;
}

export interface StatsResponse {
  total: number;
  trusted: number;
  critical: number;
  certified: number;
}

export interface CertifiedSkill {
  name: string;
  composite_hash: string;
  level: 'V1' | 'V2' | 'V3' | 'Gold';
  reputation_score: number;
  certified_at: string;
  total_scans: number;
}

export interface ScanFinding {
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  description: string;
  file: string;
  line?: number;
}

export interface ScanPayload {
  name: string;
  composite_hash: string;
  file_count: number;
  file_hashes: Record<string, string>;
  score: number;
  risk_level: 'safe' | 'caution' | 'danger';
  findings: ScanFinding[];
  frontmatter?: Record<string, unknown>;
}

export interface ScanResponse {
  scan_id: number;
  reputation_score: number;
  total_scans: number;
  certification: string | null;
}

export interface ReportResponse {
  report_id: number;
  status: string;
}

export interface ApiError {
  detail: string;
}
