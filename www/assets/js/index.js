const ReactionState = Object.freeze({"CREATED":0, "WORKING":1, "DONE":2, "FAILED":3})

$(window).on('load',function(){
	/*$('#loadingModal').modal({
		keyboardShortcuts: false,
		closable: false
	}).modal('show')*/
	var ws = new WebSocket("ws://"+window.location.hostname+"/files");
	ws.onmessage = function (event) {
		var data = JSON.parse(event.data)
		var list = $('<div class="ui relaxed divided list">')
		for(var i = 0; i < data.length; i++) {
			var cur = data[i];
			
			var item = $('<div class="item">')
			var icon = $('<i class="large play circle middle aligned icon">')
			var content = $('<div class="content">')
			var a = $('<a class="header">')
			var descr = $('<div class="description">')
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
			item.append(icon, content)
			list.append(item)
		}
		$('#loaderData').append(list)
		$('#loaderDimmer').removeClass('active')
	}
	console.log('index.js')
})