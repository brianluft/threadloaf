import { deepEqual, Test, IGNORE } from "./test_utils";
import { MessageParser } from "./MessageParser";

export class MessageParserTest {
    private parser: MessageParser;

    constructor() {
        this.parser = new MessageParser();
    }

    private async loadTestFile(filePath: string): Promise<HTMLElement> {
        const extensionUrl = chrome.runtime.getURL(`test-data/${filePath}`);
        const response = await fetch(extensionUrl);
        const html = await response.text();
        const container = document.createElement("div");
        container.innerHTML = html;
        return container.firstChild as HTMLElement;
    }

    async getTests(): Promise<Test[]> {
        return [
            {
                name: "parse cozy-non-reply.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-non-reply.html")), [
                        {
                            id: "1323564429408997426",
                            author: "electroly",
                            timestamp: 1735632750609,
                            content: "asdf",
                            htmlContent:
                                '<div id="message-content-1323564429408997426" class="markup_f8f345 messageContent_f9f2ca"><span>asdf</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
            {
                name: "parse compact-non-reply.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-non-reply.html")), [
                        {
                            id: "1323564429408997426",
                            author: "electroly",
                            timestamp: 1735632750609,
                            content: "asdf",
                            htmlContent:
                                '<div id="message-content-1323564429408997426" class="markup_f8f345 messageContent_f9f2ca"><span>asdf</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
            {
                name: "parse cozy-reactions.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-reactions.html")), [
                        {
                            id: "1323564429408997426",
                            author: "electroly",
                            timestamp: 1735632750609,
                            content: "asdf",
                            htmlContent:
                                '<div id="message-content-1323564429408997426" class="markup_f8f345 messageContent_f9f2ca"><span>asdf</span></div><div class="reactions_ec6b19 largeReactions_ec6b19" role="group" id="message-reactions-1323564429408997426"><div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="sparkling heart, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="💖" src="https://discord.com/assets/257ec62e14d4c1c89808.svg" alt="💖" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="point up 2, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="👆" src="https://discord.com/assets/db1a06e4b01639c96019.svg" alt="👆" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="saluting face, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="🫡" src="https://discord.com/assets/6aae4f996e21c1d6fd73.svg" alt="🫡" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div aria-label="Add Reaction"></div></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                            reactionsHtml:
                                '<div class="reactions_ec6b19 largeReactions_ec6b19" role="group" id="message-reactions-1323564429408997426"><div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="sparkling heart, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="💖" src="/assets/257ec62e14d4c1c89808.svg" alt="💖" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="point up 2, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="👆" src="/assets/db1a06e4b01639c96019.svg" alt="👆" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="saluting face, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="🫡" src="/assets/6aae4f996e21c1d6fd73.svg" alt="🫡" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div aria-label="Add Reaction"></div></div>',
                        },
                    ]);
                },
            },
            {
                name: "parse compact-reactions.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-reactions.html")), [
                        {
                            id: "1323564429408997426",
                            author: "electroly",
                            timestamp: 1735632750609,
                            content: "asdf",
                            htmlContent:
                                '<div id="message-content-1323564429408997426" class="markup_f8f345 messageContent_f9f2ca"><span>asdf</span></div><div class="reactions_ec6b19 largeReactions_ec6b19" role="group" id="message-reactions-1323564429408997426"><div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="sparkling heart, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="💖" src="https://discord.com/assets/257ec62e14d4c1c89808.svg" alt="💖" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="point up 2, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="👆" src="https://discord.com/assets/db1a06e4b01639c96019.svg" alt="👆" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="saluting face, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="🫡" src="https://discord.com/assets/6aae4f996e21c1d6fd73.svg" alt="🫡" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div aria-label="Add Reaction"></div></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                            reactionsHtml:
                                '<div class="reactions_ec6b19 largeReactions_ec6b19" role="group" id="message-reactions-1323564429408997426"><div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="sparkling heart, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="💖" src="/assets/257ec62e14d4c1c89808.svg" alt="💖" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="point up 2, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="👆" src="/assets/db1a06e4b01639c96019.svg" alt="👆" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div><div class="reaction_ec6b19 reactionMe_ec6b19" style="opacity: 1;"><div class="reactionInner_ec6b19" aria-expanded="false" aria-disabled="false" aria-label="saluting face, 1 reaction, press to remove your reaction" aria-pressed="true" role="button" tabindex="0"><div class=""></div><div><img class="emoji reactionLarge" data-type="emoji" data-name="🫡" src="/assets/6aae4f996e21c1d6fd73.svg" alt="🫡" draggable="false"></div><div class="reactionCount_ec6b19" style="min-width: 9px;">1</div></div></div></div><div aria-label="Add Reaction"></div></div>',
                        },
                    ]);
                },
            },
            {
                name: "parse cozy-parent-and-child.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-parent-and-child.html")), [
                        {
                            id: "1323564429408997426",
                            author: "electroly",
                            timestamp: 1735632750609,
                            content: "asdf",
                            htmlContent:
                                '<div id="message-content-1323564429408997426" class="markup_f8f345 messageContent_f9f2ca"><span>asdf</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                        {
                            id: "1323577271814197381",
                            author: "electroly",
                            timestamp: 1735635812477,
                            content: "foobar",
                            htmlContent:
                                '<div id="message-content-1323577271814197381" class="markup_f8f345 messageContent_f9f2ca"><span>foobar</span></div>',
                            parentId: "1323564429408997426",
                            parentPreview: {
                                author: "electroly",
                                content: "<span>asdf</span>",
                            },
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
            {
                name: "parse compact-parent-and-child.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-parent-and-child.html")), [
                        {
                            id: "1323564429408997426",
                            author: "electroly",
                            timestamp: 1735632750609,
                            content: "asdf",
                            htmlContent:
                                '<div id="message-content-1323564429408997426" class="markup_f8f345 messageContent_f9f2ca"><span>asdf</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                        {
                            id: "1323577271814197381",
                            author: "electroly",
                            timestamp: 1735635812477,
                            content: "foobar",
                            htmlContent:
                                '<div id="message-content-1323577271814197381" class="markup_f8f345 messageContent_f9f2ca"><span>foobar</span></div>',
                            parentId: "1323564429408997426",
                            parentPreview: {
                                author: "electroly",
                                content: "<span>asdf</span>",
                            },
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
            {
                name: "parse cozy-op.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-op.html")), [
                        {
                            id: "1323584268588285952",
                            author: "electroly",
                            timestamp: 1735637480638,
                            content: "test message",
                            htmlContent:
                                '<div id="message-content-1323584268588285952" class="markup_f8f345 messageContent_f9f2ca"><span>test message</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
            {
                name: "parse compact-op.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-op.html")), [
                        {
                            id: "1323584268588285952",
                            author: "electroly",
                            timestamp: 1735637480638,
                            content: "test message",
                            htmlContent:
                                '<div id="message-content-1323584268588285952" class="markup_f8f345 messageContent_f9f2ca"><span>test message</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
            {
                name: "parse cozy-change-post-title.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-change-post-title.html")), [
                        {
                            id: "1323585208091676832",
                            author: "System",
                            timestamp: 1735637704633,
                            content: "electroly changed the post title: test thread! — Today at 9:35 AM",
                            htmlContent:
                                '<div class="channelNameChange_ce613b container_d76df7 cozy_d76df7"><div class="iconContainer_d76df7"><div data-accessibility="desaturate" class="icon_d76df7 iconSize_d76df7" style="background-image: url(&quot;/assets/6a41d3db4f37899d1306.svg&quot;);"><span> </span></div><span> </span></div><div class="content_d76df7"><a class="anchor_af404b anchorUnderlineOnHover_af404b" aria-expanded="false" role="button" tabindex="0" style="color: rgb(233, 30, 99);"><span class="username_de3235 desaturateUserColors_c7819f" style="color: rgb(233, 30, 99);">electroly</span></a> changed the post title: <strong>test thread!</strong><span class="timestamp_f9f2ca timestampInline_f9f2ca"><time aria-label="Today at 9:35 AM" datetime="2024-12-31T09:35:04.633Z"><i class="separator_f9f2ca" aria-hidden="true"> — </i>Today at 9:35 AM</time></span><span> </span></div></div>',
                            children: [],
                            originalElement: IGNORE,
                        },
                    ]);
                },
            },
            {
                name: "parse compact-change-post-title.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-change-post-title.html")), [
                        {
                            id: "1323585208091676832",
                            author: "System",
                            timestamp: 1735637704633,
                            content: "electroly changed the post title: test thread! — Today at 9:35 AM",
                            htmlContent:
                                '<div class="channelNameChange_ce613b container_d76df7 compact_d76df7"><div class="iconContainer_d76df7"><div data-accessibility="desaturate" class="icon_d76df7 iconSize_d76df7" style="background-image: url(&quot;/assets/6a41d3db4f37899d1306.svg&quot;);"><span> </span></div><span> </span></div><div class="content_d76df7"><a class="anchor_af404b anchorUnderlineOnHover_af404b" aria-expanded="false" role="button" tabindex="0" style="color: rgb(233, 30, 99);"><span class="username_de3235 desaturateUserColors_c7819f" style="color: rgb(233, 30, 99);">electroly</span></a> changed the post title: <strong>test thread!</strong><span class="timestamp_f9f2ca timestampInline_f9f2ca"><time aria-label="Today at 9:35 AM" datetime="2024-12-31T09:35:04.633Z"><i class="separator_f9f2ca" aria-hidden="true"> — </i>Today at 9:35 AM</time></span><span> </span></div></div>',
                            children: [],
                            originalElement: IGNORE,
                        },
                    ]);
                },
            },
            {
                name: "parse cozy-server-boost.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-server-boost.html")), [
                        {
                            id: "1323590100294303754",
                            author: "System",
                            timestamp: 1735638871025,
                            content:
                                "electroly just boosted the server! Cool Server has achieved Level 3!  — Today at 9:54 AM",
                            htmlContent:
                                '<div class="container_d76df7 cozy_d76df7"><div class="iconContainer_d76df7"><div class="iconWrapper_f1b373" role="button" tabindex="0"><svg class="icon_f1b373" aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 8 12"><path d="M4 0L0 4V8L4 12L8 8V4L4 0ZM7 7.59L4 10.59L1 7.59V4.41L4 1.41L7 4.41V7.59Z" fill="currentColor"></path><path d="M2 4.83V7.17L4 9.17L6 7.17V4.83L4 2.83L2 4.83Z" fill="currentColor"></path></svg><span> </span></div><span> </span></div><div class="content_d76df7"><div class="message_f1b373"><a class="anchor_af404b anchorUnderlineOnHover_af404b" aria-expanded="false" role="button" tabindex="0"><span class="username_de3235 desaturateUserColors_c7819f">electroly</span></a> just boosted the server! Cool Server has achieved <strong>Level 3!</strong><span> </span></div><span class="timestamp_f9f2ca timestampInline_f9f2ca"><time aria-label="Today at 9:54 AM" datetime="2024-12-31T09:54:31.025Z"><i class="separator_f9f2ca" aria-hidden="true"> — </i>Today at 9:54 AM</time></span><span> </span></div></div>',
                            children: [],
                            originalElement: IGNORE,
                        },
                    ]);
                },
            },
            {
                name: "parse compact-server-boost.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-server-boost.html")), [
                        {
                            id: "1323590100294303754",
                            author: "System",
                            timestamp: 1735638871025,
                            content:
                                "electroly just boosted the server! Cool Server has achieved Level 3!  — Today at 9:54 AM",
                            htmlContent:
                                '<div class="container_d76df7 compact_d76df7"><div class="iconContainer_d76df7"><div class="iconWrapper_f1b373" role="button" tabindex="0"><svg class="icon_f1b373" aria-hidden="true" role="img" width="24" height="24" viewBox="0 0 8 12"><path d="M4 0L0 4V8L4 12L8 8V4L4 0ZM7 7.59L4 10.59L1 7.59V4.41L4 1.41L7 4.41V7.59Z" fill="currentColor"></path><path d="M2 4.83V7.17L4 9.17L6 7.17V4.83L4 2.83L2 4.83Z" fill="currentColor"></path></svg><span> </span></div><span> </span></div><div class="content_d76df7"><div class="message_f1b373"><a class="anchor_af404b anchorUnderlineOnHover_af404b" aria-expanded="false" role="button" tabindex="0"><span class="username_de3235 desaturateUserColors_c7819f">electroly</span></a> just boosted the server! Cool Server has achieved <strong>Level 3!</strong><span> </span></div><span class="timestamp_f9f2ca timestampInline_f9f2ca"><time aria-label="Today at 9:54 AM" datetime="2024-12-31T09:54:31.025Z"><i class="separator_f9f2ca" aria-hidden="true"> — </i>Today at 9:54 AM</time></span><span> </span></div></div>',
                            children: [],
                            originalElement: IGNORE,
                        },
                    ]);
                },
            },
            {
                name: "parse cozy-automod.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-automod.html")), [
                        {
                            id: "1322967103338447031",
                            author: "System",
                            timestamp: 1735490336976,
                            content:
                                "Activity Alerts Enabled  Enabled by     @boarder2    2 days ago    New and improved Activity Alerts are monitoring your server safety. AutoMod will send a message here if there is any DM or join activity that exceed what is normal for your server.",
                            htmlContent:
                                '<div class="mainContainer_df2817 container_d76df7 cozy_d76df7"><div class="iconContainer_d76df7 iconContainer_df2817"><div class="avatarContainer_bc2461"><div class="wrapper_c51b4e" role="img" aria-label="AutoMod" aria-hidden="false" style="width: 40px; height: 40px;"><svg width="40" height="40" viewBox="0 0 40 40" class="mask_c51b4e svg_c51b4e" aria-hidden="true"><foreignObject x="0" y="0" width="40" height="40" mask="url(#svg-mask-avatar-default)"><div class="avatarStack_c51b4e"><img src="/assets/c11c66353ba9b3973cdd.png" alt=" " class="avatar_c51b4e" aria-hidden="true"><span> </span></div></foreignObject></svg><span> </span></div><span> </span></div><span> </span></div><div class="content_d76df7"><div class="content_df2817"><div class="flexLineBreak_df2817"><span> </span></div><div class="embedCard_df2817"><div class="cardContent_df2817"><div class="cardHeaderContianer_df2817"><div class="cardHeader_df2817"><svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 1.82.08c.38 0 .58-.43.4-.77a6.97 6.97 0 0 1-.35-5.63c.1-.28-.14-.59-.43-.59a4 4 0 1 1 4-4c0 .3.31.53.59.43a6.99 6.99 0 0 1 5.63.35c.34.18.76-.02.77-.4a11.39 11.39 0 0 0-.08-1.82c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0Z" fill="var(--text-positive)" class=""></path><path fill-rule="evenodd" d="M19 24a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm1-4a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Zm0-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clip-rule="evenodd" fill="var(--text-positive)" class=""></path></svg><div class="text-md/semibold_dc00ef" data-text-variant="text-md/semibold" style="color: var(--text-positive);">Activity Alerts Enabled<span> </span></div><span> </span></div><div class="subheader_df2817"><div class="dotSeparatedRow_df2817"><div class="alertsEnabledSubHeader_df2817"><div class="text-xs/medium_dc00ef" data-text-variant="text-xs/medium" style="color: var(--text-normal);">Enabled by<span> </span></div><div class="alertsEnabledSubHeaderAvatarUsername_df2817" aria-expanded="false" role="button" tabindex="0"><div><div class="wrapper_c51b4e" role="img" aria-label="TODO" aria-hidden="false" style="width: 16px; height: 16px;"><svg width="16" height="16" viewBox="0 0 16 16" class="mask_c51b4e svg_c51b4e" aria-hidden="true"><foreignObject x="0" y="0" width="16" height="16" mask="url(#svg-mask-avatar-default)"><div class="avatarStack_c51b4e"><img src="https://cdn.discordapp.com/avatars/289188960096223234/ab92155dfe5bf8c284b6f21848300cc8.webp?size=16" alt=" " class="avatar_c51b4e" aria-hidden="true"><span> </span></div></foreignObject></svg><span> </span></div><span> </span></div><div class="defaultColor_a595eb text-xs/medium_dc00ef" data-text-variant="text-xs/medium" style="color: rgb(233, 30, 99);"> @boarder2<span> </span></div><span> </span></div><span> </span></div><div class="dot_df2817"><span> </span></div><div class="text-xs/medium_dc00ef" data-text-variant="text-xs/medium" style="color: var(--text-normal);">2 days ago<span> </span></div><span> </span></div><span> </span></div><span> </span></div><div class="text-md/normal_dc00ef" data-text-variant="text-md/normal" style="color: var(--text-muted);">New and improved Activity Alerts are monitoring your server safety. AutoMod will send a message here if there is any DM or join activity that exceed what is normal for your server.<span> </span></div><span> </span></div><span> </span></div><span> </span></div><span> </span></div></div>',
                            children: [],
                            originalElement: IGNORE,
                        },
                    ]);
                },
            },
            {
                name: "parse compact-automod.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-automod.html")), [
                        {
                            id: "1322967103338447031",
                            author: "System",
                            timestamp: 1735490336976,
                            content:
                                "Activity Alerts Enabled  Enabled by     @boarder2    2 days ago    New and improved Activity Alerts are monitoring your server safety. AutoMod will send a message here if there is any DM or join activity that exceed what is normal for your server.",
                            htmlContent:
                                '<div class="mainContainer_df2817 compact_df2817 container_d76df7 compact_d76df7"><div class="content_d76df7"><div class="content_df2817 compact_df2817"><div class="flexLineBreak_df2817"><span> </span></div><div class="embedCard_df2817 compact_df2817"><div class="cardContent_df2817"><div class="cardHeaderContianer_df2817"><div class="cardHeader_df2817"><svg aria-hidden="true" role="img" xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24"><path d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 1.82.08c.38 0 .58-.43.4-.77a6.97 6.97 0 0 1-.35-5.63c.1-.28-.14-.59-.43-.59a4 4 0 1 1 4-4c0 .3.31.53.59.43a6.99 6.99 0 0 1 5.63.35c.34.18.76-.02.77-.4a11.39 11.39 0 0 0-.08-1.82c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0Z" fill="var(--text-positive)" class=""></path><path fill-rule="evenodd" d="M19 24a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm1-4a1 1 0 1 0-2 0v1a1 1 0 1 0 2 0v-1Zm0-3a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clip-rule="evenodd" fill="var(--text-positive)" class=""></path></svg><div class="text-md/semibold_dc00ef" data-text-variant="text-md/semibold" style="color: var(--text-positive);">Activity Alerts Enabled<span> </span></div><span> </span></div><div class="subheader_df2817"><div class="dotSeparatedRow_df2817"><div class="alertsEnabledSubHeader_df2817"><div class="text-xs/medium_dc00ef" data-text-variant="text-xs/medium" style="color: var(--text-normal);">Enabled by<span> </span></div><div class="alertsEnabledSubHeaderAvatarUsername_df2817" aria-expanded="false" role="button" tabindex="0"><div><div class="wrapper_c51b4e" role="img" aria-label="TODO" aria-hidden="false" style="width: 16px; height: 16px;"><svg width="16" height="16" viewBox="0 0 16 16" class="mask_c51b4e svg_c51b4e" aria-hidden="true"><foreignObject x="0" y="0" width="16" height="16" mask="url(#svg-mask-avatar-default)"><div class="avatarStack_c51b4e"><img src="https://cdn.discordapp.com/avatars/289188960096223234/ab92155dfe5bf8c284b6f21848300cc8.webp?size=16" alt=" " class="avatar_c51b4e" aria-hidden="true"><span> </span></div></foreignObject></svg><span> </span></div><span> </span></div><div class="defaultColor_a595eb text-xs/medium_dc00ef" data-text-variant="text-xs/medium" style="color: rgb(233, 30, 99);"> @boarder2<span> </span></div><span> </span></div><span> </span></div><div class="dot_df2817"><span> </span></div><div class="text-xs/medium_dc00ef" data-text-variant="text-xs/medium" style="color: var(--text-normal);">2 days ago<span> </span></div><span> </span></div><span> </span></div><span> </span></div><div class="text-md/normal_dc00ef" data-text-variant="text-md/normal" style="color: var(--text-muted);">New and improved Activity Alerts are monitoring your server safety. AutoMod will send a message here if there is any DM or join activity that exceed what is normal for your server.<span> </span></div><span> </span></div><span> </span></div><span> </span></div><span> </span></div></div>',
                            children: [],
                            originalElement: IGNORE,
                        },
                    ]);
                },
            },
            {
                name: "parse cozy-double-post.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("cozy-double-post.html")), [
                        {
                            id: "1323826029218762773",
                            author: "electroly",
                            timestamp: 1735695120864,
                            content: "test 1",
                            htmlContent:
                                '<div id="message-content-1323826029218762773" class="markup_f8f345 messageContent_f9f2ca"><span>test 1</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                        {
                            id: "1323826033287233627",
                            author: "electroly",
                            timestamp: 1735695121834,
                            content: "test 2",
                            htmlContent:
                                '<div id="message-content-1323826033287233627" class="markup_f8f345 messageContent_f9f2ca"><span>test 2</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
            {
                name: "parse compact-double-post.html",
                fn: async () => {
                    deepEqual(this.parser.parseMessages(await this.loadTestFile("compact-double-post.html")), [
                        {
                            id: "1323826029218762773",
                            author: "electroly",
                            timestamp: 1735695120864,
                            content: "test 1",
                            htmlContent:
                                '<div id="message-content-1323826029218762773" class="markup_f8f345 messageContent_f9f2ca"><span>test 1</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                        {
                            id: "1323826033287233627",
                            author: "electroly",
                            timestamp: 1735695121834,
                            content: "test 2",
                            htmlContent:
                                '<div id="message-content-1323826033287233627" class="markup_f8f345 messageContent_f9f2ca"><span>test 2</span></div>',
                            children: [],
                            originalElement: IGNORE,
                            authorColor: "rgb(233, 30, 99)",
                        },
                    ]);
                },
            },
        ];
    }
}
