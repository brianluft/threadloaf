AIs do not update this file. Humans only.

# Multi-server support (API)
We support only a single GUILD_ID. We need to support monitoring multiple independent servers.

- [X] Environment file will provide a list of guild IDs instead of just one.
- [X] API: Use a separate DiscordClient and DataStore per guild to keep them separate.
- [X] Update API endpoints so they all take a guild ID in the URL path, at the beginning. e.g. `/:guildId/messages/:channelId`.
- [X] Return a 400 error if the client's guild ID is not one of our configured guild IDs, but don't leak what the right ones are.
- [X] Update readme and test.http with updated endpoints
- [X] Update tests and regain 100% code/branch test coverage.

# Return messages from multiple channels in one request (API)
Our design for `/:guildId/messages/:channelId` forces the client to make lots of requests. Let's fix that.

- [X] Instead of a single channel ID in the url path, make it multiple channel IDs in a JSON POST body.
- [X] Change the JSON response to an object where the channel IDs are keys and the list of messages are values.
- [X] Add a mandatory property to the JSON: `maxMessagesPerChannel`. Limit the response to the most recent messages up to this limit *per channel*.
- [X] Update tests and regain 100% code/branch test coverage.

# OAuth2 authentication (API and browser extension)
Our API does not implement authentication at all, it's open to the public.
We will use one short OAuth2 sign-in the first time a member installs the browser extension; after that, every request the extension makes to our HTTP API is automatically authenticated with a signed JWT that the  back-end knows how to verify.

- [X] Read AUTHENTICATION.md with a complete description of the technique.
- [X] Environment file will provide signing secret. Update Discord Bot Setup readme to describe how to generate this.
- [X] Update readme Discord Bot Setup section, we need a second OAuth2 application for Threadloaf Login. The redirect needs to be some path in http://localhost:3000 for our testing.
- [X] In the browser extension's user options popup, add a group box "Chatty@Home API".
    - [X] Instruction label that explains that members of the Chatty@Home discord server (only) have access to an online API enabling extra features. They must log in for these features to become enabled.
    - [X] Label "Login:", value is a read-only label "not logged in" (which becomes "logged in") and a 
    button "Log in" (which becomes "Log out"). The button kicks off the OAuth2 login process in a new window. If we're logged in, we show that and the button is for logging out. The login must be persisted across sessions.
    - [X] When logged in, the normally-disabled options inside the group box are enabled. For now there's only one, the following:
    - [X] Slider for "Number of most recent thread replies to show in thread list:" (find more concise wording for this) from 0 to 20
- [X] Implement the login flow on the server and client sides both. The client should end up holding a token signed by the server that it can use to make API calls. The client should persist this token.
- [X] We want the token to last forever. We do not implement revocation.
- [X] Update tests and regain 100% code/branch test coverage.

# Authorization (API)
All of our API endpoints need to take an API token and verify that the user is a member of the guild specified in their request.

- [X] Create an authorization cache that remembers that a given token (from which we can get the user id) is a member of a given guild. Cache entries expire after 24 hours.
- [X] Create a function that inquires whether a given token is a member of a given guild. Check the cache first, on cache miss go to the discord API to check.
- [X] Update all API endpoints (except health) so they require an API token. Validate the token and validate that they are a member of the specified guild using the cache.
- [X] Update tests and regain 100% code/branch test coverage.

# Show recent replies underneath threads in the thread list
Read THREAD_LIST_EXAMPLE.html, an export of the Discord forum channel's thread list HTML.
We are going to bulk load the recent replies to the threads we see and display them underneath the thread.
This gives the user a quick at-a-glance preview of each thread's recent activity.

- [X] This functionality is disabled by default and enabled when the user logs into the user options and moves the "Number of most recent thread replies to show in thread list:" slider above zero.
- [X] We already have a DOM watcher, don't add a new one. Modify it to detect when new thread list entries are added to the DOM. It's the li.card_* element.
- [X] Debounce these events for new thread list entries, because they will come in fast when the user is scrolling. Don't fire the debounced event until the events stop for 1 full second.
- [X] When we get the debounced event, collect all the visible thread IDs (these are channel IDs and embedded in the `data-item-id` attribute on the div.mainCard_*, first child of li.card_*).
- [X] Call our API in the background to retrieve the last N messages for those threads. If a previous API call is still in flight, cancel it and issue a new one. N is the number the user configured in the user options, the slider for the number of msot recent thread replies to show in the thread list.
- [X] Update the DOM to show those messages underneath each thread in the thread list. Make sure you update the correct DOM element in case it changed while the API call was in flight; verify the `data-item-id`.
- [X] Don't show errors to the user, just log them to the console.

