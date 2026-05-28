import { request, type APIRequestContext } from '@playwright/test';
import { getEnvConfig } from '../config/qa.env';

type RightRow = string[];

export class PositionRightsApiError extends Error {
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = 'PositionRightsApiError';
    this.details = details;
  }
}

type PositionDocData = {
  docName: string;
  documentId: string;
  stateId: string;
  smPositionColCount: number;
  smPositionRightDetailColCount: number;
  smPositionRow: string[];
  smPositionRightRows: RightRow[];
};

const FK_LOAD_XML =
  '<FOREIGN_KEY_DESC><ROW><CHILD_TABLE>SMPOSITION_RIGHT_DETAIL</CHILD_TABLE><CHILD_COLUMN>RIGHT_ID</CHILD_COLUMN><PARENT_TABLE>SMPOSITION_RIGHT_MASTER</PARENT_TABLE><PARENT_KEY_COLUMN>RIGHT_ID</PARENT_KEY_COLUMN><PARENT_DESC_COLUMN>RIGHT_DESC</PARENT_DESC_COLUMN></ROW></FOREIGN_KEY_DESC>';

export class PositionRightsApi {
  private apiContext?: APIRequestContext;

  async init(): Promise<void> {
    const envConfig = getEnvConfig();
    this.apiContext = await request.newContext({
      baseURL: new URL('/j4/', envConfig.baseURL).toString(),
      storageState: 'playwright/.auth/user.json',
      ignoreHTTPSErrors: true,
      extraHTTPHeaders: {
        Accept: '*/*',
      },
      timeout: 60_000,
    });
  }

  async dispose(): Promise<void> {
    await this.apiContext?.dispose();
  }

  async enableRight(
    positionId: string | number,
    rightId = 4051,
    applicationName = 'PROCUREMENT'
  ): Promise<void> {
    await this.toggleRight(positionId, rightId, applicationName, true);
  }

  async disableRight(
    positionId: string | number,
    rightId = 4051,
    applicationName = 'PROCUREMENT'
  ): Promise<void> {
    await this.toggleRight(positionId, rightId, applicationName, false);
  }

  private ensureContext(): APIRequestContext {
    if (!this.apiContext) {
      throw new PositionRightsApiError('PositionRightsApi not initialized. Call init() first.');
    }
    return this.apiContext;
  }

