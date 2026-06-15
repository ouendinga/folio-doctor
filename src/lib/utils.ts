/**
 * Simple markdown parser to convert basic markdown (headings, bold, lists)
 * into safe HTML strings to avoid importing large libraries.
 */
export function markdownToHtml(md: string): string {
  if (!md) return '';

  let html = md
    // Escape HTML tags to prevent XSS
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>');
  
  // Lists
  html = html.replace(/^\* (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul>\s*<ul>/gim, ''); // merge lists

  html = html.replace(/^(\d+)\. (.*$)/gim, '<ol><li>$2</li></ol>');
  html = html.replace(/<\/ol>\s*<ol>/gim, ''); // merge lists

  // Line breaks / paragraphs
  const lines = html.split('\n');
  const processedLines = lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<br/>';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<u') || trimmed.startsWith('<o') || trimmed.startsWith('<l') || trimmed.startsWith('<b')) {
      return line;
    }
    return `<p>${line}</p>`;
  });

  return processedLines.join('\n');
}

/**
 * Normalizes scores for styling colors
 */
export function getScoreColorClass(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 90) return 'green';
  if (score >= 50) return 'yellow';
  return 'red';
}

/**
 * Normalizes scores for main health badge
 */
export function getHealthStatusClass(score: number): 'healthy' | 'warning' | 'danger' {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'warning';
  return 'danger';
}