# Bugs
- [x] UI improvements to the browser extension's user options popup, in the new Chatty@Home API section
    - [x] Remove the "Login:" label and simply write "Not logged in" or "Logged in" with the button.
    - [x] Capitalize "Discord"
    - [x] Make the instructions ("Members of the...") more succinct. One sentence only.
- [x] OAuth2 debugging
    - [x] When I click the log in button, the login window doesn't appear, and this is logged to the console: "Cross-Origin Request Blocked: The Same Originl Policy disallows reading the remote resource at http://localhost:3000/auth/config. (Reason: CORS header 'Access-Control-Allow-Origin' missing). Status code: 200.
- [x] In the extension user options popup, if the user clicks Log In button, and request for /auth/config fails, show an error message. *Something* must happen when clicking the button, either the login window appears or an error does. An alert is fine as this is rare. 
- [x] We have an alert() in our extension's user options popup. eslint doesn't like that and it fails the build. Replace it with a red error label underneath the line containing the Log In button.
- [x] After clicking "Log in" in the extension's user options popup and then completing Discord's OAuth2 login flow, we redirect to http://localhost:3000/auth/callback. This is just a blank page and logs the following to the console. The user options don't get updated to show that we are logged in.
    Uncaught TypeError: window.opener is null
        <anonymous> http://localhost:3000/auth/callback?code=pfkQfc2ozQJinIXEAifakIJEf3lPk8&state=bb4841d0-dbe9-4f23-85fa-f7ed1c987885:3
    callback:3:25
- [x] Extension user options popup - our login OAuth2 flow redirects back to our callback and then closes the login window, as expected. But then the user options popup's "Not logged in" label doesn't change. It doesn't seem to have gotten the message that we are logged in. Reloading the extension doesn't change it either; it seems the token was not persisted either.

# Thread list reply preview tweaks (threadloaf)
- [x] Our DOM watcher debounces new thread list entries so we don't send a lot of API calls when the user scrolls the thread list rapidly. We wait 1000ms. Make it 500ms.
- [x] Add a special case. When the very first thread list entry appears--the first one we ever see in a given page session--make the debounce 50ms. We want to very quickly kick off the first API call when the user first opens the thread list. After that first API call, return the debounce interval to 500ms.
- [x] Small changes to the appearance of the replies under each thread list element
    - [x] Add padding to the left of the replies block, so the purple left border is offset to the right a bit. The user's eye will jump between the threads on the far left side, we don't want the replies there to confuse things.
    - [x] Remove margin above the reply list and below the thread, we want the reply list (with its purple left border) to actually touch the thread box to ensure the user can visually see that they go together.
    - [x] In each reply we have "author:text" jammed together just like that; add space after the colon.
    - [x] The replies should all be clickable, they open the thread just like clicking on the main thread list element for a thread does.

# Bugs
- [x] The first time I open the thread list for a forum channel, our reply previews show correctly. If I switch to a chat channel and then return to the forum channel, our reply previews do not show. The reply previews never return after that. No further API calls are made. I have Dev Tools and can poke around if you need.
- [x] *Every* time we get a (debounced) "new thread in the thread list" event, we need to send the API call for *all* visible threads. Even if we've seen them all before. Keep a cache for quick reaction so the replies appear immediately, but always update that cache from the server on this event and update the previews asynchronously when the response comes in.

# Thread list reply previews
- [x] When a thread list is visible, show a "Refresh Replies" button to the right of the existing "Sort & View" button. Read context/THREAD_LIST_EXAMPLE.html for the HTML. The button will do the same thing that our DOM watcher's "new thread list element" event does: it collects all the visible thread IDs, issues the API call, and when the API call comes back it updates the displayed thread replies. The button itself is disabled while the API call is in flight so the user can't keep clicking it.

