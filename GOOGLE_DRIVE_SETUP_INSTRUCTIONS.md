# Google Drive Sharing Instructions for SearchTheWord

## What You Need to Do

To make sermon documents display properly on the SearchTheWord website, you need to share your Google Drive documents with a special service account email.

## Step 1: Share Your Google Documents

**Service Account Email:** `searchtheword@searchtheword.iam.gserviceaccount.com`

### Option A: Share Individual Documents
For each sermon document you want to display:
1. Open the Google Doc/Sheet/Slide
2. Click the "Share" button (top right)
3. Enter: `searchtheword@searchtheword.iam.gserviceaccount.com`
4. Set permission to "Viewer"
5. Click "Send"

### Option B: Share Entire Folder (Recommended)
1. Create a folder in Google Drive for all sermon documents
2. Move all sermon documents into this folder
3. Right-click the folder and select "Share"
4. Enter: `searchtheword@searchtheword.iam.gserviceaccount.com`
5. Set permission to "Viewer"
6. Click "Send"

## Step 2: Verify the Documents Work

After sharing:
1. Go to your SearchTheWord website
2. Search for any sermon
3. Click on a result
4. The "Source document" section should now show the actual Google Doc instead of a permission message

## What This Fixes

- **Before**: Shows "If the preview is blank, you may need permission to view this file"
- **After**: Shows the actual Google Doc with passage highlighting and navigation

## Why This Is Needed

The website uses a special Google service account to access and display documents. This service account needs explicit permission to view your files, just like sharing with any other person.

## Questions?

If you have any issues:
- Make sure you're using the exact email: `searchtheword@searchtheword.iam.gserviceaccount.com`
- Ensure permissions are set to "Viewer" (not "Commenter" or "Editor")
- Allow a few minutes for permissions to take effect

## Technical Note

This service account is a secure, automated system that only has read-only access to your documents. It cannot modify or delete anything - it only displays the content for website visitors.
