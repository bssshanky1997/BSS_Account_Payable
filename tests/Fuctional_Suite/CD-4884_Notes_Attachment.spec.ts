import { test, expect } from '../../fixtures/testFixture';
import { CD4884NotesAttachmentPage } from '../../pages/Fuctional_Suite/CD_4884_Notes_Attachment_Page';

type NotesCapability = {
  otherEdit: boolean;
  otherDelete: boolean;
  sameEdit: boolean;
  sameDelete: boolean;
};

type NotesStatus = 'Transmitted' | 'Exception';
const NOTES_STATUSES: NotesStatus[] = ['Transmitted', 'Exception'];

async function readNotesCapabilityForStatus(
  notesAttachmentPage: CD4884NotesAttachmentPage,
  status: NotesStatus,
  skipWhenDataMissing: boolean
): Promise<NotesCapability> {
  await notesAttachmentPage.openHomePage();
  await notesAttachmentPage.navigateToNotesForStatus(status);

  const totalNotes = await notesAttachmentPage.totalNotesCount();
  if (totalNotes === 0 && skipWhenDataMissing) {
    test.skip(true, `[CD-4884][${status}] Skipped: no notes available in this status for capability validation.`);
  }
  expect(totalNotes, `Expected at least one note in ${status} Notes section.`).toBeGreaterThan(0);

  const otherUserNotes = await notesAttachmentPage.otherUserNotesCount();
  if (otherUserNotes === 0 && skipWhenDataMissing) {
    test.skip(
      true,
      `[CD-4884][${status}] Skipped: no other-user notes available to validate restriction behavior.`
    );
  }
  expect(
    otherUserNotes,
    `Expected another user note in ${status} to validate edit/delete restriction without right ID 4051.`
  ).toBeGreaterThan(0);

  const sameUserNotes = await notesAttachmentPage.sameUserNotesCount();
  if (sameUserNotes === 0 && skipWhenDataMissing) {
    test.skip(true, `[CD-4884][${status}] Skipped: no same-user notes available for own-note validation.`);
  }
  expect(sameUserNotes, `Expected at least one same-user note in ${status}.`).toBeGreaterThan(0);

  return {
    otherEdit: await notesAttachmentPage.tryEditOnFirstOtherUserNote(),
    otherDelete: await notesAttachmentPage.tryDeleteOnFirstOtherUserNote(),
    sameEdit: await notesAttachmentPage.tryEditOnFirstSameUserNote(),
    sameDelete: await notesAttachmentPage.tryDeleteOnFirstSameUserNote(),
  };
}

function assertCapabilityByExpected(
  capability: NotesCapability,
  expected: NotesCapability,
  scenarioLabel: string,
  status: NotesStatus
): void {
  expect(
    capability.otherEdit,
    `[CD-4884][${scenarioLabel}][${status}] other-user edit mismatch.`
  ).toBe(expected.otherEdit);
  expect(
    capability.otherDelete,
    `[CD-4884][${scenarioLabel}][${status}] other-user delete mismatch.`
  ).toBe(expected.otherDelete);
  expect(
    capability.sameEdit,
    `[CD-4884][${scenarioLabel}][${status}] same-user edit mismatch.`
  ).toBe(expected.sameEdit);
  expect(
    capability.sameDelete,
    `[CD-4884][${scenarioLabel}][${status}] same-user delete mismatch.`
  ).toBe(expected.sameDelete);
}

async function validateForStatusWithExpected(
  notesAttachmentPage: CD4884NotesAttachmentPage,
  status: NotesStatus,
  expected: NotesCapability,
  scenarioLabel: string,
  skipWhenDataMissing: boolean
): Promise<void> {
  const capability = await readNotesCapabilityForStatus(notesAttachmentPage, status, skipWhenDataMissing);
  console.log(`[CD-4884][${scenarioLabel}][${status}] capability: ${JSON.stringify(capability)}`);
  assertCapabilityByExpected(capability, expected, scenarioLabel, status);
}

async function validateScenario(
  notesAttachmentPage: CD4884NotesAttachmentPage,
  expectedByStatus: Record<NotesStatus, NotesCapability>,
  scenarioLabel: string,
  skipWhenDataMissing: boolean
): Promise<void> {
  for (const status of NOTES_STATUSES) {
    await validateForStatusWithExpected(
      notesAttachmentPage,
      status,
      expectedByStatus[status],
      scenarioLabel,
      skipWhenDataMissing
    );
  }
}

