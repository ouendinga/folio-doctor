'use client';

import { useState, useEffect } from 'react';
import { AuditReport } from '@/lib/types';
import { markdownToHtml, getScoreColorClass, getHealthStatusClass } from '@/lib/utils';

export default function Home() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AuditReport | null>(null);

  const progressMessages = [
    'Estabilizando paciente e ingresando datos...',
    'Rastreando enlaces e interactividad con Playwright (esto tarda unos segundos)...',
    'Escaneando métricas de rendimiento y accesibilidad Lighthouse...',
    'Consultando al cirujano IA (OpenRouter) para el diagnóstico y receta...',
    'Generando informe médico definitivo...'
  ];

  // Animate progress steps when loading
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (loading) {
      setProgressStep(0);
      interval = setInterval(() => {
        setProgressStep((prev) => {
          if (prev < progressMessages.length - 1) {
            return prev + 1;
          }
          return prev;
        });
      }, 5000); // Shift step every 5 seconds
    } else {
      setProgressStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const handleAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Ocurrió un error al analizar el portafolio.');
      }

      const reportData: AuditReport = await res.json();
      setReport(reportData);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Error de red o timeout. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setReport(null);
    setUrl('');
    setError(null);
  };

  const exportMarkdown = () => {
    if (!report) return;
    
    const markdownContent = `
# Informe Clínico de Portafolio: ${new URL(report.url).hostname}

- **URL del Paciente**: ${report.url}
- **Fecha de Chequeo**: ${new Date(report.timestamp).toLocaleString('es-ES')}
- **Puntuación de Salud**: ${report.overallScore}/100
- **Lighthouse Scores**:
  - Rendimiento: ${report.lighthouse.performance}/100
  - Accesibilidad: ${report.lighthouse.accessibility}/100
  - Buenas Prácticas: ${report.lighthouse.bestPractices}/100
  - SEO: ${report.lighthouse.seo}/100

---

${report.advice || 'No se generaron recomendaciones.'}

---
*Reporte generado por FolioDoctor.*
`;

    const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8;' });
    const urlBlob = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = urlBlob;
    link.setAttribute('download', `foliodoctor-reporte-${new URL(report.url).hostname}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <header>
        <div className="header-container">
          <div className="logo">
            <span>🩺</span> FolioDoctor
          </div>
          <div className="nav-links">
            <a href="https://github.com/ouendinga/folio-doctor" target="_blank" rel="noopener noreferrer">
              GitHub Repo
            </a>
          </div>
        </div>
      </header>

      <main>
        {!report && !loading && (
          <section className="hero">
            <h1>Diagnóstico Clínico de Portafolios</h1>
            <p>
              Evalúa la salud de tu portafolio web de inmediato. Detecta enlaces rotos,
              botones inaccesibles, fallas de Lighthouse y recibe una receta personalizada generada por IA.
            </p>

            <div className="audit-form-container">
              <form onSubmit={handleAudit} className="form-group">
                <input
                  type="text"
                  placeholder="https://tuportafolio.dev"
                  className="url-input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  disabled={loading}
                  required
                />
                <button type="submit" className="submit-btn" disabled={loading || !url}>
                  Ingresar Paciente
                </button>
              </form>
              {error && (
                <div style={{ color: 'var(--color-red)', marginTop: '1rem', fontWeight: 600 }}>
                  ⚠️ Error: {error}
                </div>
              )}
            </div>
          </section>
        )}

        {loading && (
          <div className="loading-container">
            <div className="pulse-wrapper">
              <div className="pulse-ring"></div>
              <div className="heartbeat-icon">❤️</div>
            </div>
            <div className="loading-text">
              <h3>Realizando Chequeo Médico</h3>
              <p style={{ marginTop: '0.5rem', color: 'var(--color-cyan)', fontWeight: 600 }}>
                {progressMessages[progressStep]}
              </p>
            </div>
          </div>
        )}

        {report && !loading && (
          <div className="report-container">
            {/* Header / Patient Summary Card */}
            <div className="clinic-header-card">
              <div className="patient-info">
                <h2>Historial Clínico: {new URL(report.url).hostname}</h2>
                <p><strong>Paciente URL:</strong> <a href={report.url} target="_blank" style={{ color: 'var(--color-cyan)' }} rel="noreferrer">{report.url}</a></p>
                <p className="timestamp">
                  Analizado el: {new Date(report.timestamp).toLocaleString('es-ES')}
                </p>
                <div className="button-group" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                  <button onClick={handleReset} className="submit-btn no-print" style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'white' }}>
                    💉 Alta Médica
                  </button>
                  <button onClick={exportMarkdown} className="submit-btn no-print" style={{ background: 'rgba(79, 172, 254, 0.15)', border: '1px solid var(--color-blue)', color: 'var(--color-blue)' }}>
                    📄 Descargar Receta (.md)
                  </button>
                  <button onClick={() => window.print()} className="submit-btn no-print" style={{ background: 'rgba(0, 242, 254, 0.15)', border: '1px solid var(--color-cyan)', color: 'var(--color-cyan)' }}>
                    🖨️ Guardar PDF (.pdf)
                  </button>
                </div>
              </div>

              <div className={`health-score-ring ${getHealthStatusClass(report.overallScore)}`}>
                <div className="health-score-value">
                  {report.overallScore}
                  <span>Salud</span>
                </div>
              </div>
            </div>

            {/* Score Grid (Lighthouse Metrics) */}
            <div className="score-grid">
              <div className="score-card">
                <h3>Rendimiento</h3>
                <div className={`score ${getScoreColorClass(report.lighthouse.performance)}`}>
                  {report.lighthouse.performance}
                </div>
              </div>
              <div className="score-card">
                <h3>Accesibilidad</h3>
                <div className={`score ${getScoreColorClass(report.lighthouse.accessibility)}`}>
                  {report.lighthouse.accessibility}
                </div>
              </div>
              <div className="score-card">
                <h3>Buenas Prácticas</h3>
                <div className={`score ${getScoreColorClass(report.lighthouse.bestPractices)}`}>
                  {report.lighthouse.bestPractices}
                </div>
              </div>
              <div className="score-card">
                <h3>SEO</h3>
                <div className={`score ${getScoreColorClass(report.lighthouse.seo)}`}>
                  {report.lighthouse.seo}
                </div>
              </div>
            </div>

            {/* Twin Columns for Details & Receta */}
            <div className="report-columns">
              {/* Recipe/AI Advice */}
              <div className="clinical-recipe">
                <h2>🩺 Receta y Prescripción Médica (IA)</h2>
                {report.advice ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: markdownToHtml(report.advice) }}
                  />
                ) : (
                  <p>Cargando prescripción del médico...</p>
                )}
              </div>

              {/* Physical Diagnostics Checklist */}
              <div className="details-column">
                {/* Links Checking */}
                <div className="detail-section-card">
                  <h2>
                    Enlaces Rastreados
                    <span className={`badge ${report.links.broken > 0 ? 'red' : 'green'}`}>
                      {report.links.broken} rotos
                    </span>
                  </h2>
                  <div className="detail-list">
                    {report.links.items.map((link, idx) => (
                      <div className="detail-item" key={idx}>
                        <div className="title">"{link.text || 'Sin Texto'}"</div>
                        <div className="subtitle">{link.url}</div>
                        <div className={`status-indicator ${link.ok ? 'success' : 'failure'}`}>
                          {link.ok ? '✅ Activo (Status ' + link.status + ')' : '❌ Roto (Status ' + link.status + ')'}
                        </div>
                      </div>
                    ))}
                    {report.links.items.length === 0 && (
                      <div className="text-secondary">No se detectaron enlaces en la página.</div>
                    )}
                  </div>
                </div>

                {/* Buttons Checking */}
                <div className="detail-section-card">
                  <h2>
                    Interactividad y CTAs
                    <span className={`badge ${report.buttons.items.some(b => !b.isClickableAreaOk) ? 'red' : 'green'}`}>
                      {report.buttons.items.filter(b => !b.isClickableAreaOk).length} con alertas
                    </span>
                  </h2>
                  <div className="detail-list">
                    {report.buttons.items.map((btn, idx) => (
                      <div className="detail-item" key={idx}>
                        <div className="title">
                          <code>&lt;{btn.tag}&gt;</code>: "{btn.text}"
                        </div>
                        {btn.issues && btn.issues.length > 0 && (
                          <div className="subtitle" style={{ color: 'var(--color-yellow)' }}>
                            {btn.issues.join(' ')}
                          </div>
                        )}
                        <div className={`status-indicator ${btn.isClickableAreaOk ? 'success' : 'failure'}`}>
                          {btn.isClickableAreaOk ? '✅ Área Clicable Correcta' : '⚠️ Área Clicable Pequeña'}
                        </div>
                        <span style={{ marginLeft: '1rem', fontSize: '0.75rem', color: btn.hasHover ? 'var(--color-green)' : 'var(--color-yellow)' }}>
                          {btn.hasHover ? '• Hover Activo' : '• Sin Hover'}
                        </span>
                      </div>
                    ))}
                    {report.buttons.items.length === 0 && (
                      <div className="text-secondary">No se detectaron botones o elementos CTA.</div>
                    )}
                  </div>
                </div>

                {/* Console Log Errors */}
                <div className="detail-section-card">
                  <h2>
                    Consola del Navegador
                    <span className={`badge ${report.consoleErrors.length > 0 ? 'red' : 'green'}`}>
                      {report.consoleErrors.length} errores
                    </span>
                  </h2>
                  <div className="detail-list">
                    {report.consoleErrors.map((err, idx) => (
                      <div className="detail-item" key={idx}>
                        <div className="title" style={{ color: 'var(--color-red)' }}>
                          [{err.type}] {err.text}
                        </div>
                        {err.location && <div className="subtitle">{err.location}</div>}
                      </div>
                    ))}
                    {report.consoleErrors.length === 0 && (
                      <div className="text-secondary" style={{ color: 'var(--color-green)' }}>
                        ✅ Cero errores de JavaScript en consola durante el rastreo.
                      </div>
                    )}
                  </div>
                </div>

                {/* Capturas de Pantalla */}
                {(report.screenshots.desktop || report.screenshots.mobile) && (
                  <div className="detail-section-card">
                    <h2>Capturas Clínicas (Responsive)</h2>
                    <div className="screenshots-container">
                      {report.screenshots.desktop && (
                        <div className="screenshot-box">
                          <span>Escritorio (1280px)</span>
                          <img src={report.screenshots.desktop} alt="Vista Escritorio" />
                        </div>
                      )}
                      {report.screenshots.mobile && (
                        <div className="screenshot-box">
                          <span>Móvil (375px)</span>
                          <img src={report.screenshots.mobile} alt="Vista Móvil" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer>
        <p>
          &copy; {new Date().getFullYear()} FolioDoctor. Hecho con el ejemplo clínico por{' '}
          <a href="https://github.com/ouendinga" target="_blank" rel="noopener noreferrer">
            Álvaro Solís (ouendinga)
          </a>
          .
        </p>
      </footer>
    </>
  );
}
