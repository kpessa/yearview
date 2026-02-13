import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');

  if (!code || state !== 'google_calendar_auth') {
    return NextResponse.redirect(new URL('/?google_auth_error=missing_code', request.url));
  }

  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing Google OAuth credentials');
    return NextResponse.redirect(new URL('/?google_auth_error=config', request.url));
  }

  const redirectUri = `${request.nextUrl.origin}/api/google/callback`;

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return NextResponse.redirect(new URL('/?google_auth_error=token_exchange', request.url));
    }

    // Redirect back to the app with the token in the hash fragment
    // The hash is not sent to the server, so it's safe for the client to read
    const redirectUrl = new URL('/', request.url);
    redirectUrl.hash = `access_token=${tokenData.access_token}&state=google_calendar_auth`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    return NextResponse.redirect(new URL('/?google_auth_error=server_error', request.url));
  }
}
