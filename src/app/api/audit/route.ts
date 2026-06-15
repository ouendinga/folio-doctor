import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { runScraper } from '@/lib/scraper';
import { fetchLighthouseScores } from '@/lib/lighthouse';
import { generateAdvisorAdvice } from '@/lib/advisor';
import { AuditReport } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Falta el parámetro url' }, { status: 400 });
    }

    // Normalize URL
    let targetUrl = url.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = `https://${targetUrl}`;
    }

    try {
      new URL(targetUrl);
    } catch (e) {
      return NextResponse.json({ error: 'URL inválida' }, { status: 400 });
    }

    console.log(`[FolioDoctor] Iniciando auditoría clínica para: ${targetUrl}`);

    // Run Scraper and Lighthouse in parallel to speed up execution
    const [scraperResult, lighthouseResult] = await Promise.all([
      runScraper(targetUrl),
      fetchLighthouseScores(targetUrl),
    ]);

    // Request AI Advice
    const advice = await generateAdvisorAdvice(
      targetUrl,
      lighthouseResult,
      scraperResult.links,
      scraperResult.buttons,
      scraperResult.consoleErrors,
      scraperResult.pageText
    );

    // Calculate Overall Score
    const lhAvg = (lighthouseResult.performance + lighthouseResult.accessibility + lighthouseResult.bestPractices + lighthouseResult.seo) / 4;
    const brokenLinksCount = scraperResult.links.filter(l => !l.ok).length;
    const brokenButtonsCount = scraperResult.buttons.filter(b => !b.isClickableAreaOk).length;
    const consoleErrorsCount = scraperResult.consoleErrors.length;

    // Deductions
    const linkDeduction = Math.min(brokenLinksCount * 5, 20); // max -20
    const buttonDeduction = Math.min(brokenButtonsCount * 10, 30); // max -30
    const consoleDeduction = Math.min(consoleErrorsCount * 5, 20); // max -20

    const overallScore = Math.max(0, Math.round(lhAvg - linkDeduction - buttonDeduction - consoleDeduction));

    // Create consolidated report
    const id = crypto.randomUUID();
    const report: AuditReport = {
      id,
      url: targetUrl,
      timestamp: new Date().toISOString(),
      lighthouse: lighthouseResult,
      links: {
        total: scraperResult.links.length,
        broken: brokenLinksCount,
        items: scraperResult.links,
      },
      buttons: {
        total: scraperResult.buttons.length,
        broken: brokenButtonsCount,
        items: scraperResult.buttons,
      },
      consoleErrors: scraperResult.consoleErrors,
      screenshots: scraperResult.screenshots,
      advice,
      overallScore,
    };

    // Save report to disk inside src/data/reports
    const reportsDir = path.join(process.cwd(), 'src', 'data', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    fs.writeFileSync(
      path.join(reportsDir, `${id}.json`),
      JSON.stringify(report, null, 2),
      'utf-8'
    );

    console.log(`[FolioDoctor] Auditoría completada con éxito. ID: ${id}, Puntuación: ${overallScore}`);

    return NextResponse.json(report);
  } catch (error: any) {
    console.error('[FolioDoctor] Error crítico en la auditoría:', error);
    return NextResponse.json({ error: error?.message || 'Error interno del servidor en la auditoría' }, { status: 500 });
  }
}
