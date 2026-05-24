import { test, expect } from '../../fixtures/testFixture';
import { login_landing } from '../../utils/login_landing';

test('CD-4884 Allow User Edit Delete @ap', async ({ page }) => {
  const appPage = await login_landing(page);
  await expect(appPage).toHaveURL(/birchstreet/i);
});