  private decodeJsString(value: string): string {
    return value
      .replace(/\\\\/g, '\\')
      .replace(/\\"/g, '"')
      .replace(/\\\//g, '/');
  }

  private parseDelimitedRow(value: string): string[] {
    return this.decodeJsString(value)
      .split('~;~')
      .filter((part, index, arr) => !(index === arr.length - 1 && part === ''));
  }

  private extractSingle(re: RegExp, source: string, label: string): string {
    const match = source.match(re);
    if (!match?.[1]) {
      throw new PositionRightsApiError(`Unable to parse ${label} from DocumentLoad response.`);
    }
    return match[1];
  }

  private extractSingleOrDefault(
    re: RegExp,
    source: string,
    fallback: string
  ): string {
    const match = source.match(re);
    return match?.[1] || fallback;
  }

  private buildTimestamp(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${p(d.getMonth() + 1)}/${p(d.getDate())}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  private xmlEscape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private buildTableXml(tableName: string, colCount: number, rows: string[][]): string {
    const rowXml = rows
      .map(
        (row) =>
          `<ROW>${row.map((cell) => `<c>${this.xmlEscape(cell ?? '')}</c>`).join('')}</ROW>`
      )
      .join('');
    return `<TABLE><${tableName}><COLCOUNT>${colCount}</COLCOUNT><ROWCOUNT>${rows.length}</ROWCOUNT>${rowXml}</${tableName}></TABLE>`;
  }

  private buildUpdateXml(doc: PositionDocData, updatedRightRows: RightRow[]): string {
    return (
      `<DOC_ROOT><DOC_COUNT>1</DOC_COUNT><NEW_DOC><DOCUMENT>` +
      `<DOCMETA><NAME>${this.xmlEscape(doc.docName)}</NAME><DOCUMENT_ID>${doc.documentId}</DOCUMENT_ID><DOCUMENT_STATE>${doc.stateId}</DOCUMENT_STATE><FULLXMLDOC>true</FULLXMLDOC><TABLECOUNT>2</TABLECOUNT></DOCMETA>` +
      this.buildTableXml('SMPOSITION', doc.smPositionColCount, [doc.smPositionRow]) +
      this.buildTableXml('SMPOSITION_RIGHT_DETAIL', doc.smPositionRightDetailColCount, updatedRightRows) +
      `<PBUTTON></PBUTTON></DOCUMENT></NEW_DOC></DOC_ROOT>`
    );
  }

  private isRightRow(row: RightRow, positionId: string, rightId: string, appName: string): boolean {
    return row[2] === appName && row[3] === positionId && row[4] === rightId;
  }

  private async fetchCsrfToken(screenId = '10523'): Promise<string> {
    const ctx = this.ensureContext();
    const res = await ctx.get(`agscreen.jsp?screenid=${screenId}`);
    if (!res.ok()) {
      throw new PositionRightsApiError(`Failed to open agscreen for CSRF token: ${res.status()}`);
    }
    const html = await res.text();
    const token = this.extractSingle(/csrf_xyz123=([a-f0-9]{20,})/i, html, 'csrf_xyz123');
    return token;
  }

  private async loadPositionDocument(positionId: string | number): Promise<PositionDocData> {
    const ctx = this.ensureContext();
    const res = await ctx.post('DocumentLoad.jsp', {
      form: {
        documentNumber: String(positionId),
        documentID: '15630',
        StateID: '1',
        loadXML: FK_LOAD_XML,
        doLoad: '1',
      },
    });

    if (!res.ok()) {
      throw new PositionRightsApiError(`DocumentLoad failed: ${res.status()} ${res.statusText()}`);
    }

    const text = await res.text();
    const docName = this.extractSingle(
      /new\s+DocDataObject\(\d+,\s*"([^"]+)"\)/,
      text,
      'docName'
    );
    const documentId = this.extractSingleOrDefault(
      /DOCTYPE:(\d+)/,
      text,
      this.extractSingleOrDefault(/var\s+gDocID\s*=\s*"(\d+)"/, text, '15630')
    );
    const stateId = this.extractSingleOrDefault(/DOCUMENT_STATE[^>]*>\s*([0-9]+)/, text, '1');
    const smPositionColCount = Number(
      this.extractSingle(/var\s+SMPOSITION\s*=\s*new\s+RSObject\((\d+),/, text, 'SMPOSITION colcount')
    );
    const smPositionRightDetailColCount = Number(
      this.extractSingle(
        /var\s+SMPOSITION_RIGHT_DETAIL\s*=\s*new\s+RSObject\((\d+),/,
        text,
        'SMPOSITION_RIGHT_DETAIL colcount'
      )
    );

    const smPositionRowRaw = this.extractSingle(
      /SMPOSITION\.SetByList\("([\s\S]*?)",\s*"~;~"\)/,
      text,
      'SMPOSITION row'
    );
    const smPositionRow = this.parseDelimitedRow(smPositionRowRaw);

    const rightRows: RightRow[] = [];
    const rightRe = /SMPOSITION_RIGHT_DETAIL\.SetByList\("([\s\S]*?)",\s*"~;~"\)/g;
    let match;
    while ((match = rightRe.exec(text)) !== null) {
      rightRows.push(this.parseDelimitedRow(match[1]));
    }

    return {
      docName,
      documentId,
      stateId,
      smPositionColCount,
      smPositionRightDetailColCount,
      smPositionRow,
      smPositionRightRows: rightRows,
    };
  }

  private async submitUpdate(xml: string, csrfToken: string, documentId: string, stateId: string): Promise<void> {
    const ctx = this.ensureContext();
    const res = await ctx.post('DocumentSave.jsp', {
      form: {
        doctype: documentId,
        xml,
        state: stateId,
        action: 'U',
        documentNumber: 'Nothing',
        csrf_xyz123: csrfToken,
        rowInEditing: '',
        columnInEditing: '',
        xmlCompressed: '0',
        xmlOriginalSize: '',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    const responseText = await res.text();
    if (!res.ok()) {
      throw new PositionRightsApiError(`DocumentSave failed: ${res.status()} ${res.statusText()}`, responseText);
    }
    if (/Internal Server Error|saveStatus\s*=\s*"false"|Unhandled error/i.test(responseText)) {
      throw new PositionRightsApiError('DocumentSave returned non-success response.', responseText);
    }
  }

  private async toggleRight(
    positionId: string | number,
    rightId: number,
    applicationName: string,
    enabled: boolean
  ): Promise<void> {
    const doc = await this.loadPositionDocument(positionId);
    const pos = String(positionId);
    const rid = String(rightId);

    const filtered = doc.smPositionRightRows.filter(
      (row) => !this.isRightRow(row, pos, rid, applicationName)
    );

    let updatedRows = filtered;
    if (enabled) {
      const template =
        doc.smPositionRightRows.find((row) => row[2] === applicationName && row[3] === pos) ||
        doc.smPositionRightRows.find((row) => row[3] === pos) ||
        doc.smPositionRightRows[0];

      if (!template) {
        throw new PositionRightsApiError(
          `Unable to derive template row for position=${pos}, application=${applicationName}.`
        );
      }

      const now = this.buildTimestamp();
      const user = process.env.USERNAME || template[8] || template[6] || 'automation';
      const newRow = [...template];
      newRow[2] = applicationName;
      newRow[3] = pos;
      newRow[4] = rid;
      newRow[7] = now;
      newRow[8] = user;
      if (!newRow[5]) newRow[5] = now;
      if (!newRow[6]) newRow[6] = user;

      updatedRows = [...filtered, newRow];
    }

    const xml = this.buildUpdateXml(doc, updatedRows);
    const csrf = await this.fetchCsrfToken('10523');
    await this.submitUpdate(xml, csrf, doc.documentId, doc.stateId);
  }
}
