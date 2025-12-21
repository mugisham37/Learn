/**
 * GraphQL API Route
 *
 * Placeholder GraphQL API route for Next.js App Router.
 * In production, this would proxy to the actual GraphQL server.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    message: 'GraphQL endpoint - use POST for queries',
    playground: process.env.NODE_ENV === 'development' ? '/api/graphql/playground' : null
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // In production, this would proxy to the actual GraphQL server
    const graphqlEndpoint = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';
    
    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...Object.fromEntries(request.headers.entries()),
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    return NextResponse.json(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('GraphQL proxy error:', error);
    
    return NextResponse.json(
      { 
        errors: [{ 
          message: 'Internal server error',
          extensions: { code: 'INTERNAL_ERROR' }
        }] 
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}