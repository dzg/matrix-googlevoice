const [Black, Red, Green, Yellow, Blue, Magenta, Cyan, White] = ["\x1b[30m", "\x1b[31m", "\x1b[32m", "\x1b[33m", "\x1b[34m", "\x1b[35m", "\x1b[36m", "\x1b[37m"]
const config = require('./config.js')
const Jp = (text) => JSON.stringify(text, null, 2) // JSON prettify
const Log = (text, color = White) => {
   let timestamp = new Date((datetime = new Date()).getTime() - datetime.getTimezoneOffset() * 60000).toISOString()
      .replace("T", " ").split('.')[0]
   console.log(`${timestamp} ${color}${text}\n${White}`);
}
const botNotifyRoom = `${config.matrixBotId.split(':')[0]}-Notify`

//! OUTGOING via Bot SDK
const { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } = require("matrix-bot-sdk")
const storage = new SimpleFsStorageProvider("bot.json")
const client = new MatrixClient(config.matrixServerUrl, config.matrixBotAccessToken, storage);

AutojoinRoomsMixin.setupOnClient(client);

client.start().then(() => {
   Log(notice = "MATRIX: Client started.", Green);
   matrixNotify(notice)
}
);

getAvatarUrl = async (url) => {
   let mxcURL = '';
   if (url.startsWith('mxc://')) { mxcURL = url }
   else if (url.startsWith('http')) {
      mxcURL = await client.uploadContentFromUrl(url)
   }
   return mxcURL
}

setRoomAvatar = async (roomId, url) => {
   let mxcURL = await getAvatarUrl(url);
   if (mxcURL) {
      await client.sendStateEvent(roomId, 'm.room.avatar', '', { url: mxcURL }); // room avatar
      await client.sendStateEvent(roomId, 'm.room.member', config.matrixBotId, { avatar_url: mxcURL, membership: "join" }); // bot room avatar
   }
}

// setUserRoomAvatar = async (roomId, url) => {
//    let mxcURL = await getAvatarUrl(url);
//    if (mxcURL) { await client.sendStateEvent(roomId, 'm.room.member', config.matrixBotId, { avatar_url: mxcURL, membership: "join" }); }
// }

sendGmail = (recipient, subject, body) => {
   let data = {
      user: config.gmailId, pass: config.gmailPw,
      to: recipient, subject: subject, text: body
   };
   Log(`GMAIL (OUT): ${Jp(data)}`, Red);
   require('gmail-send')(data)(() => { });
}

