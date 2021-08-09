# twitch-podcast
A tool that generates an audio podcast from Twitch VODs.
This helps make chat streams accessible to anyone who does not have permanent access to unlimited internet.

## Prerequesites
- [youtube-dl](https://github.com/ytdl-org/youtube-dl)
- [ffmpeg](https://ffmpeg.org/download.html)
- [node.js](https://nodejs.org/)

## Preparation
Open and edit `config.json`. There you need to enter your Twitch API ID and access token as well as all the metadata and locations where the rss feed and the episodes should be stored.

For the channel name, use the normal display name (not the numeric ID) and keep `channelIsNickname: true`. If the channel changes their nickname, you need to change the nickname in the config as well. You can however set `channelIsNickname: false` and use the unique numeric ID for the channel instead (the program will tell you this ID in the very beginning).

If you set `useJingle` to true, the program will use the file specified in `jingleFile` as an intro jingle. `jingleFile` will be ignored if `useJingle` is false. If you choose to use a jingle, for the time being I recommend crafting it manually in a way so the volume ramps down after a few seconds. The delay until when the original audio starts is currently fixed to 2 seconds, though I might add an option to customize this.

Install nodejs module dependencies by running `npm install`.

## Running

To start, simply do `npm start`.

If youtube-dl and ffmpeg are installed correctly and are added to your path it should work on any platform.


## Notes

If a channel has lots of existing VODs, it will go through all of them, but won't generate a feed until it has processed every single VOD which in some cases can take a long time - to generate a feed file everytime a new episode has been processed, change the `generateFeedAfterEachEpisode` in `config.json` to `true`. If this is set to `false` (the default setting), the feed file will only be generated once after all episodes have been processed. Once the initial processing phase is over, you can then just run the program again to update the feed and only download new and missing episodes.

## Contribution
I'm currently not actively using or working on this anymore and have no incentive to do so right now. If you find issues with this or want to add features, feel free to write an issue or send a pull request and I'll take a look at it.
