export interface LinkAuditResult {
  url: string;
  text: string;
  status: number | string;
  ok: boolean;
  type: 'internal' | 'external';
}

export interface ButtonAuditResult {
  selector: string;
  text: string;
  tag: 'BUTTON' | 'A' | 'DIV' | 'SPAN' | 'INPUT';
  hasHover: boolean;
  isClickableAreaOk: boolean; // Bounding box validation
  issues?: string[];
}

export interface ConsoleMessageResult {
  type: string;
  text: string;
  location?: string;
}

export interface LighthouseResult {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
}

export interface AuditReport {
  id: string;
  url: string;
  timestamp: string;
  lighthouse: LighthouseResult;
  links: {
    total: number;
    broken: number;
    items: LinkAuditResult[];
  };
  buttons: {
    total: number;
    broken: number;
    items: ButtonAuditResult[];
  };
  consoleErrors: ConsoleMessageResult[];
  screenshots: {
    desktop?: string; // base64
    mobile?: string;  // base64
  };
  advice?: string; // OpenRouter Markdown output
  overallScore: number; // 0-100 summary
}
