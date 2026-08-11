import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary with server-side credentials
cloudinary.config({
  cloud_name: process.env.VITE_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an avatar image to Cloudinary, replacing any existing avatar for this user.
 * Uses a deterministic public_id so each user only ever has ONE avatar asset.
 */
export async function uploadAvatar(userId: string, base64Data: string): Promise<string> {
  const result = await cloudinary.uploader.upload(base64Data, {
    public_id: `mesh_avatars/avatar_${userId}`,
    overwrite: true,
    invalidate: true,
    transformation: [
      { width: 300, height: 300, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

  return result.secure_url;
}

/**
 * Delete a user's avatar from Cloudinary.
 */
export async function deleteAvatar(userId: string): Promise<void> {
  try {
    await cloudinary.uploader.destroy(`mesh_avatars/avatar_${userId}`, {
      invalidate: true,
    });
  } catch (err) {
    console.warn('Failed to delete avatar from Cloudinary:', err);
  }
}
