# Copy this file to meta_config.py and fill in your credentials.
# meta_config.py is in .gitignore and will never be committed.
#
# How to get these values:
#
# META_ACCESS_TOKEN:
#   1. Go to https://developers.facebook.com/tools/explorer/
#   2. Select your app (or create one), select your Page as User or Page
#   3. Add permissions: pages_manage_posts, pages_read_engagement,
#      instagram_basic, instagram_content_publish
#   4. Generate a short-lived token, then exchange it for a long-lived one:
#      GET https://graph.facebook.com/oauth/access_token
#          ?grant_type=fb_exchange_token
#          &client_id=APP_ID
#          &client_secret=APP_SECRET
#          &fb_exchange_token=SHORT_LIVED_TOKEN
#   Long-lived page tokens do not expire as long as they are used periodically.
#
# FACEBOOK_PAGE_ID:
#   Open your Facebook Page → About → scroll to "Page transparency" → Page ID
#   Or: GET https://graph.facebook.com/me/accounts?access_token=TOKEN
#
# INSTAGRAM_ACCOUNT_ID:
#   GET https://graph.facebook.com/{PAGE_ID}?fields=instagram_business_account&access_token=TOKEN

META_ACCESS_TOKEN       = "YOUR_LONG_LIVED_PAGE_ACCESS_TOKEN"
FACEBOOK_PAGE_ID        = "YOUR_FACEBOOK_PAGE_ID"
INSTAGRAM_ACCOUNT_ID    = "YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID"
