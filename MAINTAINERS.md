# Maintainer Instructions

## First time signup

- Create an email and a Google account just for this.
- Pay the \$5 developer signup fee to Google by clicking the "Pay this fee now" button at the bottom of the [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/developer/dashboard).
- Register for a [Firefox Add-ons developer account](https://addons.mozilla.org/en-US/developers/).

## Release procedure

- Update the version in `src/manifest.json`
- Commit "Version X.X.X" and push to GitHub.
- Tag a release on GitHub.
- Wait for GitHub Actions to build. Download the artifacts from the completed CI job.
- Rename the zips to `threadloaf-X.X.X.zip` and `source-X.X.X.zip`.
- Add the zips to the release.
- Release to the Firefox Add-ons site.
  - Log into the [Add-on Developer Hub](https://addons.mozilla.org/en-US/developers/).
  - Click "Edit Product Page" under "Threadloaf" under "My Add-ons"
  - Click "Upload New Version" on the left side
  - Click "Select a file..." and pick the zip
  - Click "Continue"
  - Do You Need to Submit Source Code? Click "Yes", select the source zip, and click "Continue"
  - Convert release notes to plain text and paste in
  - Click "Submit Version"
- Release to the Chrome Web Store.
  - Log into the [Developer Dashboard](https://chrome.google.com/u/2/webstore/devconsole/).
  - In the upper right corner, click the "Publisher" dropdown and pick "Threadloaf Publishers".
  - Click on Threadloaf in the list.
  - Click "Store Listing" in the left pane.
  - If there is a "Why can't I publish?" link at the top near the "Save Draft" and "Publish Item" buttons, then click that link, figure out whatever new rule Google instituted that prevents us from publishing, and fix it.
  - Click "Package" in the left pane.
  - Click "Upload Updated Package" in the top bar.
  - Upload the zip.
  - Click Publish Item. Click "PUBLISH" when prompted.
- You're done!

# Reviewer instructions

```
Linux, npm version 9+, and node.js version 18+ are required.
Run `npm run build` from the `src` directory to produce the extension into the `dist` directory.

Test credentials:
Username:
Password:
URL:

This Discord server has a forum channel and a chat channel, both populated with test conversations.
```

Fill in the details above.
If these instructions are updated, then the new instructions must be pasted into AMO's reviewer instructions.

