@CD5191 @SmartAP @TaxAuthorityLevel
Feature: Smart AP Tax Authority Level support
  As an Accounts Payable user
  I want Smart AP to support Tax Type 1 tax authority level flags and validations
  So that tax calculations and submissions are compliant and accurate

  Background:
    Given the user has access to Smart AP invoice creation and edit screens
    And company-level Tax Authority Level configuration exists
    And CAS settings are available for:
      | setting_name                               |
      | PSM_APP_SETTING_COMPANY.SHOW_TAX_LEVEL_FIELDS |
      | Department for Tax Authority               |
      | Use Tax Department for GL Validation       |
    And tax percentages and GL/department mappings are configured for valid and invalid paths

  @positive @CD5191-POS-001
  Scenario: Show tax level fields when setting is enabled
    Given SHOW_TAX_LEVEL_FIELDS is ON in CAS
    When the user opens the Smart AP invoice screen
    Then tax level fields L1 to L4 are visible

  @positive @CD5191-POS-002
  Scenario: Hide tax level fields when setting is disabled
    Given SHOW_TAX_LEVEL_FIELDS is OFF in CAS
    When the user opens the Smart AP invoice screen
    Then tax level fields L1 to L4 are hidden

  @positive @CD5191-POS-003
  Scenario: Auto-populate tax authority from subtotal and configured tax percentage
    Given a valid tax percentage is configured for selected tax levels
    And the user has entered invoice lines with a known subtotal
    When the user selects valid tax levels
    Then tax authority values are auto-populated
    And calculated tax amounts are derived from subtotal and configured percentage

  @positive @CD5191-POS-004
  Scenario: Header tax amount is system controlled
    Given the user entered invoice lines and selected tax levels
    When the user tries to manually type in header tax amount
    Then header tax amount remains disabled or read-only

  @positive @CD5191-POS-005
  Scenario: Header tax equals sum of line-level tax
    Given the user has multiple invoice lines with taxable amounts
    When tax is calculated for each line
    Then header tax amount equals the exact sum of all line-level tax amounts

  @positive @CD5191-POS-006
  Scenario: Tax authority GL uses configured department
    Given Department for Tax Authority is configured in CAS
    And invoice tax data is valid
    When the user submits the invoice
    Then tax authority GLs are associated with the configured department

  @positive @CD5191-POS-007
  Scenario: Valid department and GL combination passes validation
    Given Use Tax Department for GL Validation is enabled
    And the invoice uses a valid department and GL combination
    When the user submits the invoice
    Then validation succeeds
    And the invoice proceeds successfully

  @positive @CD5191-POS-008
  Scenario: Invoice-level tax flags persist after save
    Given the user updates tax flags at invoice level
    When the user saves and reopens the invoice
    Then invoice-level tax flag values are persisted

  @positive @CD5191-POS-009
  Scenario: Header-level tax flags persist after save
    Given the user updates tax fields at header level
    When the user saves and reopens the invoice
    Then header-level tax values and flags are persisted

  @positive @CD5191-POS-010
  Scenario: Tax fields are visible and editable where applicable
    Given the user opens invoice detail and header sections
    When the user navigates through tax fields
    Then tax fields are clearly visible
    And editable fields can be updated

  @negative @CD5191-NEG-001
  Scenario: Invalid tax level value is rejected
    Given the user is editing tax level fields
    When the user enters an unsupported tax level ID
    And attempts to save or submit
    Then a validation error is shown
    And invoice processing is blocked until corrected

  @negative @CD5191-NEG-002
  Scenario: Missing mandatory tax level blocks submission
    Given a tax level field is mandatory for the current setup
    When the user leaves the mandatory tax level blank and submits
    Then inline or form-level validation message is shown
    And invoice submission is blocked

  @negative @CD5191-NEG-003
  Scenario: Manual override attempt on header tax is prevented
    Given header tax amount is system derived
    When the user attempts to edit header tax manually
    Then header tax remains non-editable
    And value continues to be system derived

  @negative @CD5191-NEG-004
  Scenario: Invalid department and GL mapping fails validation
    Given Use Tax Department for GL Validation is enabled
    And the invoice contains an invalid department and GL combination
    When the user submits the invoice
    Then validation fails with an invalid combination error
    And invoice is held or blocked

  @negative @CD5191-NEG-005
  Scenario: Invalid tax setup prevents successful submission
    Given tax percentage configuration is incomplete or incorrect
    When the user applies tax flags and submits
    Then the system prevents submission
    And shows an actionable tax setup error

  @negative @CD5191-NEG-006
  Scenario: Inconsistent line and header tax state blocks submission
    Given line-level tax data is incomplete or invalid
    When the user submits the invoice
    Then submission is blocked
    And the user receives an error to correct line tax data

  @negative @CD5191-NEG-007
  Scenario: Unauthorized user cannot edit tax flags
    Given the user role does not have tax edit permission
    When the user attempts to modify tax fields
    Then tax fields are read-only or access is denied
    And an authorization message is shown

  @negative @CD5191-NEG-008
  Scenario: Precision and rounding are handled correctly
    Given the invoice has values causing fractional tax precision edge cases
    When tax is calculated and saved
    Then tax values are rounded according to business rules
    And totals remain consistent without data corruption

  @negative @CD5191-NEG-009
  Scenario: Removing tax level after calculation blocks submission
    Given tax was calculated with a valid tax level
    When the user removes the tax level and submits
    Then validation catches missing tax context
    And submission is blocked

  @negative @CD5191-NEG-010
  Scenario: Concurrent tax field updates are conflict-safe
    Given the same invoice is opened in two sessions
    And session A saves tax flag updates first
    When session B attempts to save conflicting tax updates
    Then the system reports a conflict or requires reload
    And no silent data overwrite occurs
