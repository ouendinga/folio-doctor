import { LinkAuditResult, ButtonAuditResult, ConsoleMessageResult, LighthouseResult } from './types';

export async function generateAdvisorAdvice(
  targetUrl: string,
  lighthouse: LighthouseResult,
  links: LinkAuditResult[],
  buttons: ButtonAuditResult[],
  consoleErrors: ConsoleMessageResult[],
  pageText: string
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error('OPENROUTER_API_KEY is not defined');
    return 'Error: No se pudo generar diagnóstico por falta de API Key.';
  }

  // Summarize links and buttons to avoid bloating the prompt tokens
  const brokenLinks = links.filter(l => !l.ok);
  const brokenButtons = buttons.filter(b => !b.isClickableAreaOk);

  const prompt = `
Analiza el siguiente informe de auditoría web para el portafolio: ${targetUrl}

### Métricas de Lighthouse:
- Rendimiento: ${lighthouse.performance}/100
- Accesibilidad: ${lighthouse.accessibility}/100
- Buenas Prácticas: ${lighthouse.bestPractices}/100
- SEO: ${lighthouse.seo}/100

### Enlaces Rotos (${brokenLinks.length} encontrados):
${brokenLinks.slice(0, 10).map(l => `- Texto: "${l.text}" -> URL: ${l.url} (Error: ${l.status})`).join('\n') || 'Ninguno'}

### Botones/CTAs con Errores (${brokenButtons.length} encontrados):
${brokenButtons.slice(0, 10).map(b => `- Elemento: <${b.tag}> con texto "${b.text}" (Errores: ${b.issues?.join(', ') || 'Área táctil incorrecta o falta hover'})`).join('\n') || 'Ninguno'}

### Errores de Consola de JavaScript (${consoleErrors.length} encontrados):
${consoleErrors.slice(0, 5).map(e => `- [${e.type}] ${e.text} (${e.location || 'desconocido'})`).join('\n') || 'Ninguno'}

### Texto extraído de la página (primeros 3000 caracteres):
"""
${pageText.slice(0, 3000)}
"""

---
Actúa como **FolioDoctor**, un auditor de portafolios con un estilo clínico y directo. Tu respuesta debe estar formateada en Markdown limpio, con secciones médicas y profesionales. 

Genera un reporte con las siguientes secciones obligatorias:
1. **🩺 Diagnóstico General (Salud del Paciente)**: Evalúa la claridad del mensaje principal (¿se entiende de inmediato a qué se dedica en los primeros segundos?), la densidad de texto (¿es legible o abruma?), y la cohesión visual/técnica general.
2. **💊 Tratamiento Inmediato (Enlaces y Botones)**: Acciones concretas sobre botones rotos o problemas interactivos de los CTAs.
3. **📋 Receta Médica (Acciones prioritarias)**: Un checklist ordenado de 3 a 5 recomendaciones accionables y directas para mejorar la conversión de visitas en entrevistas/contrataciones.

Sé constructivo, técnico y mantén la analogía médica de forma elegante. Escribe en español.
`;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ouendinga/folio-doctor',
        'X-Title': 'FolioDoctor'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: 'Eres el FolioDoctor, un cirujano y médico de portfolios web. Haces críticas clínicas extremadamente profesionales, enfocadas en rendimiento Lighthouse, accesibilidad, UX y conversión de clientes.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      throw new Error(`OpenRouter API returned status ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'Error: No se pudo generar la receta médica.';
  } catch (error) {
    console.error('Error calling OpenRouter:', error);
    return `### 🩺 Diagnóstico de Emergencia
El servidor de diagnóstico por IA se encuentra temporalmente fuera de línea.

**Prescripción Básica:**
- Revisa las métricas de rendimiento Lighthouse y soluciona las advertencias de consola.
- Asegúrate de que todos los botones importantes tengan áreas táctiles grandes e indicaciones visuales claras en hover.`;
  }
}
