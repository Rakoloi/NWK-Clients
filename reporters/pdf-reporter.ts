import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdfkit';
import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import {
  findEntry,
  makeKey,
  readResultsFile,
  upsertEntry,
  TestResultEntry,
  TestResultStatus,
} from '../utils/testResultsStore';

type CollectedResult = {
  testNo: string;
  identifier: string; // ID number or business registration number
  group: string;
  accountNumber: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';
  durationSec: number;
  error?: string;
  screenshots: string[]; // relative paths inside report folder
};

type FailedEvidence = {
  folderName: string; // sanitized, unique folder name inside reportDir
  attachments: Array<{
    name: string;
    contentType: string;
    path?: string;
    body?: Buffer;
  }>;
  errorText?: string;
};

const GREEN = '#1e8e3e';
const DARK_GREEN = '#0b6b2b';
const LIGHT_GREEN = '#e6f4ea';
const RED = '#d93025';
const GRAY = '#5f6368';
const BORDER = '#c7e0cd';

export default class PdfReporter implements Reporter {
  private reportsRoot!: string;
  private reportDir!: string;
  private screenshotsDir!: string;
  private reportName!: string;
  private results: CollectedResult[] = [];
  private startedAt = 0;
  private projectName = 'Test Report';
  private failedEvidence: FailedEvidence[] = [];
  private usedEvidenceFolders = new Map<string, number>();

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.projectName = this.readProjectName();
    this.reportsRoot = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(this.reportsRoot)) {
      fs.mkdirSync(this.reportsRoot, { recursive: true });
    }
    this.reportName = this.nextReportName(this.reportsRoot);
    this.reportDir = path.join(this.reportsRoot, this.reportName);
    this.screenshotsDir = path.join(this.reportDir, 'screenshots');
    fs.mkdirSync(this.reportDir, { recursive: true });
    this.startedAt = Date.now();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Skip setup/auth tests (they authenticate against QA, not part of the report).
    if (this.isSetupTest(test)) return;

    const group = this.getGroupTitle(test);

    let errorMessage: string | undefined;
    if (result.status === 'failed' || result.status === 'timedOut') {
      const err = result.error;
      if (err) {
        errorMessage = (err.message || '').replace(/\u001b\[[0-9;]*m/g, '').trim();
        if (err.stack) {
          const stack = err.stack.replace(/\u001b\[[0-9;]*m/g, '').trim();
          const extra = stack
            .split('\n')
            .filter((l) => !errorMessage || !errorMessage.includes(l))
            .slice(0, 5)
            .join('\n');
          if (extra) errorMessage = `${errorMessage}\n${extra}`;
        }
      }
    }

    const screenshots: string[] = [];
    if (result.status === 'failed' || result.status === 'timedOut') {
      if (!fs.existsSync(this.screenshotsDir)) {
        fs.mkdirSync(this.screenshotsDir, { recursive: true });
      }
      for (const att of result.attachments) {
        if (att.contentType && att.contentType.startsWith('image/')) {
          const ext = att.contentType.split('/')[1] || 'png';
          const safeTc = test.title.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
          const safeGroup = group.replace(/[^a-z0-9-_]+/gi, '_').slice(0, 40);
          const fileName = `${safeGroup}__${safeTc}.${ext}`;
          const dest = path.join(this.screenshotsDir, fileName);
          try {
            if (att.body) {
              fs.writeFileSync(dest, att.body);
            } else if (att.path && fs.existsSync(att.path)) {
              fs.copyFileSync(att.path, dest);
            } else {
              continue;
            }
            screenshots.push(path.join('screenshots', fileName));
          } catch {
            // ignore
          }
        }
      }
    }

    this.results.push({
      testNo: test.title,
      identifier: this.extractIdentifier(test, result),
      group,
      accountNumber: this.extractAccountNumber(test, result),
      status: result.status,
      durationSec: result.duration / 1000,
      error: errorMessage,
      screenshots,
    });

    // Persist this result into reports/testResults.json so subsequent runs
    // can skip rows that are already 'passed' or 'duplicate'. Skipped/
    // interrupted outcomes must never downgrade a previously-passed entry.
    try {
      this.upsertResultForTest(test, result, {
        group,
        screenshots,
        error: errorMessage,
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        `[pdf-reporter] Failed to upsert testResults.json entry: ${(err as Error).message}`
      );
    }

    // Collect per-failed-test evidence attachments (screenshot(s), video, trace, etc.).
    if (result.status === 'failed' || result.status === 'timedOut') {
      const folderName = this.uniqueEvidenceFolder(test);
      this.failedEvidence.push({
        folderName,
        errorText: errorMessage,
        attachments: result.attachments.map((a) => ({
          name: a.name,
          contentType: a.contentType,
          path: a.path,
          body: a.body,
        })),
      });
    }
  }

  async onEnd(result: FullResult): Promise<void> {
    const pdfPath = path.join(this.reportDir, `${this.reportName}.pdf`);
    await this.renderPdf(pdfPath, result);
    // eslint-disable-next-line no-console
    console.log(`\nPDF report saved: ${pdfPath}`);
  }

  // onExit is invoked after every reporter's onEnd has resolved, so by this point all
  // attachment files (screenshots, videos, traces) that Playwright had to finalize are
  // present on disk and safe to copy into the per-failed-test evidence folders.
  async onExit(): Promise<void> {
    try {
      await this.writeFailedEvidence();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(`[pdf-reporter] Failed to write failed-test evidence: ${(err as Error).message}`);
    }
    // eslint-disable-next-line no-console
    console.log(`Evidence saved under: ${this.reportDir}`);
  }

  private async writeFailedEvidence(): Promise<void> {
    for (const ev of this.failedEvidence) {
      const folder = path.join(this.reportDir, ev.folderName);
      await fs.promises.mkdir(folder, { recursive: true });

      const usedNames = new Set<string>();
      for (const att of ev.attachments) {
        const fileName = this.pickAttachmentFileName(att, usedNames);
        const dest = path.join(folder, fileName);
        try {
          if (att.path && fs.existsSync(att.path)) {
            await fs.promises.copyFile(att.path, dest);
          } else if (att.body) {
            await fs.promises.writeFile(dest, att.body);
          } else {
            continue;
          }
          usedNames.add(fileName.toLowerCase());
        } catch {
          // ignore individual attachment failures
        }
      }

      if (ev.errorText) {
        try {
          await fs.promises.writeFile(
            path.join(folder, 'error.txt'),
            ev.errorText,
            'utf8'
          );
        } catch {
          // ignore
        }
      }
    }
  }

  private pickAttachmentFileName(
    att: { name: string; contentType: string; path?: string },
    used: Set<string>
  ): string {
    let base: string;
    if (att.path) {
      base = path.basename(att.path);
    } else {
      const ext = this.extensionForContentType(att.contentType);
      const safe = this.sanitizeForWindows(att.name || 'attachment');
      base = `${safe}${ext}`;
    }
    let candidate = base;
    let n = 1;
    const parsed = path.parse(base);
    while (used.has(candidate.toLowerCase())) {
      n += 1;
      candidate = `${parsed.name}-${n}${parsed.ext}`;
    }
    return candidate;
  }

  private extensionForContentType(ct: string): string {
    if (!ct) return '';
    if (ct.startsWith('image/')) return `.${ct.split('/')[1] || 'png'}`;
    if (ct.startsWith('video/')) return `.${ct.split('/')[1] || 'webm'}`;
    if (ct === 'application/zip') return '.zip';
    if (ct === 'application/json') return '.json';
    if (ct.startsWith('text/')) return '.txt';
    return '';
  }

  private uniqueEvidenceFolder(test: TestCase): string {
    const raw = this.sanitizeForWindows(test.title) || 'test';
    const key = raw.toLowerCase();
    const count = (this.usedEvidenceFolders.get(key) ?? 0) + 1;
    this.usedEvidenceFolders.set(key, count);
    if (count === 1) return raw;
    // Disambiguate duplicates by appending the project name and/or a counter.
    const projSuite: Suite | undefined = (() => {
      let s: Suite | undefined = test.parent;
      while (s) {
        const proj = (s as any).project?.();
        if (proj?.name) return s;
        s = s.parent;
      }
      return undefined;
    })();
    const projName =
      projSuite && (projSuite as any).project?.()?.name
        ? this.sanitizeForWindows((projSuite as any).project().name)
        : '';
    const fileName = test.location?.file
      ? this.sanitizeForWindows(path.basename(test.location.file).replace(/\.[tj]s$/i, ''))
      : '';
    const suffixParts = [projName, fileName].filter(Boolean);
    const suffix = suffixParts.length ? ` (${suffixParts.join(' - ')})` : '';
    const candidate = `${raw}${suffix}`;
    if (!this.usedEvidenceFolders.has(candidate.toLowerCase())) {
      this.usedEvidenceFolders.set(candidate.toLowerCase(), 1);
      return candidate;
    }
    return `${candidate} #${count}`;
  }

  private upsertResultForTest(
    test: TestCase,
    result: TestResult,
    ctx: { group: string; screenshots: string[]; error?: string }
  ): void {
    const accountNumber = this.extractAccountNumber(test, result);
    const identifier = this.extractIdentifier(test, result);
    const key = makeKey(accountNumber, test.title);
    if (!key) return; // nothing to key on

    const previous = findEntry(key);
    const currentStatus: TestResultStatus = result.status as TestResultStatus;

    // Preserve a previously-passed/duplicate entry when this run merely
    // skipped (resumable run) or was interrupted.
    if (
      previous &&
      (previous.status === 'passed' || previous.status === 'duplicate') &&
      (currentStatus === 'skipped' || currentStatus === 'interrupted')
    ) {
      upsertEntry({
        ...previous,
        lastRunAt: new Date().toISOString(),
      });
      return;
    }

    const entry: TestResultEntry = {
      key,
      testNo: test.title,
      sheetName: ctx.group,
      identifier,
      accountNumber,
      status: currentStatus,
      isDuplicate: false,
      durationSec: result.duration / 1000,
      error: ctx.error || '',
      screenshots: ctx.screenshots,
      lastRunAt: new Date().toISOString(),
    };
    upsertEntry(entry);
  }

  private sanitizeForWindows(name: string): string {
    // Remove characters that are invalid in Windows file/folder names.
    let cleaned = (name || '')
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Windows disallows trailing dots or spaces on folder names.
    cleaned = cleaned.replace(/[\s.]+$/g, '');
    // Reserved Windows device names.
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(cleaned)) cleaned = `_${cleaned}`;
    // Cap length to be safe on Windows path limits.
    if (cleaned.length > 120) cleaned = cleaned.slice(0, 120).trim();
    return cleaned;
  }

  private extractIdentifier(test: TestCase, result: TestResult): string {
    // Each test pushes either an ID number or Business registration number using:
    //   test.info().annotations.push({ type: 'identifier', description: value });
    // Accept any annotation whose type matches /^(identifier|id|registration|reg[ _-]?no|businessreg)/i.
    const sources: Array<{ type: string; description?: string }> = [];
    const resultAnnotations = (result as any).annotations;
    if (Array.isArray(resultAnnotations)) sources.push(...resultAnnotations);
    if (Array.isArray(test.annotations)) sources.push(...test.annotations);
    for (const a of sources) {
      if (
        a &&
        typeof a.type === 'string' &&
        /^(identifier|id|registration|reg[ _-]?no|businessreg)/i.test(a.type)
      ) {
        const v = (a.description || '').toString().trim();
        if (v) return v;
      }
    }
    return '';
  }

  private extractAccountNumber(test: TestCase, result: TestResult): string {
    // Account number is reported by the test itself using an annotation, e.g.
    //   test.info().annotations.push({ type: 'account', description: accountNo });
    // Accept any annotation whose type matches /account/i.
    const sources: Array<{ type: string; description?: string }> = [];
    const resultAnnotations = (result as any).annotations;
    if (Array.isArray(resultAnnotations)) sources.push(...resultAnnotations);
    if (Array.isArray(test.annotations)) sources.push(...test.annotations);
    for (const a of sources) {
      if (a && typeof a.type === 'string' && /account/i.test(a.type)) {
        const v = (a.description || '').toString().trim();
        if (v) return v;
      }
    }
    return '';
  }

  private isSetupTest(test: TestCase): boolean {
    // Filter by project name (e.g. "setup") walked up from the test's parents.
    let s: Suite | undefined = test.parent;
    while (s) {
      // Playwright's project suite exposes .project(); if it's the 'setup' project, skip.
      const proj = (s as any).project?.();
      if (proj && typeof proj.name === 'string' && proj.name.toLowerCase() === 'setup') {
        return true;
      }
      s = s.parent;
    }
    // Fallback: filter by file path.
    const file = test.location?.file || '';
    return /\.setup\.[tj]s$/i.test(file) || /[\\/]auth[\\/]/i.test(file);
  }

  private getGroupTitle(test: TestCase): string {
    // Walk parents from nearest and pick the first "describe" title. Skip suites whose
    // title looks like a file path (Playwright's file suite) or is empty (root/project).
    let s: Suite | undefined = test.parent;
    while (s) {
      const title = (s.title || '').trim();
      if (title && !this.looksLikeFilePath(title)) {
        return title;
      }
      s = s.parent;
    }
    // Fallback to file basename without extension.
    const file = test.location?.file || '';
    if (file) return path.basename(file).replace(/\.[tj]s$/i, '');
    return 'Tests';
  }

  private looksLikeFilePath(t: string): boolean {
    return /[\\/]/.test(t) || /\.[tj]s$/i.test(t);
  }

  private readProjectName(): string {
    try {
      const pkgPath = path.resolve(process.cwd(), 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg && typeof pkg.name === 'string' && pkg.name.trim()) {
          return pkg.name
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, (c: string) => c.toUpperCase());
        }
      }
    } catch {
      // ignore
    }
    return 'Test Report';
  }

  private nextReportName(root: string): string {
    const entries = fs.existsSync(root) ? fs.readdirSync(root) : [];
    let max = 0;
    for (const e of entries) {
      const m = /^report(\d+)$/i.exec(e);
      if (m) max = Math.max(max, parseInt(m[1], 10));
    }
    const next = max + 1;
    return `report${String(next).padStart(2, '0')}`;
  }

  private renderPdf(filePath: string, result: FullResult): Promise<void> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const stream = fs.createWriteStream(filePath);
      stream.on('finish', () => resolve());
      stream.on('error', reject);
      doc.pipe(stream);

      // Render from the persistent JSON store so rows that were skipped this
      // run (because they already passed previously) still appear with their
      // last-known status.
      const storeEntries = readResultsFile().entries;
      const renderResults: CollectedResult[] = storeEntries.map((e) => ({
        testNo: e.testNo,
        identifier: e.identifier,
        group: e.sheetName,
        accountNumber: e.accountNumber,
        status: e.status === 'duplicate' ? 'skipped' : (e.status as CollectedResult['status']),
        durationSec: e.durationSec,
        error: e.error,
        screenshots: e.screenshots,
      }));
      // Track duplicate flag alongside the row so the status cell can colour it.
      const duplicateKeys = new Set(
        storeEntries.filter((e) => e.status === 'duplicate').map((e) => e.key)
      );
      const entryKeyFor = (r: CollectedResult): string =>
        makeKey(r.accountNumber, r.testNo);

      const total = renderResults.length;
      const passed = renderResults.filter((r) => r.status === 'passed').length;
      const failed = renderResults.filter(
        (r) => r.status === 'failed' || r.status === 'timedOut'
      ).length;
      const duplicates = storeEntries.filter((e) => e.status === 'duplicate').length;
      const skipped =
        renderResults.filter(
          (r) => r.status === 'skipped' || r.status === 'interrupted'
        ).length - duplicates;
      const durationSec = (Date.now() - this.startedAt) / 1000;

      // Logo (centered at the top of the page).
      const logoPath = path.resolve(process.cwd(), 'images', 'NWK-logo.png');
      if (fs.existsSync(logoPath)) {
        try {
          const logoW = 110;
          const logoH = 60;
          const logoX = (doc.page.width - logoW) / 2;
          const logoY = doc.y;
          doc.image(logoPath, logoX, logoY, { fit: [logoW, logoH], align: 'center' });
          doc.y = logoY + logoH + 10;
        } catch {
          // ignore logo rendering errors
        }
      }

      // Title (full width, rendered below the centered logo so they never overlap).
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor(DARK_GREEN)
        .text(`${this.projectName}-test data automation report`, {
          align: 'left',
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        });
      doc.moveDown(0.4);

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(GRAY)
        .text(`Generated: ${new Date().toLocaleString()}`)
        .text('Automation framework: playwright.')
        .text(`Total run time: ${durationSec.toFixed(2)}s`);

      doc.moveDown(0.8);

      // Summary box
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(DARK_GREEN)
        .text('Execution Summary');
      doc.moveDown(0.3);

      const summaryY = doc.y;
      const boxLeft = doc.page.margins.left;
      const boxWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const summaryCells: Array<{ label: string; value: number; color: string }> = [
        { label: 'Total', value: total, color: '#202124' },
        { label: 'Passed', value: passed, color: GREEN },
        { label: 'Failed', value: failed, color: RED },
        { label: 'Skipped', value: skipped, color: GRAY },
      ];
      const cellW = boxWidth / summaryCells.length;
      const boxHeight = 44;
      doc
        .rect(boxLeft, summaryY, boxWidth, boxHeight)
        .fillOpacity(1)
        .fillAndStroke(LIGHT_GREEN, GREEN);
      summaryCells.forEach((c, i) => {
        const x = boxLeft + cellW * i;
        doc
          .fillColor(c.color)
          .font('Helvetica-Bold')
          .fontSize(16)
          .text(String(c.value), x, summaryY + 6, { width: cellW, align: 'center' });
        doc
          .fillColor(GRAY)
          .font('Helvetica')
          .fontSize(10)
          .text(c.label, x, summaryY + 26, { width: cellW, align: 'center' });
      });
      doc.y = summaryY + boxHeight + 16;

      // Group results by their group title, preserving first-seen order.
      const groups = new Map<string, CollectedResult[]>();
      for (const r of renderResults) {
        const list = groups.get(r.group) ?? [];
        list.push(r);
        groups.set(r.group, list);
      }

      // Table columns
      const statusW = 90;
      const durationW = 90;
      const tcW = 120;
      const idW = boxWidth - tcW - statusW - durationW;
      const colW = [tcW, idW, statusW, durationW];
      const colX = [
        boxLeft,
        boxLeft + colW[0],
        boxLeft + colW[0] + colW[1],
        boxLeft + colW[0] + colW[1] + colW[2],
      ];
      const headers = ['TEST CASE NO', 'ID / REG NO', 'STATUS', 'DURATION'];

      const drawTableHeader = () => {
        const y = doc.y;
        doc.rect(boxLeft, y, boxWidth, 24).fillAndStroke(GREEN, DARK_GREEN);
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10);
        headers.forEach((h, i) => {
          doc.text(h, colX[i] + 6, y + 7, { width: colW[i] - 12, align: 'left' });
        });
        doc.y = y + 24;
      };

      const ensureSpace = (needed: number, redrawHeader: () => void) => {
        if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          redrawHeader();
        }
      };

      const drawSubheadingRow = (title: string, count: number) => {
        ensureSpace(22, drawTableHeader);
        const y = doc.y;
        doc.rect(boxLeft, y, boxWidth, 22).fillAndStroke(LIGHT_GREEN, BORDER);
        doc
          .fillColor(DARK_GREEN)
          .font('Helvetica-Bold')
          .fontSize(11)
          .text(title, boxLeft + 8, y + 5, { width: boxWidth - 120 });
        doc
          .fillColor(DARK_GREEN)
          .font('Helvetica')
          .fontSize(9)
          .text(`${count} test${count === 1 ? '' : 's'}`, boxLeft, y + 7, {
            width: boxWidth - 8,
            align: 'right',
          });
        doc.y = y + 22;
      };

      const drawRow = (r: CollectedResult) => {
        doc.font('Helvetica').fontSize(10).fillColor('#202124');
        const statusText = r.status.toUpperCase();
        const durationText = `${r.durationSec.toFixed(2)}s`;
        const identifierText = r.identifier || '-';
        const tcHeight = doc.heightOfString(r.testNo, { width: colW[0] - 12 });
        const idHeight = doc.heightOfString(identifierText, { width: colW[1] - 12 });
        const rowHeight = Math.max(22, tcHeight, idHeight) + 10;

        ensureSpace(rowHeight, drawTableHeader);

        const y = doc.y;
        doc.rect(boxLeft, y, boxWidth, rowHeight).strokeColor(BORDER).stroke();

        doc
          .fillColor('#202124')
          .font('Helvetica-Bold')
          .text(r.testNo, colX[0] + 6, y + 6, { width: colW[0] - 12 });

        doc
          .fillColor('#202124')
          .font('Helvetica')
          .text(identifierText, colX[1] + 6, y + 6, { width: colW[1] - 12 });

        const isPass = r.status === 'passed';
        const isFail = r.status === 'failed' || r.status === 'timedOut';
        const isDuplicate = duplicateKeys.has(entryKeyFor(r));
        const displayStatus = isDuplicate ? 'DUPLICATE' : statusText;
        const statusColor = isDuplicate
          ? '#1a73e8'
          : isPass
            ? GREEN
            : isFail
              ? RED
              : GRAY;
        doc
          .fillColor(statusColor)
          .font('Helvetica-Bold')
          .text(displayStatus, colX[2] + 6, y + 6, { width: colW[2] - 12 });

        doc
          .fillColor('#202124')
          .font('Helvetica')
          .text(durationText, colX[3] + 6, y + 6, { width: colW[3] - 12 });

        doc.y = y + rowHeight;

      };

      // Single table: one header row, then per-sheet subheading rows followed by test rows.
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(DARK_GREEN)
        .text('Test Results');
      doc.moveDown(0.4);

      drawTableHeader();
      for (const [groupTitle, rows] of groups) {
        drawSubheadingRow(groupTitle, rows.length);
        for (const r of rows) drawRow(r);
      }

      // Footer note about screenshots folder
      if (this.results.some((r) => r.screenshots.length > 0)) {
        doc.moveDown(0.5);
        doc
          .fillColor(GRAY)
          .font('Helvetica-Oblique')
          .fontSize(9)
          .text(
            `Failure screenshots saved to: ${path.join(this.reportName, 'screenshots')}`,
            { align: 'left' }
          );
      }

      doc.end();
    });
  }
}