# Bugs
- [x] Read project/FINISHED.md to remember what we did about the debounce of the "new thread in thread list" event from the DOM observer. Now, we are issuing the API call _every_ 500 milliseconds, even when the user is idle. We only want to issue the API call on some kind of user-driven transition, where either a new thread div is created, or an existing hidden one is shown.
- [x] In the thread list, our thread reply preview list is currently newest-first. It needs to be oldest-first. We are showing the most recent N replies, with the most recent one at the bottom. Yet, when we hit Refresh and get new posts, _those_ show up at the bottom. Make sure the replies preview list is _always_ sorted in ascending chronological order.
- [x] Our "Refresh Replies" button has an SVG icon, replace it with the ↻ symbol. Make sure the symbol and the text are always on a single line; right now the SVG is on the first line and the text is on a second line, making the button taller than intended.
- [x] The API's {{baseUrl}}/{{guildId}}/messages endpoint is returning the _oldest_ N messages per channel. It needs to return the _newest_ N messages per channel. Prove it to yourself:
    - Run the server with scripts/start-api.sh
    - Test this; we expect this to return the 1 most recent post.
        ```
        curl -X POST http://localhost:3000/1334738912756895836/messages -H "Content-Type: application/json" -d '{"channelIds": ["1378262084390883328"],"maxMessagesPerChannel": 1}'
        ```
    - Now test it again with `"maxMessagesPerChannel": 2`. We expect to get the same 1 most recent post plus one _older_ post. But look at the timestamps! The additional post we get is _newer_ than the one we got before.
    - FYI: The oldest message is "Testing, testing, 1, 2, 3". The second-oldest message is "Another message". The _newest_ message is "Testing 5" which does not appear. You should see "Testing 5" appear when requesting the 1 most recent message.
- [x] The "Refresh Replies" API request is super fast. We disable the button while the request is in flight, but it's so fast that the user doesn't see it. Keep the button disabled for an additional 1 second after the response comes in.
- [x] The "Refresh Replies" button currently has no feedback when it's disabled. It should visibly gray out, the border should lighten, and the cursor should be the default instead of the hand.
- [x] The "Refresh Replies" button should only appear when the user is logged into our API from the user options and they have set the number of thread replies > 0.
- [x] Read project/FINISHED.md to remind yourself about when we fixed an issue where the replies list would stop appearing when switching away from a forum channel and then switching back. That's still OK, but there's a related issue. If I switch from a forum channel to a _thread_, then no forum channel _on that server_ ever shows the replies list or the "Refresh Replies" button again, and no API call is made. But forum channels on _other_ servers do continue to work and those API calls are made. You may need my help with Dev Tools for this; if so, add console logging, tell me how to test it, and I'll give you the log.

# HTTPS support with Let's Encrypt
- [x] Add Let's Encrypt support to the api.
    - [x] HTTP-01 challenge method
    - [x] In production the domain is api.threadloaf.com
    - [x] Add Let's Encrypt credentials and configuration to .env / example.env
    - [x] Make it optional. When debugging locally we want HTTP only with Let's Encrypt functionality disabled.
    - [x] In production, our API endpoints must mandate HTTPS. If the user makes such a request via plaintext HTTP, return a 4xx error with a stern message without taking any action.
    - [x] In production, only the Let's Encrypt acme challenge endpoint should be exposed via HTTP since that is required.
    - [x] DON'T redirect from HTTP to HTTPS. Our endpoints should actually fail. Don't enable client sloppiness.
    - [x] In debug mode, Let's Encrypt is disabled and all endpoints are exposed via HTTP.
- [x] We are conditionally importing acme-client only in non-test mode in lets-encrypt.ts. This is causing endless problems. Eliminate conditional import of acme-client. Always import it. Find a different way to work around whatever issues crop up when we import acme-client in test mode. We likely want to import it for real and then mock it in tests.
- [x] Verify that no other conditional imports exist in the codebase. Then, update global.mdc to add a rule: never use conditional imports.

- [x] Add an AWS terraform configuration for the api. Absolutely everything required, so it can be deployed to a fresh blank AWS account. Do not deploy it; only create the configuration in a `terraform/` folder. You can initialize the terraform configuration and run `terraform plan` but do not apply.
    - [x] us-east-2c
    - [x] Terraform S3 backend, bucket name "threadloaf-terraform-prod".
    - [x] VPC
    - [x] Parameter Store parameter for the .env file (secret). I will set the real value manually in AWS Management Console.
    - [x] Parameter Store parameter for the URL from which to download the API release .zip (generated by our api.yml GitHub Actions workflow; not secret). I will set the real value manually in AWS Management Console.
    - [x] IAM instance role. AmazonSSMManagedInstanceCore policy to allow Session Manager connection. Custom policy to allow read-only access to the Parameter Store parameters.
    - [x] Security group. expose HTTP and HTTPS ports. Do not expose SSH since we use Session Manager for side channel access to the terminal.
    - [x] Elastic IP address
    - [x] EC2 instance, t4g.micro, Ubuntu Arm64. Tag Name="api.threadloaf.com"
    - [x] Use cloud-init user data to install node.js, download and extract the API release zip, write the .env file, set up a systemd service, and start the service. Our zip contains the node_modules and is ready to run.
