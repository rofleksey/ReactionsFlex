var epVolume = 0.5, epScale = 0.5;

function toggleButtons(on) {
	if(on){
		$('#buttonTest').removeClass('disabled')
		$('#buttonProcess').removeClass('disabled')
	} else {
		$('#buttonTest').addClass('disabled')
		$('#buttonProcess').addClass('disabled')
	}
}

function remoteConsole(cmd, arg) {
	if(cmd == 'clear') {
		$('#consoleData').empty()
	} else if(cmd == 'title') {
		$('#consoleTitle').text(arg)
	} else {
		var li = $('<li>')
		li.text(arg)
		li.addClass(cmd)
		$('#consoleData').append(li)
		var el = $('#consoleData')[0]
		el.scrollTop = el.scrollHeight;
	}
}

$(window).on('load', ()=>{
	$('#sliderScale').slider({
		min: 30,
		max: 100,
		start: 50,
		step: 5,
		onChange: function(val) {
			epScale = val/100;
		}
	})
	$('#sliderVolume').slider({
		min: 20,
		max: 100,
		start: 50,
		step: 5,
		onChange: function(val) {
			epVolume = val/100;
		}
	})
	$('#dropdownWhere').dropdown({
		onChange: function(value, text, $selectedItem) {
			console.log(value, text, $selectedItem)
		}
	})
	$('#dropdownWhere').dropdown('set selected', 'Left Bottom')
	$('#previewModal').modal({
		onHidden: function() {
			$('#videoPreview')[0].pause();
		}
	});
	$('#buttonTest').click(()=>{
		toggleButtons(false)
		remoteConsole('clear')
		remoteConsole('title', 'Connecting...')
		//$('#videoPreview').attr('src', null)
		var ws =  new WebSocket("ws://"+window.location.hostname+"/test");
		var pos = $('#dropdownWhere').dropdown('get text')
		if(pos == 'Position') {
			pos = 'Left Bottom'
		}
		var url = new URL(window.location);
		var id = url.searchParams.get("id");
		ws.onopen = function() {
			var obj = {
				'volume': epVolume,
				'scale': epScale,
				'etime': $('#etime').val() || "0:00",
				'rtime': $('#rtime').val() || "1:00",
				'where': pos,
				'id': id
			}
			console.log(obj);
			ws.send(JSON.stringify(obj))
			remoteConsole('title', 'Testing...')
		}
		ws.onmessage = function(msg) {
			var data = JSON.parse(msg.data);
			if(data.type == 'success') {
				$('#videoReaction')[0].pause()
				$('#videoPreview')[0].pause()
				$('#videoPreview').attr('src', data.link)
				$('#videoPreview')[0].load()
				$('#previewModal').modal('show')
				toggleButtons(true)
				remoteConsole('success', 'DONE ('+data.link+')')
			} else if(data.type == 'fail') {
				toggleButtons(true)
				remoteConsole('fail', 'FAIL ('+data.cause+')')
			} else if(data.type == 'command') {
				remoteConsole('command', data.command)
			} else if(data.type == 'msg') {
				if(data.level == 'error') {
					remoteConsole('error', data.text)
				} else {
					remoteConsole('info', data.text)
				}
			}
		}
	})
	$('#buttonProcess').click(()=>{
		toggleButtons(false)
		remoteConsole('clear')
		remoteConsole('title', 'Connecting...')
		//$('#videoPreview').attr('src', null)
		var ws =  new WebSocket("ws://"+window.location.hostname+"/process");
		var pos = $('#dropdownWhere').dropdown('get text')
		if(pos == 'Position') {
			pos = 'Left Bottom'
		}
		var url = new URL(window.location);
		var id = url.searchParams.get("id");
		ws.onopen = function() {
			var obj = {
				'volume': epVolume,
				'scale': epScale,
				'etime': $('#etime').val() || "0:00",
				'rtime': $('#rtime').val() || "1:00",
				'where': pos,
				'id': id
			}
			console.log(obj);
			ws.send(JSON.stringify(obj))
			remoteConsole('title', 'Processing...')
		}
		ws.onmessage = function(msg) {
			var data = JSON.parse(msg.data);
			if(data.type == 'success') {
				window.location.replace("/watch?id="+id)
			} else if(data.type == 'command') {
				remoteConsole('command', data.command)
			} else if(data.type == 'fail') {
				toggleButtons(true)
				remoteConsole('fail', 'FAIL ('+data.cause+')')
			} 
		}
	})
	console.log('prepare.js')
})