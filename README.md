# Matrix Google Voice Bridge Bot

Since Google Voice has no API, and probably never will, this is a method for "pseudo-bridging" your Matrix server with Google Voice.

_**PLEASE NOTE** this is a draft adapted from my own use, so I may have left out something I did_ [_all along the way_](https://www.youtube.com/watch?v=IkA9b5UWr9g)_. Please ping me with an issue if I missed anything._

### How it works

- Use Google Voice’s **Forward messages to email** option and watch inbox for new messages, then create new rooms for each sender
- Watch room for replies and route back through Gmail to Google Voice.

### Supported:

- Text messages, incoming & outgoing (replies)
- Incoming media (images, etc.)

### Not supported:

- Group chats (probably never, because Google)
- Outgoing media (apparently impossible via Gmail → Google Voice, because Google)
- Backfilling history

### Coming soon:

- Automatically grab avatars for contacts from your Gmail Contacts.

## Setup

1.  In **Google Voice > Settings > Messages,** make sure **Forward messages to email** is ON.
2.  Create a new account for your bot on your homeserver, then get the `access_token`. (The simplest way to do this is using [Element](https://element.io/).  Instructions [here](https://t2bot.io/docs/access_tokens/).)
3.  You must send the replies _from your own Gmail account_, so this requires authenticating your Gmail. Grab an **App Password** for Gmail. (Instructions [here](https://support.google.com/accounts/answer/185833).)
4.  (Optional) **roomAvatarURL** You can set an avatar for all new rooms created by the bot, e.g., a Google Voice icon, or a cute robot. Must be in the form of an MXC path, i.e., `mxc://myserver.com/BaaWqWAJoXVvcqNbwjJLiwEI.` The easiest way to do this is to send an image in any room, then right click the image message and "View source".
5.  Edit `config.js` with all your parameters.
6.  Run `matrix-googlevoice-bot.js` on any machine with Internet and `node` – your homeserver, laptop, Pi, whatever. Set it up to always run using your preferred method.

#### Notes

- If you "leave" the room created by the bot, you might not be able to rejoin, and later you will not be able to receive messages from the same sender, because the room alias will still be reserved, which would require manually deleting the old alias.
- Feel free to change the Room Topic, Name, or Avatar – but do _not_ delete the Alias.

## Extras
Some other things the bot can do:
- `!avatar <URL>` – Set room avatar to linked image, e.g., `!avatar https://file-examples-com.github.io/uploads/2017/10/file_example_PNG_500kB.png`
- `!show <MXC URL>` — Display a given MXC URL 
- `!echo <text>` — Check if alive

## To do

- Automatically search Google Contacts API for avatars
- Add option to search back in time x days for backfilling from Gmail
- Add options for logging
- Figure out sending media capability ... anyone know how? No method I've tried allows replying with image from Gmail.
