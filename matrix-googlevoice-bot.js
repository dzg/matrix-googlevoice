const config = require('./config.js')
const Black = "\x1b[30m", Red = "\x1b[31m", Green = "\x1b[32m", Yellow = "\x1b[33m", Blue = "\x1b[34m", Magenta = "\x1b[35m", Cyan = "\x1b[36m", White = "\x1b[37m"
const J = (text) => JSON.stringify(text, null, 2) // JSON prettify
const L = (text, color = White) => { // Logging
   let out = `${new Date((datetime = new Date()).getTime() - datetime.getTimezoneOffset() * 60000).toISOString().replace("T", " ").split('.')[0]} ${text}\n`;
   console.log(color + out + White); // comment this line for no logging to console
   stream.write(out);                // comment this line for no logging to file
}

//! OUTGOING via Bot SDK
const { MatrixClient, SimpleFsStorageProvider, AutojoinRoomsMixin } = require("matrix-bot-sdk")
const storage = new SimpleFsStorageProvider("bot.json")
const client = new MatrixClient(config.matrixServerUrl, config.matrixBotAccessToken, storage);

AutojoinRoomsMixin.setupOnClient(client);

client.start().then(() => L("Client started!", Yellow));

const fs = require('fs');
const path = require('path');
var stream = fs.createWriteStream(path.resolve(__dirname, 'log.txt'), { flags: 'a' });


setRoomAvatar = async (roomId, url) => {
   let mxcURL = await client.uploadContentFromUrl(url);
   await client.sendStateEvent(roomId, 'm.room.avatar', '', { url: mxcURL });
}

sendGmail = (recipient, subject, body) => {
   let data = {
      user: config.gmailId, pass: config.gmailPw,
      to: recipient, subject: subject, text: body
   };
   L(`OUT: ${J(data)}`, Red);
   require('gmail-send')(data)(() => { });
}

gVoiceReply = async (room, body) => {
   let alias = await client.getPublishedAlias(room);
   let subject = await client.getRoomStateEvent(room, 'm.room.topic')
   if (alias.includes('@txt.voice.google.com')) {
      let recipient = alias.split(/[#:]+/)[1];
      sendGmail(recipient, subject.topic, body)
   }
}

client.on("room.message", async (room, event) => {
   L(`Matrix message: ${J(event)}`, Yellow);
   if (!event.content) return;
   const sender = event.sender;
   const body = event.content.body;
   if (sender != config.matrixBotId && event.type == 'm.room.message') {
      if (body.startsWith('!')) {
			let arg = '';
			if (arg = body.replace(/ +/g, ' ').split(' ')[1]) { arg = arg.trim() } else { arg = '' }
         if (body.startsWith('!avatar')) {
            setRoomAvatar(room, arg)
         }
         else if (body.startsWith('!show')) {
            client.sendMessage(room, {
               msgtype: "m.image",
               url: `mxc://${config.matrixDomain}/${arg}`,
               body: 'image'
            })
         }
         else if (body.startsWith("!echo")) {
            client.sendMessage(room, {
               "msgtype": "m.notice",
               "body": arg?arg:'Hi!',
            });
         }
      } else {
         gVoiceReply(room, body)
      }
   }

});

//! INCOMING via Gmail IMAP watch
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
      if ('string' === typeof options.searchFilter) { this.searchFilter = [options.searchFilter]; }
      else { this.searchFilter = options.searchFilter || ['UNSEEN']; }
      this.fetchUnreadOnStart = !!options.fetchUnreadOnStart;
      this.mailParserOptions = options.mailParserOptions || {};
      if (options.attachments && options.attachmentOptions && options.attachmentOptions.stream) {
         this.mailParserOptions.streamAttachments = true;
      }
      this.attachmentOptions = options.attachmentOptions || {};
      this.attachments = options.attachments || false;
      this.attachmentOptions.directory = (this.attachmentOptions.directory ? this.attachmentOptions.directory : '');
      this.imap = new Imap({
         xoauth2: options.xoauth2, user: options.username, password: options.password, host: options.host,
         port: options.port, tls: options.tls, tlsOptions: options.tlsOptions || {},
         connTimeout: options.connTimeout || null, authTimeout: options.authTimeout || null,
         debug: options.debug || null
      });
      this.imap.once('ready', this.imapReady.bind(this));
      this.imap.once('close', this.imapClose.bind(this));
      this.imap.on('error', this.imapError.bind(this));
   }
   start() { this.imap.connect(); }
   stop() { this.imap.end(); }
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
   }
   imapClose() { this.emit('server', 'disconnected'); }
   imapError(err) { this.emit('error', err); }
   imapMail() { this.parseUnread.call(this); }
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
                     let from = parsed.from.value[0];
                     self.emit('mail', from, parsed.text);
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
   searchFilter: [['UNSEEN'], ['FROM', 'txt.voice.google.com'], ["SINCE", new Date().getTime()]], fetchUnreadOnStart: false, 
	// searchFilter: [['FROM', 'txt.voice.google.com'], ["SINCE", new Date().getTime()-24*60*60*1000*10]], fetchUnreadOnStart: true, // for testing
	markSeen: true,
	// attachments: true, attachmentOptions: { directory: "attachments/" },
});
mailListener.start();

const matrixMessage = async (from, data) => {

   const getRoom = (alias) => { return client.resolveRoom(alias).catch((e) => { return e.statusCode }) }

   const createRoom = (name, alias) => {
      return client.createRoom({
         name: name.replace(/$| \(SMS\)/, ' (GV)'),
         invite: [config.matrixYourId],
         is_direct: true,
         room_alias_name: alias,
         topic: `Google Voice bridge with ${name}`,
         power_level_content_override: { users_default: 100 }
      }).catch((e) => { return e.statusCode })
   };

   var room = await getRoom(`#${from.address}:zinclabs.com`);
   if (room > 0) { // create room if doesn't already exist (because got status code so room > 0)
      // room = await createRoom(from.name, from.address);
      room = await createRoom(from.name, from.address);
      if (config.roomAvatarURL) {
         await client.sendStateEvent(room, 'm.room.avatar', '', {
            url: config.roomAvatarURL //set room avatar google voice
         });
      }
   }

	client.sendMessage(room, data);
	client.inviteUser(config.matrixYourId, room);

}

mailListener.on("mail", async (from, text) => {
   L(`Got mail: ${J({ text, from })}`, Yellow)
   const msg = /.*<https:\/\/voice\.google\.com>(.*?)(To respond to this text message, reply to this email or visit Google Voice|YOUR ACCOUNT <https:\/\/voice\.google\.com>).*/gs
      .exec(text)[1].trim();
   matrixMessage(from, {
      msgtype: "m.text", body: msg
   })
})

mailListener.on("server", (status) => { L(`IMAP Server ${status}`, Yellow); });
mailListener.on("error", (err) => { L('ERR: ' + err, Red); });

//! Attachments not working
// mailListener.on("attachment", async (from, att) => {
//    L(`Got attachment: ${JSON.stringify(att.size)}`, Yellow)

//    if (att) {
//       let name = `attachment.${att.contentType.split('/')[1]}`;
//       let url = await client.uploadContent(Buffer.from(att.content, 'base64'), att.contentType, name);
//       L(`Sending attachment:\n${J({ from: from, url: url, name: name })}`, Magenta)
//       matrixMessage(from, {
//          msgtype: "m.image", url: url, body: name
//       });
//    }
// });
