const express = require('express')
const app = express()
const path = require('path')
const fileUpload = require('express-fileupload')
const http = require('http').Server(app)
const url = require("url");
const fs = require('fs')
const wss = require('ws').Server
const uuidv4 = require('uuid/v4');
const mustacheExpress = require('mustache-express');
const { spawn } = require('child_process');
const rimraf = require("rimraf");

const HTTP_PORT = 80

const REACTIONS_ROOT = __dirname + "/www/data/"
const REACTIONS_INFO = REACTIONS_ROOT+"info.json";
var reactions = [];

const ReactionState = Object.freeze({"CREATED":0, "WORKING":1, "DONE":2, "FAILED":3})

class Reaction {
	constructor (name, re, ep, id, state, time, link) {
		this.reactionPath = re
		this.episodePath = ep
		this.name = name
		this.id = id || uuidv4()
		this.state = state || ReactionState.CREATED
		this.time = time || Date.now()
		this.link = link
		
		if(this.state == ReactionState.WORKING) {
			this.state = ReactionState.CREATED
			this.link = null
		}
	}
	
	static load(data) {
		return new Reaction(data.name, data.rpath, data.epath, data.id, data.state, data.time, data.link)
	}
	
    setState(state, link) {
		this.state = state
		this.link = link
		saveReactions()
	}
	
	getJSON() {
		return {
			"name": this.name,
			"state": this.state,
			"time": this.time,
			"id": this.id,
			"link": this.link
		}
	}
	
	save() {
		return {
			"name": this.name,
			"state": this.state,
			"time": this.time,
			"id": this.id,
			"rpath": this.reactionPath,
			"epath": this.episodePath,
			"link": this.link
		}
	}
}

function saveReactions() {
	fs.writeFileSync(REACTIONS_INFO, JSON.stringify(reactions.map(r => r.save())))
}

function loadReactions() {
	if (fs.existsSync(REACTIONS_INFO)) {
		var data = JSON.parse(fs.readFileSync(REACTIONS_INFO, 'utf8'))
		for(var i = 0; i < data.length; i++) {
			reactions.push(Reaction.load(data[i]))
		}
		console.log("Loaded data: ", reactions);
	} else {
		console.log("No saved data found")
	}
}

loadReactions()

var engine = mustacheExpress();

app.engine('html', engine)
app.set('view engine', 'html')
app.set('views', __dirname + '/views')

app.use(express.static(path.join(__dirname, 'www')))
app.use(fileUpload({
    useTempFiles : true,
    tempFileDir : './tmp_upload/'
}))