test('CD-4884 Notes Attachment - Unified Flow @ap', async ({ page, positionRightsApi }) => {
  test.setTimeout(420_000);
  // Login is handled in hooks/globalSetup.ts via storageState.
  const notesAttachmentPage = new CD4884NotesAttachmentPage(page);
  const positionId = Number(process.env.RIGHTS_POSITION_ID || '2');
  const rightId = Number(process.env.RIGHTS_TARGET_ID || '4051');
  const appName = process.env.RIGHTS_APPLICATION_NAME || 'PROCUREMENT';
  const paramRightId = Number(process.env.CD4884_PARAM_ID || '2097');
  const paramScreenId = process.env.CD4884_PARAM_SCREEN_ID || '10806';
  const paramAppName = process.env.CD4884_PARAM_APPLICATION_NAME || appName;
  const skipWhenDataMissing = String(process.env.CD4884_SKIP_WHEN_NOTES_DATA_MISSING || 'true').toLowerCase() === 'true';
  const canModifyOwnNotesInTransmittedWhen4051NotAssigned =
    String(process.env.CD4884_TRANSMITTED_OWN_NOTES_WHEN_4051_OFF || 'true').toLowerCase() === 'true';
  let isParamRight2097AssignedInFlow = false;
  const expectedWhen4051NotAssigned: Record<NotesStatus, NotesCapability> = {
    Transmitted: {
      otherEdit: false,
      otherDelete: false,
      sameEdit: canModifyOwnNotesInTransmittedWhen4051NotAssigned,
      sameDelete: canModifyOwnNotesInTransmittedWhen4051NotAssigned,
    },
    Exception: { otherEdit: false, otherDelete: false, sameEdit: true, sameDelete: true },
  };
  const expectedWhen4051Assigned: Record<NotesStatus, NotesCapability> = {
    Transmitted: { otherEdit: true, otherDelete: true, sameEdit: true, sameDelete: true },
    Exception: { otherEdit: true, otherDelete: true, sameEdit: true, sameDelete: true },
  };
  const expectedWhenParam2097AssignedAnd4051NotAssigned: Record<NotesStatus, NotesCapability> = {
    Transmitted: { otherEdit: false, otherDelete: false, sameEdit: false, sameDelete: false },
    Exception: { otherEdit: false, otherDelete: false, sameEdit: true, sameDelete: true },
  };

  try {
    // Scenario 1: Right ID 4051 not assigned.
    await positionRightsApi.disableRight(positionId, rightId, appName);
    await validateScenario(
      notesAttachmentPage,
      expectedWhen4051NotAssigned,
      'RIGHT_ID_4051_NOT_ASSIGNED',
      skipWhenDataMissing
    );

    // Scenario 2: Right ID 4051 assigned.
    await positionRightsApi.enableRight(positionId, rightId, appName);
    await validateScenario(
      notesAttachmentPage,
      expectedWhen4051Assigned,
      'RIGHT_ID_4051_ASSIGNED',
      skipWhenDataMissing
    );

    // Scenario 3: Param 2097 (screen 10806) assigned + Right ID 4051 not assigned.
    await positionRightsApi.enableRight(positionId, paramRightId, paramAppName);
    isParamRight2097AssignedInFlow = true;
    await positionRightsApi.disableRight(positionId, rightId, appName);
    await validateScenario(
      notesAttachmentPage,
      expectedWhenParam2097AssignedAnd4051NotAssigned,
      `PARAM_${paramRightId}_ASSIGNED_SCREEN_${paramScreenId}_AND_RIGHT_ID_4051_NOT_ASSIGNED`,
      skipWhenDataMissing
    );
  } finally {
    await positionRightsApi.enableRight(positionId, rightId, appName).catch((error) => {
      console.error(`[CD-4884][Unified] Failed to restore right ${rightId}:`, error);
    });
    if (isParamRight2097AssignedInFlow) {
      await positionRightsApi.disableRight(positionId, paramRightId, paramAppName).catch((error) => {
        console.error(`[CD-4884][Unified] Failed to restore param/right ${paramRightId}:`, error);
      });
    }
  }
});
