import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-server';
import { getServerSession } from '@/lib/auth-server';

/**
 * DELETE /api/images/delete
 * Delete an image from Supabase Storage
 * 
 * Query Parameters:
 * - path: Storage path of the image to delete
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please sign in to delete images.' },
        { status: 401 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter is required' },
        { status: 400 }
      );
    }

    // Verify the image belongs to the user
    // Path format: {cafe_id}/{rating_id or 'cafe'}/{filename}
    const pathParts = path.split('/');
    if (pathParts.length < 3) {
      return NextResponse.json(
        { error: 'Invalid path format' },
        { status: 400 }
      );
    }

    const [, ratingIdOrFolder] = pathParts;

    // If it's a rating photo, verify ownership
    if (ratingIdOrFolder !== 'cafe' && ratingIdOrFolder !== 'rating') {
      // Assume it's a rating ID
      const { data: rating, error: ratingError } = await supabaseAdmin
        .from('ratings')
        .select('user_id')
        .eq('id', ratingIdOrFolder)
        .single();

      if (ratingError || !rating) {
        return NextResponse.json(
          { error: 'Rating not found' },
          { status: 404 }
        );
      }

      if (rating.user_id !== session.user.id) {
        return NextResponse.json(
          { error: 'Unauthorized. You can only delete your own images.' },
          { status: 403 }
        );
      }
    }

    // Delete from storage
    const { error: deleteError } = await supabaseAdmin.storage
      .from('cafe-photos')
      .remove([path]);

    if (deleteError) {
      console.error('Error deleting from storage:', deleteError);
      return NextResponse.json(
        { error: deleteError.message || 'Failed to delete image' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in /api/images/delete:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
