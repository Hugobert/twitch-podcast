// ===== DEPENDENCIES ===== //

const Podcast = require('./node_modules/podcast/dist/index.js');
const fs = require('fs');
const https = require('https');
const request = require('sync-request');
const { spawn, spawnSync } = require('child_process');
const { strict } = require('assert');
const os = require('os');
const moveFile = require('move-file');
const config = require('./config.json');

var tmpDir = os.tmpdir()+"/";
var pageCursor = "";


// ===== FUNCTIONS ===== //

function durationParse(hms) {
	// turns the duration string delivered by Twitch into seconds
	let h = 0;
	let m = 0;
	if (hms.includes("h")){
		h = parseInt(hms.match(/\d*(?=h)/)[0]);
	}
	if (hms.includes("m")){
		m = parseInt(hms.match(/\d*(?=m)/)[0]);
	}
	let s = parseInt(hms.match(/\d*(?=s)/)[0]);
	let final = (h*60*60)+(m*60)+s;
	//console.log(h,m,s,hms,final);
	return final;
}


function addToFeed(vod){
	// this is done for each episode. Directly takes a vod object as it is delivered by Twitch.
	if(vod.description==""){
		vod.description = vod.title;
	}

	feed.addItem({
		title:  vod.title,
		description: vod.description+" - - - <a href='"+vod.url+"' target='_blank'>Watch on Twitch</a>",
		url: vod.url, // link to the item
		categories: config.podcast.categories, // optional - array of item categories
		date: vod.published_at, // any format that js Date can parse.
		itunesDuration: durationParse(vod.duration),
		enclosure : {url:config.episodesUrl+vod.id+'.mp3'}, // optional enclosure
		customElements: [{itemid:vod.id}], // this is an optional element, but is super useful if you want to interconnect your podcast with services like zapier.
	});
	console.log(vod.id+" added to feed");
}


function saveXml(){
	// exports the feed as a file
	const xml = feed.buildXml();
	console.log("Saving xml");
	fs.writeFileSync(config.rssLocation,xml);
}


// ===== FEED CREATION ===== //

const feed = new Podcast({
	title: config.podcast.title,
	description: config.podcast.description,
	feed_url: config.podcast.feedUrl,
	site_url: config.podcast.siteUrl,
	image_url: config.podcast.imageUrl,
	language: config.podcast.language,
	author: config.podcast.author,
	itunesAuthor: config.podcast.author,
	categories: config.podcast.categories,
	pubDate: Date.UTC()
});


// ===== PROGRAM START ===== //

console.log("Getting VODs...");
var endOfList = false;
var vods = [];
var vodsReq = request('GET', 'https://api.twitch.tv/helix/videos?user_id='+config.channel+'&type=highlight&first=100', {
	headers: {
		'Accept': 'application/vnd.twitchtv.v5+json',
		'Client-ID': config.twitch.clientID,
		'Authorization': 'Bearer '+config.twitch.token
	},
});
vods = JSON.parse(vodsReq.getBody('utf8')).data;
pageCursor = JSON.parse(vodsReq.getBody('utf8')).pagination.cursor;
console.log("Pagination Cursor: "+pageCursor);

var newest = vods[0];
console.log("Latest VOD is: "+newest.title);

do {
	var moreVodsReq = request('GET', 'https://api.twitch.tv/helix/videos?user_id='+config.channel+'&type=highlight&first=100&after='+pageCursor, {
		headers: {
			'Accept': 'application/vnd.twitchtv.v5+json',
			'Client-ID': config.twitch.clientID,
			'Authorization': 'Bearer '+config.twitch.token
		},
	});
	var moreVods = JSON.parse(moreVodsReq.getBody('utf8')).data;
	vods = vods.concat(moreVods);
	console.log("Amount of VODs: "+vods.length);
	pageCursor = JSON.parse(moreVodsReq.getBody('utf8')).pagination.cursor;
	if(moreVods.length<100){
		endOfList = true;
	}
} while (!endOfList);


// loop over data
var i=0;
addItem(i);
function addItem(i){
	if(i<vods.length){
		console.log("Progress: "+i+"/"+vods.length);
		let vod = vods[i];
		// check if file already exists
		if(!fs.existsSync(config.episodesFolder+vod.id+".mp3")){
			console.log("Downloading "+vod.id+" - "+vod.title);
			var download = spawn('youtube-dl', ["https://www.twitch.tv/videos/"+vod.id, "--format", "Audio_Only", "-o", tmpDir+vod.id+"_orig.mp3"]);

			download.stdout.on('data', function (data) {
				console.log('ytdl: ' + data);
			});
			download.stderr.on('data', function (data) {
				console.log('YTDL ERROR: ' + data);
			});
			download.on('close', function (code) {
				console.log('ytdl finished. Code: '+code);

				var merge = spawn('ffmpeg', ['-i', tmpDir+vod.id+'_orig.mp3', '-i', 'jingle.mp3', '-qscale:a', '8', '-filter_complex', '[0]loudnorm=I=-16:LRA=11:TP=-1.5[a0];[a0]adelay=2s|2s[b0];[b0][1]amix=inputs=2:duration=longest', tmpDir+vod.id+'.mp3']);
				merge.stdout.on('data', function (data) {
					console.log('merge: ' + data);
				});
				merge.stderr.on('data', function (data) {
					//ffmpeg seems to do this by default for regular debug output for some reason lol
					console.log('MERGE ERROR: ' + data);
				});
				merge.on('close', function(code){
					console.log('merge finished. Code: '+code);
					fs.unlinkSync(tmpDir+vod.id+"_orig.mp3");
					moveFile.sync(tmpDir+vod.id+".mp3",config.episodesFolder+vod.id+".mp3");
					console.log(vod.id+" moved to output folder");
					
					addToFeed(vod);

					// You can add a saveXml() here to generate the feed every time a new episode has been added, regardless if the program is not done yet.
					// This is especially useful while building the initial episodes collection where it might still have to download and process thousands of vods.
					// If you leave it off, the feed will only be generated once all VODs have been processed.

					//saveXml();
					
					if(i<vods.length){
						i=i+1;
						addItem(i);
					}
				})
			})
		} else {
			console.log(vod.id+" exists, skipping download...");
			addToFeed(vod);
			if(i<vods.length){
				i=i+1;
				addItem(i);
			} else {
				console.log("All items done.");
				saveXml();
			}
		}
	} else {
		console.log("All items done.");
		saveXml();
	}
}