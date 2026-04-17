# How to Verify All Google Drive Documents Have Been Processed

## Method 1: Check via Admin Panel

1. Go to your admin panel: https://searchtheword.vercel.app/admin
2. Click "Backfill full text from Google" button
3. The API response will show you:
   - `updated`: Documents that were successfully processed
   - `skipped`: Documents that already have text or no Google Drive URL
   - `error`: Documents that failed to process

## Method 2: Check Database Directly

Run this query in your Supabase SQL editor to see processing status:

```sql
SELECT 
  id,
  title,
  CASE 
    WHEN full_text IS NOT NULL AND full_text != '' THEN '✓ Processed'
    WHEN google_drive_url IS NOT NULL OR media_url IS NOT NULL THEN '⏳ Needs Processing'
    ELSE '❌ No Google Drive URL'
  END as status,
  google_drive_url,
  media_url,
  LENGTH(full_text) as text_length
FROM sermons 
ORDER BY 
  CASE 
    WHEN full_text IS NULL THEN 0
    ELSE 1
  END,
  updated_at DESC;
```

## Method 3: Bulk Process All Documents

To ensure all documents are processed, send this API request:

```javascript
// Process up to 40 documents at once (maximum allowed)
fetch('https://searchtheword.vercel.app/api/admin/backfill-full-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    limit: 40,  // Maximum per request
    force: false  // Only process documents without full_text
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Method 4: Force Re-process All Documents

If you want to reprocess everything (including already processed docs):

```javascript
fetch('https://searchtheword.vercel.app/api/admin/backfill-full-text', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    limit: 40,
    force: true  // Re-process all documents with Google Drive URLs
  })
})
.then(response => response.json())
.then(data => console.log(data));
```

## Monitoring Progress

The API processes documents in batches of 40. If you have more than 40 documents:

1. Run the request multiple times
2. Each response shows how many were processed
3. Continue until you get all `skipped` responses

## Expected Results

When processing is complete, you should see:
- All documents with Google Drive URLs have `full_text` populated
- Search results highlight and scroll to relevant passages
- Google Drive documents embed properly on sermon pages

## Troubleshooting

If documents show `error` status:
1. Check if the document is shared with service account email
2. Verify the document is a supported type (Google Doc, Sheet, Slide)
3. Ensure the document URL is accessible

The service account email is: `searchtheword@searchtheword.iam.gserviceaccount.com`
