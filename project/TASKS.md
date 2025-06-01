- [x] After clicking "Log in" in the extension's user options popup and then completing Discord's OAuth2 login flow, we redirect to http://localhost:3000/auth/callback. This is just a blank page and logs the following to the console. The user options don't get updated to show that we are logged in.
    Uncaught TypeError: window.opener is null
        <anonymous> http://localhost:3000/auth/callback?code=pfkQfc2ozQJinIXEAifakIJEf3lPk8&state=bb4841d0-dbe9-4f23-85fa-f7ed1c987885:3
    callback:3:25
