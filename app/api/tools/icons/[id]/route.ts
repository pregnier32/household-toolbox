import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { supabaseServer } from '@/lib/supabaseServer';

// GET - Fetch icon data for a specific tool icon
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  // Check if user is authenticated
  const user = await getSession();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Handle both async and sync params (Next.js 13+ vs 14+)
    const resolvedParams = await Promise.resolve(params);
    const iconId = resolvedParams.id;

    if (!iconId) {
      return NextResponse.json({ error: 'Icon ID is required' }, { status: 400 });
    }

    // Fetch icon data - Supabase returns BYTEA as a Buffer in Node.js
    // Note: Supabase JS client may return BYTEA as base64-encoded string or Buffer
    // We need to explicitly select icon_data to get the binary data
    const { data: icon, error: iconError } = await supabaseServer
      .from('tool_icons')
      .select('icon_data, icon_url')
      .eq('id', iconId)
      .single();
    
    // Log the raw response to debug
    console.log('Raw Supabase response:', {
      hasData: !!icon,
      hasError: !!iconError,
      error: iconError,
      iconKeys: icon ? Object.keys(icon) : null,
      iconDataValue: icon?.icon_data ? (typeof icon.icon_data) : null
    });

    if (iconError) {
      console.error('Icon fetch error:', iconError);
      // Return a 1x1 transparent PNG instead of JSON so the browser doesn't show broken image
      const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      return new NextResponse(new Uint8Array(transparentPng), {
        status: 404,
        headers: {
          'Content-Type': 'image/png',
        },
      });
    }

    if (!icon) {
      console.error('Icon not found for ID:', iconId);
      // Return a 1x1 transparent PNG instead of JSON
      const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
      return new NextResponse(transparentPng.buffer.slice(transparentPng.byteOffset, transparentPng.byteOffset + transparentPng.byteLength), {
        status: 404,
        headers: {
          'Content-Type': 'image/png',
        },
      });
    }

    console.log('Icon found:', { 
      id: iconId, 
      has_icon_url: !!icon.icon_url, 
      has_icon_data: !!icon.icon_data,
      icon_data_type: typeof icon.icon_data,
      icon_data_is_buffer: Buffer.isBuffer(icon.icon_data),
      icon_data_is_uint8array: icon.icon_data instanceof Uint8Array
    });

    // If icon_url is available, redirect to it
    if (icon.icon_url) {
      return NextResponse.redirect(icon.icon_url);
    }

    // If icon_data is available, serve it
    if (icon.icon_data) {
      // Supabase returns BYTEA as a Buffer in Node.js environment
      let buffer: Buffer;
      
      try {
        if (Buffer.isBuffer(icon.icon_data)) {
          // Already a Buffer - use directly
          buffer = icon.icon_data;
          console.log('Using Buffer directly, length:', buffer.length);
        } else if (typeof icon.icon_data === 'string') {
          // If it's a string, it might be base64 encoded
          // Check if it's already a data URL
          if (icon.icon_data.startsWith('data:')) {
            // Extract base64 part from data URL
            const base64Data = icon.icon_data.split(',')[1];
            buffer = Buffer.from(base64Data, 'base64');
            console.log('Decoded from data URL, length:', buffer.length);
          } else {
            // Assume it's raw base64
            buffer = Buffer.from(icon.icon_data, 'base64');
            console.log('Decoded from base64 string, length:', buffer.length);
          }
        } else if (icon.icon_data instanceof Uint8Array) {
          // Convert Uint8Array to Buffer
          buffer = Buffer.from(icon.icon_data);
          console.log('Converted from Uint8Array, length:', buffer.length);
        } else if (Array.isArray(icon.icon_data)) {
          // If it's an array of numbers, convert to Buffer
          buffer = Buffer.from(icon.icon_data);
          console.log('Converted from array, length:', buffer.length);
        } else {
          // Try to convert to buffer directly
          buffer = Buffer.from(icon.icon_data as any);
          console.log('Converted directly, length:', buffer.length);
        }
        
        if (!buffer || buffer.length === 0) {
          console.error('Invalid icon data buffer - empty or null');
          // Return a 1x1 transparent PNG instead of JSON
          const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
          return new NextResponse(transparentPng.buffer, {
            status: 500,
            headers: {
              'Content-Type': 'image/png',
            },
          });
        }
        
        console.log('Serving icon, buffer length:', buffer.length);
        // Convert Buffer to Uint8Array for NextResponse (which accepts BodyInit types)
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': 'image/jpeg',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      } catch (bufferError) {
        console.error('Error converting icon_data to buffer:', bufferError, bufferError instanceof Error ? bufferError.stack : '');
        // Return a 1x1 transparent PNG instead of JSON
        const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
        return new NextResponse(transparentPng.buffer.slice(transparentPng.byteOffset, transparentPng.byteOffset + transparentPng.byteLength), {
          status: 500,
          headers: {
            'Content-Type': 'image/png',
          },
        });
      }
    }

    console.error('No icon_url or icon_data found for icon:', iconId);
    // Return a 1x1 transparent PNG instead of JSON
    const transparentPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    return new NextResponse(transparentPng.buffer.slice(transparentPng.byteOffset, transparentPng.byteOffset + transparentPng.byteLength), {
      status: 404,
      headers: {
        'Content-Type': 'image/png',
      },
    });
  } catch (error) {
    console.error('Error fetching icon:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