- [x] Instead of downloading the release from a URL, let's download it from a private s3 bucket called "threadloaf-files-prod".
    - [x] Create that bucket in the terraform config.
    - [x] In Parameter Store change release_url to release_path, storing the path inside that bucket.
    - [x] Give the instance profile permission to GetObject from that bucket so it can download the file in its cloud init
    - [x] In cloud init, install AWSCLI and use it to download the release zip, then the rest of cloud init is the same as before.
        ```
        curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip  
        sudo ./aws/install
        rm awscliv2.zip
        ```
- [x] Update terraform to add monitoring.
    - [x] In cloud init, install CloudWatch Agent from https://amazoncloudwatch-agent.s3.amazonaws.com/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb (ARM64) and configure it
    - [x] Two metrics: memory used %, disk space used %
    - [x] One dimension: the instance ID. There's only one volume so we don't need a dimension for that.
    - [x] Alarm when either of the two metrics surpasses 90%. Alarm will send an email to `threadloaf@threadloaf.com`. Missing data = breach.
- [x] You are using Ubuntu 22.04, change it to 24.04. Ensure the cloud-init script still works on 24.
- [x] Add an IAM user that I can use for read/write access to threadloaf-terraform-prod and threadloaf-files-prod buckets, for terraform apply and uploading the release zip files.
- [x] Create an EFS filesystem for storing the Let's Encrypt certs dir. The cheapest EFS filesystem possible since it will hold less than 1MB of nearly static data.
    - [x] Give the instance profile permission to access the filesystem, if needed
    - [x] Update the EC2 instance terraform to mount the EFS filesystem
    - [x] Update env.example to include the correct mount path for EFS for LETS_ENCRYPT_CERTS_DIR
- [x] The CloudWatch Agent configuration in user-data.sh is wrong.
    - [x] The mem_used_percent metric is appearing with a host dimension, with a name like "ip-10-0-1-200". We want "instance id" as the sole dimension.
    - [x] The disk_used_percent metric is appearing with device, fstype, host, and path dimensions. We want "instance id" and "path" as the two dimensions.
    - [x] Update the CloudWatch alarms accordingly; they are pointing at nonexistent metrics right now.

# Bugs
- [x] In the extension's user options, set the default "Recent thread replies to show" to 5 (currently 0).
- [x] Testing in Chrome, logged in, recent thread replies set to non-zero, I get this error in the console.
      This all works perfectly in Firefox. There are no known bugs in Firefox, but it's totally broke in Chrome.
      We use a background script to perform HTTP calls and I suspect the background script isn't running; I don't know how to tell.
        ```
        [ThreadListReplyFetcher] Error fetching thread replies: Error: Chrome runtime error: Could not establish connection. Receiving end does not exist.
            at ThreadListReplyFetcher.ts:259:32
        fetchAndDisplayReplies	@	ThreadListReplyFetcher.ts:154
        ```
- [x] We have a single static manifest.json, but we actually need four different configurations, varying by browser and by environment, with two choices each.
  - [x] By browser: Firefox and Chrome seem mutually incompatible. Firefox has this error: "background.service_worker is currently disabled. Add background.scripts." Meanwhile, background.scripts doesn't work in Chrome and we need to use service_worker there. So it seems a single manifest.json won't work in both browsers.
    - [x] Split our single manifest.json into two: one for Chrome and one for Firefox, our two supported browsers. Fix the issue with scripts vs. service_worker.
    - [x] In release.sh, build both versions and zip them separately. Only Firefox needs the source zip.
  - [x] By environment: We have "http://localhost" for development and "https://api.threadloaf.com" for production. Development builds should only have the former and production builds should only have the latter.
  - [x] Find a way to manage this without making four duplicate copies of the whole manifest.json. There are only minor differences between these configurations with most of the content being identical between all four.
- [x] In the thread reply previews, we once already tried to fix the lack of space in between "author:" and their post body. It comes up as "author:text" still. Add padding between the colon and the text.
