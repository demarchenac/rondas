import { action } from './_generated/server';
import { v } from 'convex/values';

export const getUploadUrl = action({
  args: { fileType: v.string() },
  handler: async (_ctx, _args) => {
    // TODO: Generate presigned upload URL via UploadThing API
    // Requires UPLOADTHING_TOKEN in Convex env vars
    throw new Error('UploadThing not yet configured');
  },
});
