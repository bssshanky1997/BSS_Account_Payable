import { test, expect } from '../../fixtures/testFixture';
import { CD4884NotesAttachmentPage } from '../../pages/Fuctional_Suite/CD_4884_Notes_Attachment_Page';

type NotesCapability = {
  otherEdit: boolean;
  otherDelete: boolean;
  sameEdit: boolean;
  sameDelete: boolean;
};

async function readNotesCapabilityForStatus(
  notesAttachmentPage: CD4884NotesAttachmentPage,
  status: 'Transmitted' | 'Exception'
): Promise<NotesCapability> {
  await notesAttachmentPage.openHomePage();
  await notesAttachmentPage.navigateToNotesForStatus(status);

  const totalNotes = await notesAttachmentPage.totalNotesCount();
  expect(totalNotes, `Expected at least one note in ${status} Notes section.`).toBeGreaterThan(0);

  const otherUserNotes = await notesAttachmentPage.otherUserNotesCount();
  expect(
    otherUserNotes,
    `Expected another user note in ${status} to validate edit/delete restriction without right ID 4051.`
  ).toBeGreaterThan(0);

  const sameUserNotes = await notesAttachmentPage.sameUserNotesCount();
  expect(sameUserNotes, `Expected at least one same-user note in ${status}.`).toBeGreaterThan(0);

  return {
    otherEdit: await notesAttachmentPage.tryEditOnFirstOtherUserNote(),
    otherDelete: await notesAttachmentPage.tryDeleteOnFirstOtherUserNote(),
    sameEdit: await notesAttachmentPage.tryEditOnFirstSameUserNote(),
    sameDelete: await notesAttachmentPage.tryDeleteOnFirstSameUserNote(),
  };
}

async function validateBaselineRulesForStatus(
  notesAttachmentPage: CD4884NotesAttachmentPage,
  status: 'Transmitted' | 'Exception'
): Promise<void> {
  const capability = await readNotesCapabilityForStatus(notesAttachmentPage, status);
  const canEditOtherUserNote = capability.otherEdit;
  const canDeleteOtherUserNote = capability.otherDelete;
  const canEditSameUserNote = capability.sameEdit;
  const canDeleteSameUserNote = capability.sameDelete;
  const isRight4051Assigned = canEditOtherUserNote || canDeleteOtherUserNote;

  console.log(
    `[CD-4884][${status}] RIGHT_ID_4051_ASSIGNED=${isRight4051Assigned ? 'YES' : 'NO'} (other-edit:${canEditOtherUserNote}, other-delete:${canDeleteOtherUserNote}, same-edit:${canEditSameUserNote}, same-delete:${canDeleteSameUserNote})`
  );

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

function assertAllDisabled(capability: NotesCapability): void {
  expect(capability.otherEdit, 'After disabling 4051, other-user edit must be blocked.').toBeFalsy();
  expect(capability.otherDelete, 'After disabling 4051, other-user delete must be blocked.').toBeFalsy();
  expect(capability.sameEdit, 'After disabling 4051, same-user edit must be blocked.').toBeFalsy();
  expect(capability.sameDelete, 'After disabling 4051, same-user delete must be blocked.').toBeFalsy();
}

function assertAllEnabled(capability: NotesCapability): void {
  expect(capability.otherEdit, 'After enabling 4051, other-user edit must be allowed.').toBeTruthy();
  expect(capability.otherDelete, 'After enabling 4051, other-user delete must be allowed.').toBeTruthy();
  expect(capability.sameEdit, 'After enabling 4051, same-user edit must be allowed.').toBeTruthy();
  expect(capability.sameDelete, 'After enabling 4051, same-user delete must be allowed.').toBeTruthy();
}

test('CD-4884 Notes Attachment - Unified Flow @ap', async ({ page, positionRightsApi }) => {
  test.setTimeout(420_000);
  // Login is handled in hooks/globalSetup.ts via storageState.
  const notesAttachmentPage = new CD4884NotesAttachmentPage(page);
  const positionId = Number(process.env.RIGHTS_POSITION_ID || '2');
  const rightId = Number(process.env.RIGHTS_TARGET_ID || '4051');
  const appName = process.env.RIGHTS_APPLICATION_NAME || 'PROCUREMENT';
  let wasRestoredInFlow = false;

  await validateBaselineRulesForStatus(notesAttachmentPage, 'Transmitted');
  await validateBaselineRulesForStatus(notesAttachmentPage, 'Exception');

  try {
    await positionRightsApi.disableRight(positionId, rightId, appName);
    const offCapability = await readNotesCapabilityForStatus(notesAttachmentPage, 'Transmitted');
    console.log(`[CD-4884][Unified] RIGHT_ID_4051_ASSIGNED=NO capability: ${JSON.stringify(offCapability)}`);
    assertAllDisabled(offCapability);

    await positionRightsApi.enableRight(positionId, rightId, appName);
    wasRestoredInFlow = true;

    const onCapability = await readNotesCapabilityForStatus(notesAttachmentPage, 'Transmitted');
    console.log(`[CD-4884][Unified] RIGHT_ID_4051_ASSIGNED=YES capability: ${JSON.stringify(onCapability)}`);
    assertAllEnabled(onCapability);
  } finally {
    if (!wasRestoredInFlow) {
      await positionRightsApi.enableRight(positionId, rightId, appName).catch((error) => {
        console.error(`[CD-4884][Unified] Failed to restore right ${rightId}:`, error);
      });
    }
  }
});
