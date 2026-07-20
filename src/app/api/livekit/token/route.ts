import { AccessToken } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { sessionCode, studentId, isTeacher } = await req.json();

    if (!sessionCode || !studentId) {
      return NextResponse.json({ error: 'Session code and student ID are required' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      console.error('LIVEKIT_API_KEY or LIVEKIT_API_SECRET is not configured');
      return NextResponse.json({ error: 'LiveKit credentials are not configured' }, { status: 500 });
    }

    const roomName = `ai-class-${sessionCode}`;

    // Create a new access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: studentId,
      name: isTeacher ? 'Teacher' : 'Student',
    });

    // Grant permissions to join the specific room and publish video
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    return NextResponse.json({ token: await at.toJwt() });
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
