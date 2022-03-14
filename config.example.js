module.exports = {

	// Following MUST be edited:
	matrixBotId: '@yourbot:matrix.org', // The user ID of the account you set up to use as the bot
	matrixBotAccessToken: "syt_abcdefghijklmnopqrsutwxyz123456789", // Instructions at https://t2bot.io/docs/access_tokens/
   gmailId: 'you@gmail.com', // Your Gmail ID
	gmailPw: 'abcdefghijklmnop', // Use an App Password, see https://support.google.com/accounts/answer/185833
	matrixYourIds: ['@you:beeper.com'], // Array of users to invite to new rooms created by the bot. Can be on any server.
	
	// Following are set up for use with a bot account at matrix.org. Edit if using another server.
	matrixServerUrl: `https://matrix-client.matrix.org`,
	matrixDomain: 'matrix.org',
	
	// Following are optional
	matrixBotName: 'Google Voice Bot',
	roomAvatarURL: 'mxc://matrix.org/ShLVOQjbDdUbugMrjhSaBaoB', // Avatar for all new GV bridged rooms
	backDays: 0 // Days back to search for messages in Gmail. Mark messages as Unread if you want the bot to see them.
}
