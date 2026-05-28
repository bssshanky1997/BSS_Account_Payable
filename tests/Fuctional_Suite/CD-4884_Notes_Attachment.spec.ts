import { test, expect } from '../../fixtures/testFixture';
import { CD4884NotesAttachmentPage } from '../../pages/Fuctional_Suite/CD_4884_Notes_Attachment_Page';

async function validateNotesEditDeleteRestrictionForStatus(
  notesAttachmentPage: CD4884NotesAttachmentPage,
  status: 'Transmitted' | 'Exception'
): Promise<void> {
  await notesAttachmentPage.navigateToNotesForStatus(status);

  const totalNotes = await notesAttachmentPage.totalNotesCount();
  expect(totalNotes, `Expected at least one note in ${status} Notes section.`).toBeGreaterThan(0);

  const otherUserNotes = await notesAttachmentPage.otherUserNotesCount();
  expect(
    otherUserNotes,
    `Expected another user note in ${status} to validate edit/delete restriction without right ID 4051.`
  ).toBeGreaterThan(0);

  const canEditOtherUserNote = await notesAttachmentPage.tryEditOnFirstOtherUserNote();
  const canDeleteOtherUserNote = await notesAttachmentPage.tryDeleteOnFirstOtherUserNote();
  const sameUserNotes = await notesAttachmentPage.sameUserNotesCount();
  const canEditSameUserNote = await notesAttachmentPage.tryEditOnFirstSameUserNote();
  const canDeleteSameUserNote = await notesAttachmentPage.tryDeleteOnFirstSameUserNote();
  const isRight4051Assigned = canEditOtherUserNote || canDeleteOtherUserNote;

  console.log(
    `[CD-4884][${status}] RIGHT_ID_4051_ASSIGNED=${isRight4051Assigned ? 'YES' : 'NO'} (other-edit:${canEditOtherUserNote}, other-delete:${canDeleteOtherUserNote}, same-edit:${canEditSameUserNote}, same-delete:${canDeleteSameUserNote})`
  );

  expect(sameUserNotes, `Expected at least one same-user note in ${status}.`).toBeGreaterThan(0);

  if (isRight4051Assigned) {
    expect(
      canEditOtherUserNote,
      `When RIGHT_ID_4051_ASSIGNED=YES, should be able to edit another user note in ${status}.`
    ).toBeTruthy();
    expect(
      canDeleteOtherUserNote,
      `When RIGHT_ID_4051_ASSIGNED=YES, should be able to delete another user note in ${status}.`
    ).toBeTruthy();
    expect(
      canEditSameUserNote,
      `When RIGHT_ID_4051_ASSIGNED=YES, should be able to edit same user note in ${status}.`
    ).toBeTruthy();
    expect(
      canDeleteSameUserNote,
      `When RIGHT_ID_4051_ASSIGNED=YES, should be able to delete same user note in ${status}.`
    ).toBeTruthy();
    return;
  }

  if (status === 'Transmitted') {
    expect(
      canEditOtherUserNote,
      'When RIGHT_ID_4051_ASSIGNED=NO, in Transmitted status should not be able to edit another user note.'
    ).toBeFalsy();
    expect(
      canDeleteOtherUserNote,
      'When RIGHT_ID_4051_ASSIGNED=NO, in Transmitted status should not be able to delete another user note.'
    ).toBeFalsy();
    expect(
      canEditSameUserNote,
      'When RIGHT_ID_4051_ASSIGNED=NO, in Transmitted status should not be able to edit same user note.'
    ).toBeFalsy();
    expect(
      canDeleteSameUserNote,
      'When RIGHT_ID_4051_ASSIGNED=NO, in Transmitted status should not be able to delete same user note.'
    ).toBeFalsy();
    return;
  }

  expect(
    canEditOtherUserNote,
    `User without right ID 4051 should not be able to edit another user note in ${status}.`
  ).toBeFalsy();
  expect(
    canDeleteOtherUserNote,
    `When RIGHT_ID_4051_ASSIGNED=NO, should not be able to delete another user note in ${status}.`
  ).toBeFalsy();
  expect(
    canEditSameUserNote,
    `When RIGHT_ID_4051_ASSIGNED=NO, in Exception should be able to edit same user note.`
  ).toBeTruthy();
  expect(
    canDeleteSameUserNote,
    `When RIGHT_ID_4051_ASSIGNED=NO, in Exception should be able to delete same user note.`
  ).toBeTruthy();
}

test('CD-4884 Notes Attachment - Transmitted @ap', async ({ page }) => {
  // Login is handled in hooks/globalSetup.ts via storageState.
  const notesAttachmentPage = new CD4884NotesAttachmentPage(page);

  await notesAttachmentPage.openHomePage();
  await validateNotesEditDeleteRestrictionForStatus(notesAttachmentPage, 'Transmitted');
});

test('CD-4884 Notes Attachment - Exception @ap', async ({ page }) => {
  const notesAttachmentPage = new CD4884NotesAttachmentPage(page);

  await notesAttachmentPage.openHomePage();
  await validateNotesEditDeleteRestrictionForStatus(notesAttachmentPage, 'Exception');
});