app.post('/upload', function(req, res) {
	if (Object.keys(req.files).length == 0) {
		return res.status(400).send('No files were uploaded.')
	}
	let reaction = req.files.reaction
	let episode = req.files.episode
	let folderName = path.parse(reaction.name.replace(/[/\\?%*:|"<>]/g, '-')).name
	let dir = REACTIONS_ROOT + folderName+"/"
	if (!fs.existsSync(dir)){
		fs.mkdirSync(dir)
	}
	console.log(reaction.name, episode.name)
	reaction.mv(dir + 'reaction.mp4', (err)=>{
		if (err) {
			return res.status(500).send(err)
		}
		episode.mv(dir + 'episode.mp4', (err)=>{
			if (err) {
				return res.status(500).send(err)
			}
			reactions.push(new Reaction(folderName, '/data/'+folderName+'/reaction.mp4', '/data/' + folderName + '/episode.mp4'));
			saveReactions()
			res.send('File uploaded!')
		})
	})
})

const defMust = {
	greeting: 'ReactionsFlex',
	uploadURL: '/upload',
	prepareURL: '/prepare'
}

app.get('/', function (req, res) {
    res.render('index', defMust);
});
app.get('/upload', function (req, res) {
    res.render('upload', defMust);
});
app.get('/prepare', function (req, res) {
	if(req.query.id && reactions.find(r => r.id == req.query.id)) {
		var r = reactions.find(r => r.id == req.query.id)
		if(r.state != ReactionState.WORKING && r.state != ReactionState.DONE) {
			res.render('prepare', Object.assign(defMust, {
				name: r.name,
				reactionSrc: r.reactionPath
			}));
		} else {
			res.status(404).render('error404')
		}
	} else {
		res.status(404).render('error404')
	}
});
app.get('/watch', function (req, res) {
	if(req.query.id && reactions.find(r => r.id == req.query.id)) {
		var r = reactions.find(r => r.id == req.query.id)
		var t = tasks.find(t => t.react.id == req.query.id)
		if(t) {
			res.render('watch', Object.assign(defMust, {
				streamURL: t.link
			}));
		} else if(r.state == ReactionState.DONE && r.link) {
			res.render('watch', Object.assign(defMust, {
				streamURL: r.link
			}));
		} else {
			res.status(404).render('error404')
		}
	} else {
		res.status(404).render('error404')
	}
});


var filesServer = new wss({noServer: true})
filesServer.on('connection', function(ws) {
	console.log("files::connection")
	var arr = reactions.map(r => r.getJSON());
	ws.send(JSON.stringify(arr));
})

var tasks = [];

class Task {
	constructor (react, rtime, etime, volume, scale, where, isTest) {
		this.rtime = rtime
		this.etime = etime
		this.react = react
		this.volume = volume
		this.scale = scale
		this.where = where
		this.isTest = isTest
	}
	
	getX() {
		return this.where.includes('Left') ? '0' : 'main_w-overlay_w';
	}
	
	getY() {
		return this.where.includes('Top') ? '0' : 'main_h-overlay_h';
	}
	
	remove() {
		var i = tasks.indexOf(this);
		tasks.splice(i, 1);
	}
	
	execute(onMsg, onCommand, onSuccess, onFail) {
		try {
			var x = this.getX(), y = this.getY();
			var streamDir = `${REACTIONS_ROOT}${this.react.name}/stream/`
			if (fs.existsSync(streamDir)){
				rimraf.sync(streamDir);
			}
			fs.mkdirSync(streamDir)
			var array;
			var link;
			if(!this.isTest) {
				array = ['-ss', this.rtime, '-i', `${__dirname}/www/${this.react.reactionPath}`, '-ss', this.etime, '-i', `${__dirname}/www/${this.react.episodePath}`, '-filter_complex',
				`[0:v]setpts=PTS-STARTPTS[reaction];[1:v]setpts=PTS-STARTPTS,scale=iw*${this.scale}:ih*${this.scale}[episode];[reaction][episode]overlay=x=${x}:y=${y}:eof_action=pass;[1]volume=volume=${this.volume}[epsound];[0][epsound]amix[a]`,
				'-map', '[a]', '-acodec', 'aac', '-vcodec', 'libx264', '-f', 'hls', '-hls_time', '4', '-hls_playlist_type', 'event', `${streamDir}stream.m3u8`, '-hide_banner']
				link = `/data/${this.react.name}/stream/stream.m3u8`
				this.react.setState(ReactionState.WORKING, link)
			} else {
				var tempName = "test"+uuidv4()+".mp4"
				array = ['-ss', this.rtime, '-i', `${__dirname}/www/${this.react.reactionPath}`, '-ss', this.etime, '-i', `${__dirname}/www/${this.react.episodePath}`, '-filter_complex',
				`[0:v]setpts=PTS-STARTPTS[reaction];[1:v]setpts=PTS-STARTPTS,scale=iw*${this.scale}:ih*${this.scale}[episode];[reaction][episode]overlay=x=${x}:y=${y}:eof_action=pass;[1]volume=volume=${this.volume}[epsound];[0][epsound]amix[a]`,
				'-map', '[a]', '-f', 'mp4', '-acodec', 'aac', '-vcodec', 'libx264', '-preset', 'ultrafast', '-t', '10', `${streamDir}${tempName}`, '-hide_banner']
				link = `/data/${this.react.name}/stream/${tempName}`
			}
			onCommand(array)
			this.link = link
			console.log(array);
			console.log(link);
			this.child = spawn('ffmpeg', array);
			this.child.stdout.setEncoding('utf8');
			this.child.stdout.on('data', (chunk) => {
				onMsg('info', chunk)
			});

			this.child.stderr.setEncoding('utf8');
			this.child.stderr.on('data', (chunk) => {
				onMsg('error', chunk)
			});

			this.child.on('close', (code) => {
				if(code != 0) {
					if(!this.isTest) {
						this.react.setState(ReactionState.FAILED, null)
					}
					onFail('FFMPEG fail')
				} else {
					if(!this.isTest) {
						this.react.setState(ReactionState.DONE, link)
					}
					onSuccess(link)
				}
				console.log(`FFMPEG process exited with code ${code}`);
			});
		} catch(e) {
			onFail(e)
		}
	}
	
	stop() {
		if(this.child) {
			this.child.stdin.pause();
			this.child.kill();
		}
	}
}

var testServer = new wss({noServer: true})
testServer.on('connection', function(ws) {
	console.log("test::connection")
	ws.on('message', function(msg){
		var data = JSON.parse(msg)
		console.log('test::message', data)
		var id = data.id;
		if(id && reactions.find(r => r.id == id)) {
			var r = reactions.find(r => r.id == id)
			ws.task = new Task(r, data.rtime, data.etime, data.volume, data.scale, data.where, true)
			ws.task.execute((level, text)=>{
				try {
					ws.send(JSON.stringify({
						'type': 'msg',
						'level': level,
						'text': text
					}))
				} catch(e) {}
				console.log(level+">>", text)
			}, (command)=>{
				try {
					ws.send(JSON.stringify({
						'type': 'command',
						'command': command
					}))
				} catch(e){}
			}, (link)=>{
				try {
					ws.send(JSON.stringify({
						'type': 'success',
						'link': link
					}))
					ws.close()
				} catch(e){}
				console.log("FFMPEG success()")
			}, (cause)=>{
				try {
					ws.send(JSON.stringify({
						'type': 'fail',
						'cause': cause.toString()
					}))
					ws.close()
				} catch(e){}
				console.log("FFMPEG fail()")
			})
		} else {
			try {
				ws.send(JSON.stringify({
					'type': 'fail',
					'info': 'Reaction not found'
				}))
				ws.close()
			} catch(e){}
			console.log("Reaction not found")
		}
	})
	ws.on('close', function(msg) {
		if(ws.task) {
			ws.task.stop();
		}
	})
})

var processServer = new wss({noServer: true})
processServer.on('connection', function(ws) {
	console.log("test::connection")
	ws.on('message', function(msg){
		var data = JSON.parse(msg)
		console.log('test::message', data)
		var id = data.id;
		if(id && reactions.find(r => r.id == id)) {
			var r = reactions.find(r => r.id == id)
			var oldtask = tasks.find(t => t.react == r);
			if(!oldtask) {
				var task = new Task(r, data.rtime, data.etime, data.volume, data.scale, data.where, false)
				tasks.push(task)
				task.execute((level, text)=>{
					if(text.includes("stream.m3u8.tmp")) {
						try {
							ws.send(JSON.stringify({
								'type': 'success'
							}))
						} catch(e) {
							
						}
					}
					console.log(level, text)
				}, (command)=>{
					try {
						ws.send(JSON.stringify({
							'type': 'command',
							'command': command
						}))
					} catch(e){}
				},(link)=>{
					task.remove()
					console.log("FFMPEG success()")
				}, (cause)=>{
					try {
						ws.send(JSON.stringify({
							'type': 'fail',
							'cause': cause.toString()
						}))
						ws.close()
					} catch(e){}
					task.remove()
					console.log("FFMPEG fail()")
				})
			} else {
				try {
					ws.send(JSON.stringify({
						'type': 'fail',
						'cause': "Already processing"
					}))
					ws.close()
				} catch(e){}
			}
		} else {
			try {
				ws.send(JSON.stringify({
					'type': 'fail',
					'info': 'Reaction not found'
				}))
				ws.close()
			} catch(e){}
			console.log("Reaction not found")
		}
	})
})

http.listen(HTTP_PORT, function(){
	console.log('listening on *:'+HTTP_PORT)
})

http.on('upgrade', function upgrade(request, socket, head) {
    const pathname = url.parse(request.url).pathname;
	console.log(pathname)
    if (pathname === '/test') {
        testServer.handleUpgrade(request, socket, head, function done(ws) {
            testServer.emit('connection', ws, request);
        });
    } else if (pathname === '/process') {
        processServer.handleUpgrade(request, socket, head, function done(ws) {
            processServer.emit('connection', ws, request);
        });
    } else if (pathname === '/files') {
        filesServer.handleUpgrade(request, socket, head, function done(ws) {
            filesServer.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});