-- Drop existing policies
DROP POLICY IF EXISTS "Public can view cafe photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload cafe photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update cafe photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete cafe photos" ON storage.objects;

-- Create new policies that work with private bucket + admin client

-- Allow public to SELECT (view) images
CREATE POLICY "Anyone can view cafe photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'cafe-photos');

-- Allow service role (admin) to INSERT
CREATE POLICY "Service role can upload"
ON storage.objects FOR INSERT
TO service_role
WITH CHECK (bucket_id = 'cafe-photos');

-- Allow service role (admin) to UPDATE
CREATE POLICY "Service role can update"
ON storage.objects FOR UPDATE
TO service_role
USING (bucket_id = 'cafe-photos');

-- Allow service role (admin) to DELETE
CREATE POLICY "Service role can delete"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'cafe-photos');
