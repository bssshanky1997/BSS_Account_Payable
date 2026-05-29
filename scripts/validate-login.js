const path = require('path');
const dotenv = require('dotenv');

dotenv.config({
  path: path.resolve(__dirname, '..', '.env'),
  override: true,
});

const LOGIN_URL = 'https://appqa.birchstreet.co/j4/login.jsp';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value.trim();
}

function parseCookieHeader(setCookieHeaders) {
  return setCookieHeaders
    .map((cookie) => cookie.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function isLoginPageHtml(html) {
  const normalized = html.toLowerCase();
  return (
    normalized.includes('id="loginid"') ||
    normalized.includes("id='loginid'") ||
    normalized.includes('name="loginid"') ||
    normalized.includes('name="password"')
  );
}

async function run() {
  const username = requiredEnv('USERNAME');
  const password = requiredEnv('PASSWORD');
  const subscriberId = requiredEnv('SUBSCRIBER_ID');

  const getRes = await fetch(LOGIN_URL, {
    method: 'GET',
    redirect: 'manual',
  });
  const loginHtml = await getRes.text();
  const getCookies = parseCookieHeader(getRes.headers.getSetCookie?.() || []);

  const formData = new URLSearchParams();
  formData.set('loginID', username);
  formData.set('password', password);
  formData.set('subscriberID', subscriberId);

  const postRes = await fetch(LOGIN_URL, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: LOGIN_URL,
      ...(getCookies ? { Cookie: getCookies } : {}),
    },
    body: formData.toString(),
  });

  const location = postRes.headers.get('location') || '';
  const postBody = await postRes.text();
  const postLooksLikeLogin = isLoginPageHtml(postBody);

  const lines = [
    `GET ${LOGIN_URL} -> ${getRes.status}`,
    `POST ${LOGIN_URL} -> ${postRes.status}`,
    `POST location header: ${location || 'none'}`,
    `POST body looks like login page: ${postLooksLikeLogin ? 'yes' : 'no'}`,
  ];

  if (location) {
    const nextUrl = new URL(location, LOGIN_URL).toString();
    const redirectedRes = await fetch(nextUrl, {
      method: 'GET',
      redirect: 'manual',
      headers: getCookies ? { Cookie: getCookies } : undefined,
    });
    const redirectedHtml = await redirectedRes.text();
    lines.push(`Follow-up GET ${nextUrl} -> ${redirectedRes.status}`);
    lines.push(`Follow-up page looks like login page: ${isLoginPageHtml(redirectedHtml) ? 'yes' : 'no'}`);
  }

  const authRejected =
    postRes.status >= 400 ||
    postLooksLikeLogin ||
    (location && location.toLowerCase().includes('/j4/login.jsp')) ||
    (!location && postRes.status === 200 && postLooksLikeLogin);

  lines.push(`Auth verdict: ${authRejected ? 'REJECTED_OR_STAYED_ON_LOGIN' : 'LIKELY_ACCEPTED'}`);
  console.log(lines.join('\n'));

  if (authRejected) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(`Login validation script failed: ${error.message}`);
  process.exitCode = 2;
});
