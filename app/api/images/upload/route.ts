import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from '@/lib/auth-server';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/**
 * POST /api/images/upload
 * Upload an image to Supabase Storage
 * 
 * Body (FormData):
 * - file: Image file
 * - cafeId: UUID of the cafe
 * - ratingId: (optional) UUID of the rating if uploading for a rating
 * - folder: (optional) 'cafe' or 'rating', defaults based on ratingId
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to upload images.' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const cafeId = formData.get('cafeId') as string;
    const ratingId = formData.get('ratingId') as string | null;
    const folder = formData.get('folder') as string | null;

    // Validate inputs
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!cafeId) {
      return NextResponse.json(
        { error: 'cafeId is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File size too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    // Verify cafe exists
    const { data: cafe, error: cafeError } = await supabaseAdmin
      .from('cafes')
      .select('id')
      .eq('id', cafeId)
      .single();

    if (cafeError || !cafe) {
      return NextResponse.json(
        { error: 'Cafe not found' },
        { status: 404 }
      );
    }

    // If ratingId provided, verify it exists and belongs to the user
    if (ratingId) {
      const { data: rating, error: ratingError } = await supabaseAdmin
        .from('ratings')
        .select('id, user_id, cafe_id')
        .eq('id', ratingId)
        .single();

      if (ratingError || !rating) {
        return NextResponse.json(
          { error: 'Rating not found' },
          { status: 404 }
        );
      }

      if (rating.user_id !== session.user.id) {
        return NextResponse.json(
          { error: 'Unauthorized. You can only upload images to your own ratings.' },
          { status: 403 }
        );
      }

      if (rating.cafe_id !== cafeId) {
        return NextResponse.json(
          { error: 'Rating does not belong to this cafe' },
          { status: 400 }
        );
      }
    }

    // Determine folder structure
    const folderType = folder || (ratingId ? 'rating' : 'cafe');
    const folderPath = ratingId 
      ? `${cafeId}/${ratingId}`
      : `${cafeId}/${folderType}`;

    // Generate unique filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${timestamp}-${Math.random().toString(36).substring(7)}.${fileExtension}`;
    const filePath = `${folderPath}/${fileName}`;

    // Convert File to ArrayBuffer for Supabase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage using admin client
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('cafe-photos')
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading to storage:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('cafe-photos')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: filePath,
    });
  } catch (error) {
    console.error('Error in /api/images/upload:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
