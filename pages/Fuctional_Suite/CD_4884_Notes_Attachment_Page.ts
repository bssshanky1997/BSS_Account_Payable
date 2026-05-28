import { type Locator, type Page, type FrameLocator } from '@playwright/test';
import { ensureAuthenticatedPage } from '../../utils/authSession';

export class CD4884NotesAttachmentPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private get quickLinks(): Locator {
    return this.page.locator('#quickLinks1');
  }

  private get apInvoiceButton(): Locator {
    return this.page.getByRole('button', { name: 'AP Invoice' });
  }

  private statusTile(status: string): Locator {
    return this.page.locator(`.summary-box[data-status="${status}"]`).first();
  }

  private get actionsIcon(): Locator {
    return this.page.getByRole('img', { name: 'Actions' }).first();
  }

  private get notesMenuItem(): Locator {
    return this.page.locator('div').filter({ hasText: /^Notes$/ });
  }

  private get notesFrame(): FrameLocator {
    return this.page.frameLocator('#notesIframe');
  }

  private get commentTextarea(): Locator {
    return this.notesFrame.locator('#commentTextarea');
  }

  private get postButton(): Locator {
    return this.notesFrame.getByRole('button', { name: 'Post' });
  }

  private get noteItems(): Locator {
    return this.notesFrame.locator('li.comment-item');
  }

  private get otherUserNoteItems(): Locator {
    return this.notesFrame.locator('li.comment-item:not(.logged-in-user)');
  }

  private get sameUserNoteItems(): Locator {
    return this.notesFrame.locator('li.comment-item.logged-in-user');
  }

  private async settle(ms = 1200): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded').catch(() => undefined);
    await this.page.waitForTimeout(ms);
  }

  async openHomePage(): Promise<void> {
    await ensureAuthenticatedPage(this.page, '/j4/default.jsp');
    await this.settle(2200);
  }

  async navigateToNotesForStatus(status: 'Transmitted' | 'Exception'): Promise<void> {
    await this.quickLinks.waitFor({ state: 'visible', timeout: 30_000 });
    await this.quickLinks.click();
    await this.settle(1500);

    await this.apInvoiceButton.waitFor({ state: 'visible', timeout: 30_000 });
    await this.apInvoiceButton.click();
    await this.settle(1500);

    const selectedStatusTile = this.statusTile(status);
    await selectedStatusTile.waitFor({ state: 'visible', timeout: 30_000 });
    await selectedStatusTile.click();
    await this.settle(1200);

    await this.actionsIcon.waitFor({ state: 'visible', timeout: 30_000 });
    await this.actionsIcon.click();
    await this.settle(1200);

    await this.notesMenuItem.waitFor({ state: 'visible', timeout: 30_000 });
    await this.notesMenuItem.click();
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    await this.noteItems.first().waitFor({ state: 'attached', timeout: 10_000 }).catch(() => undefined);
    await this.settle(1500);
  }

  async navigateToNotes(): Promise<void> {
    await this.navigateToNotesForStatus('Transmitted');
  }

  async postComment(comment: string): Promise<void> {
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    await this.commentTextarea.click();
    await this.commentTextarea.fill(comment);
    await this.settle(500);
    await this.postButton.click();
    await this.settle(1200);
  }

  async notesPanelText(): Promise<string> {
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    const text = await this.notesFrame.locator('body').innerText();
    return text.trim();
  }

  async totalNotesCount(): Promise<number> {
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    return this.noteItems.count();
  }

  async otherUserNotesCount(): Promise<number> {
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    return this.otherUserNoteItems.count();
  }

  async sameUserNotesCount(): Promise<number> {
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    return this.sameUserNoteItems.count();
  }

  private async findOtherUserNoteByScrollingDown(): Promise<Locator | null> {
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    const otherUserCount = await this.otherUserNoteItems.count();
    if (otherUserCount === 0) return null;

    // Scroll down through other-user notes and pick the first actionable one found from bottom.
    for (let index = otherUserCount - 1; index >= 0; index -= 1) {
      const candidate = this.otherUserNoteItems.nth(index);
      await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
      await this.page.waitForTimeout(200);

      const isAttached = (await candidate.count().catch(() => 0)) > 0;
      if (isAttached) return candidate;
    }

    return this.otherUserNoteItems.first();
  }

  private async findSameUserNoteByScrollingDown(): Promise<Locator | null> {
    await this.commentTextarea.waitFor({ state: 'visible', timeout: 30_000 });
    const sameUserCount = await this.sameUserNoteItems.count();
    if (sameUserCount === 0) return null;

    for (let index = sameUserCount - 1; index >= 0; index -= 1) {
      const candidate = this.sameUserNoteItems.nth(index);
      await candidate.scrollIntoViewIfNeeded().catch(() => undefined);
      await this.page.waitForTimeout(200);

      const isAttached = (await candidate.count().catch(() => 0)) > 0;
      if (isAttached) return candidate;
    }

    return this.sameUserNoteItems.first();
  }

  private async tryEditOnNote(note: Locator): Promise<boolean> {
    const editIcon = note.locator('.edit-icon');
    if (!(await editIcon.isVisible().catch(() => false))) return false;

    const commentTextId = await note.locator('[id^="commentText_"]').first().getAttribute('id');
    const noteGuid = (commentTextId ?? '').replace('commentText_', '');
    const editForm = note.locator(`#editForm_${noteGuid}`);

    try {
      await editIcon.click({ timeout: 4000 });
      await this.settle(900);
      return editForm.isVisible().catch(() => false);
    } catch {
      return false;
    }
  }

  private async tryDeleteOnNote(note: Locator): Promise<boolean> {
    const deleteIcon = note.locator('.delete-icon');
    if (!(await deleteIcon.isVisible().catch(() => false))) return false;

    const deleteButton = note.locator('button:has(.delete-icon)');
    if (!(await deleteButton.isVisible().catch(() => false))) return false;

    let dialogHandled = false;
    const dialogHandler = async (dialog: { dismiss: () => Promise<void> }): Promise<void> => {
      dialogHandled = true;
      await dialog.dismiss().catch(() => undefined);
    };
    this.page.once('dialog', dialogHandler);

    try {
      await deleteButton.click({ timeout: 4000 });
      await this.settle(900);
      return dialogHandled;
    } catch {
      return false;
    }
  }

  async tryEditOnFirstOtherUserNote(): Promise<boolean> {
    const otherUserNote = await this.findOtherUserNoteByScrollingDown();
    if (!otherUserNote) return false;
    return this.tryEditOnNote(otherUserNote);
  }

  async tryDeleteOnFirstOtherUserNote(): Promise<boolean> {
    const otherUserNote = await this.findOtherUserNoteByScrollingDown();
    if (!otherUserNote) return false;
    return this.tryDeleteOnNote(otherUserNote);
  }

  async tryEditOnFirstSameUserNote(): Promise<boolean> {
    const sameUserNote = await this.findSameUserNoteByScrollingDown();
    if (!sameUserNote) return false;
    return this.tryEditOnNote(sameUserNote);
  }

  async tryDeleteOnFirstSameUserNote(): Promise<boolean> {
    const sameUserNote = await this.findSameUserNoteByScrollingDown();
    if (!sameUserNote) return false;
    return this.tryDeleteOnNote(sameUserNote);
  }

  postedComment(commentText: string): Locator {
    return this.notesFrame.getByText(commentText).first();
  }
}
