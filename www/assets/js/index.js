const ReactionState = Object.freeze({"CREATED":0, "WORKING":1, "DONE":2, "FAILED":3})

var toast = function (msg) {
	if(msg.type == 'success' || msg.type == 'error') {
		$('body').toast({
			'class': msg.type,
			'message': msg.msg
		})
	} else {
		$('body').toast({
			'message': msg.msg
		})
	}
}

var sendCommand = function(id, icons, command, onResult) {
	icons.forEach(it => it.addClass('disabled'))
	var ws = new WebSocket("ws://"+window.location.hostname+"/operations");
	var success = false
	ws.onopen = function() {
		var obj = {
			'command': command,
			'id': id
		}
		ws.send(JSON.stringify(obj))
	}
	ws.onmessage = function(event) {
		var data = JSON.parse(event.data)
		success = true
		if(data.type && data.type == 'success' && onResult) {
			onResult(data)
		}
		toast(data)
		icons.forEach(it => it.removeClass('disabled'))
	}
	ws.onerror = ws.onclose = function() {
		if(!success) {
			var obj = {
				'type': 'error',
				'msg': "Server connection failed"
			}
			toast(msg)
			icons.forEach(it => it.removeClass('disabled'))
		}
	}
}

$(window).on('load',function(){
	/*$('#loadingModal').modal({
		keyboardShortcuts: false,
		closable: false
	}).modal('show')*/
	var ws = new WebSocket("ws://"+window.location.hostname+"/files");
	ws.onmessage = function (event) {
		let data = JSON.parse(event.data)
		let list = $('<div class="ui relaxed divided list">')
		for(let i = 0; i < data.length; i++) {
			let cur = data[i];
			
			var item = $('<div class="item">')
			let icons = [];
			let iconUndo = $('<i class="large undo middle aligned icon">')
			let iconDelete = $('<i class="large minus square middle aligned icon">')
			if(cur.state == ReactionState.CREATED) {
				icons = [iconDelete]
			} else if(cur.state == ReactionState.WORKING || cur.state == ReactionState.DONE || cur.state == ReactionState.FAILED) {
				icons = [iconUndo, iconDelete]
			}
			iconUndo.click(()=>{
				sendCommand(cur.id, icons, 'undo', (result)=>{
					location.reload();
				})
			})
			iconDelete.click(()=>{
				sendCommand(cur.id, icons, 'delete', (result)=>{
					location.reload();
				})
			})
			let content = $('<div class="content">')
			let a = $('<a class="header">')
			let descr = $('<div class="description">')
			a.text(cur.name);
			if(cur.state == ReactionState.CREATED) {
				a.attr('href', '/prepare?id='+cur.id);
				descr.text("Uploaded on "+new Date(cur.time).toLocaleString())
			} else if(cur.state == ReactionState.WORKING || cur.state == ReactionState.DONE) {
				a.attr('href', '/watch?id='+cur.id);
			}
			if(cur.state == ReactionState.WORKING) {
				descr.text('Working...')
			} else if(cur.state == ReactionState.DONE) {
				descr.text('Done')
			} else if(cur.state == ReactionState.FAILED) {
				descr.text('Failed')
			}
			content.append(a, descr)
			for(let j = 0; j < icons.length; j++) {
				item.append(icons[j])
			}
			item.append(content)
			list.append(item)
		}
		$('#loaderData').append(list)
		$('#loaderDimmer').removeClass('active')
	}
	console.log('index.js')
})