gVoiceReply = async (room, body) => {
   let alias = await client.getPublishedAlias(room);
   let subject = await client.getRoomStateEvent(room, 'm.room.topic')
   if (typeof alias != 'undefined' && alias.includes('@txt.voice.google.com')) {
      let recipient = alias.split(/[#:]+/)[1];
      sendGmail(recipient, subject.topic, body)
   }
}

client.on("room.message", async (room, event) => {
   if (!event.content) return;
   let sender = event.sender;
   let body = event.content.body;
   if (sender != config.matrixBotId && event.type == 'm.room.message') {
      Log(`MATRIX (IN): ${Jp(event)}`, Blue);
      if (body.startsWith('!')) {
         let [cmd, arg = ''] = body.split(/ (.*)/g)
         if (cmd == '!help') {
            let msg =
               '<code>!name &lt;string&gt;</code> Set room name<br>' +
               '<code>!botname &lt;string&gt;</code> Set bot name (in all rooms)<br>' +
               '<code>!botnick &lt;string&gt;</code> Set bot nickname (in current room)<br>' +
               '<code>!avatar &lt;public URL&gt;</code> Set room & bot room avatar<br>' +
               '<code>!show &lt;MXC URL&gt;</code> Display a given MXC URL<br>' +
               '<code>!echo &lt;text&gt;</code> Check if alive<br>' +
               '<code>!help</code> Show this list<br>';
            await client.sendMessage(room, {
               "msgtype": "m.text",
               "format": "org.matrix.custom.html",
               "formatted_body": msg,
               "body": msg,
            });
         }
         else if (cmd == '!avatar' && arg) {
            setRoomAvatar(room, arg)
         }
         else if (cmd == '!botname' && arg) {
            await client.setDisplayName(arg)
         }
         else if (cmd == '!botnick' && arg) {
            await client.sendStateEvent(room, 'm.room.member', config.matrixBotId, { displayname: arg, membership: 'join' })
         }
         else if (cmd == '!name' && arg) {
            await client.sendStateEvent(room, 'm.room.name', '', { name: arg })
         }
         else if (cmd == '!show' && arg) {
            await client.sendMessage(room, {
               msgtype: "m.image",
               url: `mxc://${config.matrixDomain}/${arg}`,
               body: 'image'
            })
         }
         else if (cmd == "!echo") {
            await client.sendMessage(room, {
               "msgtype": "m.notice",
               "body": arg ? arg : 'Hi!',
            });
         }
      } else if (await client.getPublishedAlias(room) != `#${botNotifyRoom}:${config.matrixDomain}`) {
         gVoiceReply(room, body)
      }
   }

});

//! INCOMING via Gmail IMAP watch from https://github.com/chirag04/mail-listener2/blob/master/index.js
const Imap = require('imap');
const EventEmitter = require('events').EventEmitter;
const simpleParser = require('mailparser').simpleParser;
const async = require('async');
const { auth } = require("googleapis/build/src/apis/abusiveexperiencereport");

class MailListener extends EventEmitter {
   constructor(options) {
      super();
      this.markSeen = !!options.markSeen;
      this.mailbox = options.mailbox || 'INBOX';
      if ('string' === typeof options.searchFilter) { this.searchFilter = [options.searchFilter] }
      else { this.searchFilter = options.searchFilter || ['UNSEEN']; };
      this.fetchUnreadOnStart = !!options.fetchUnreadOnStart;
      this.mailParserOptions = options.mailParserOptions || {};
      if (options.attachments && options.attachmentOptions && options.attachmentOptions.stream) {
         this.mailParserOptions.streamAttachments = true;
      };
      this.attachmentOptions = options.attachmentOptions || {};
      this.attachments = options.attachments || false;
      this.attachmentOptions.directory = (this.attachmentOptions.directory ? this.attachmentOptions.directory : '');
      this.imap = new Imap({
         keepalive: {
            interval: 10000,
            idleInterval: 30000,
            forceNoop: true
         },
         xoauth2: options.xoauth2, user: options.username, password: options.password, host: options.host,
         port: options.port, tls: options.tls, tlsOptions: options.tlsOptions || {},
         connTimeout: options.connTimeout || null, authTimeout: options.authTimeout || null,
         debug: options.debug || null
      });
      this.imap.once('ready', this.imapReady.bind(this));
      this.imap.once('close', this.imapClose.bind(this));
      this.imap.on('error', this.imapError.bind(this));
   }
   start() { this.imap.connect() };
   stop() { this.imap.end() };
   imapReady() {
      this.imap.openBox(this.mailbox, false, (err, mailbox) => {
         if (err) { this.emit('error', err); }
         else {
            this.emit('server', 'connected');
            this.emit('mailbox', mailbox);
            if (this.fetchUnreadOnStart) { this.parseUnread.call(this); }
            let listener = this.imapMail.bind(this);
            this.imap.on('mail', listener);
            this.imap.on('update', listener);
         }
      });
   };
   imapClose() { this.emit('server', 'disconnected'); };
   imapError(err) { this.emit('error', err); };
   imapMail() { this.parseUnread.call(this); };
   parseUnread() {
      let self = this;
      self.imap.search(self.searchFilter, (err, results) => {
         if (err) { self.emit('error', err); }
         else if (results.length > 0) {
            async.each(results, (result, callback) => {
               let f = self.imap.fetch(result, { bodies: '', markSeen: self.markSeen });
               f.on('message', (msg, seqno) => {
                  msg.on('body', async (stream, info) => {
                     let parsed = await simpleParser(stream);
                     // console.log("MAIL:", parsed);
                     let from = parsed.from.value[0];
                     self.emit('mail', from, parsed.text, parsed.subject);
                     if (parsed.attachments.length > 0) {
                        for (let att of parsed.attachments) {
                           if (self.attachments) { self.emit('attachment', from, att); }
                           else { self.emit('attachment', from, null); }
                        }
                     }
                  });
               });
               f.once('error', (err) => { self.emit('error', err); });
            }, (err) => { if (err) { self.emit('error', err); } });
         }
      });
   }
}

var mailListener = new MailListener({
   username: config.gmailId, password: config.gmailPw, host: 'imap.gmail.com',
   port: 993, tls: true, tlsOptions: { servername: 'imap.gmail.com' },
   connTimeout: 10000, authTimeout: 5000,
   mailbox: "INBOX",
   searchFilter: [
      ['UNSEEN'],
      ['or', ['FROM', 'txt.voice.google.com'], ['FROM', 'voice-noreply@google.com']],
      // ['FROM', 'txt.voice.google.com OR voice-noreply@google.com'],
      ["SINCE", new Date().getTime() - 86400000 * config.backDays]
   ],
   // searchFilter: [['FROM', 'txt.voice.google.com'], ["SINCE", new Date().getTime()-24*60*60*1000*10]],  // for testing
   fetchUnreadOnStart: true, markSeen: true,
   attachments: true, attachmentOptions: { directory: "attachments/" },
});
mailListener.start();

const matrixMessage = async (from, data) => {

   const getRoom = (alias) => { return client.resolveRoom(alias).catch((e) => { return e.statusCode }) }

   const createRoom = (name, alias) => {
      return client.createRoom({
         name: name.replace(/$| \(SMS\)/, ' (GV)'),
         invite: config.matrixYourIds,
         is_direct: true,
         room_alias_name: alias,
         topic: `Google Voice bridge with ${name}`,
         preset: "trusted_private_chat"
         //, power_level_content_override: { users_default: 100 }
      }).catch((e) => { return e.statusCode })
   };

   var room = await getRoom(`#${from.address}:${config.matrixDomain}`);
   if (room > 0) { // create room if doesn't already exist (because got status code so room > 0)
      room = await createRoom(from.name, from.address);
      await client.sendStateEvent(room, 'm.room.member', config.matrixBotId, { displayname: from.name, membership: 'join' })
      if (config.roomAvatarURL) {
         await client.sendStateEvent(room, 'm.room.avatar', '', {
            url: config.roomAvatarURL //set room avatar google voice
         });
      }
   }

   Log(`MATRIX (OUT): ${Jp({ room, data })}`, Blue)
   client.sendMessage(room, data);
}

const matrixNotify = (text) => {
   matrixMessage({ address: `${botNotifyRoom}`, name: config.matrixBotName },
      { body: text, msgtype: 'm.text' })
}

mailListener.on("mail", async (from, text, subject) => {
   Log(`GMAIL (in): ${Jp({ text, from, subject })}`, Red);
   let data = { msgtype: 'm.text' }
   let body = text.replace(/.*<https:\/\/voice\.google\.com>/im, '').replace(/(To respond to this text message, reply to this email or visit Google Voice|YOUR ACCOUNT <https:\/\/voice\.google\.com>)(.|\n)*/m, '').replace(/Hello.*\n/, '').trim()
   if (from.address.startsWith('voice-noreply@google.com')) {
      from = {
         address: `${botNotifyRoom}`,
         name: config.matrixBotName
      }
      body = `<h5>${subject}</h5>${body}`
      data.formatted_body = body.replace('\n\n', '<br>').replace(/^(.*)\n<(http.*)>/gm, '<br>🔗 <code><a href="$2">$1</a></code>').trim()
      data.format = "org.matrix.custom.html";
   }
   data.body = body.replace(/([a-z])\n/g, '$1 ')
   // console.log("MSG: ", Magenta, data, White)
   matrixMessage(from, data)
})

mailListener.on("server", async (status) => {
   Log(notice = `GMAIL: Status: ${status}`, Yellow);
   matrixNotify(notice);
   if (status == 'disconnected') {
      Log(notice = 'Gmail Listener disconnected, attempting reconnection.', Yellow);
      matrixNotify(notice);
      mailListener.stop();
      mailListener.start();
   }
});

mailListener.on("error", (err) => { Log('GMAIL Error: ' + err, Yellow); });

mailListener.on("attachment", async (from, att) => {
   Log(`GMAIL (IN) Attachment: ${Jp({ size: att.size, contentType: att.contentType })}`, Red)
   if (att) {
      let name = `attachment.${att.contentType.split('/')[1]}`;
      let url = await client.uploadContent(Buffer.from(att.content, 'base64'), att.contentType, name);
      matrixMessage(from, {
         msgtype: "m.image", url: url, body: name
      });
   }
});
