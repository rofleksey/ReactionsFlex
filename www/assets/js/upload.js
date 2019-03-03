function uploadFile(reaction, episode, progressHandler, completeHandler, errorHandler, abortHandler) {
    var formdata = new FormData();
    formdata.append("reaction", reaction);
	formdata.append("episode", episode);
    var ajax = new XMLHttpRequest();
    ajax.upload.addEventListener("progress", progressHandler, false);
    ajax.addEventListener("load", completeHandler, false);
    ajax.addEventListener("error", errorHandler, false);
    ajax.addEventListener("abort", abortHandler, false);
    ajax.open("POST", "./upload");
    ajax.send(formdata);
}

var inputs = 0;

function checkValid() {
	var button = $('#uploadButton')
	if($("#episodeInput").val() && $("#reactionInput").val()) {
		if(button.hasClass('disabled')) {
			button.removeClass('disabled');
		}
	} else {
		if(!button.hasClass('disabled')) {
			button.addClass('disabled');
		}
	}
}



$(document).ready(()=>{
	$("#episodeInput").change(function(){
		inputs++
		console.log('episodeInput')
		checkValid()
	});
	$("#reactionInput").change(function(){
		inputs++
		console.log('reactionInput')
		checkValid()
	});
	$('#uploadButton').click(function(){
		var progress = $('#progress')
		uploadFile($("#reactionInput")[0].files[0], $("#episodeInput")[0].files[0], (e)=>{
			if(e.lengthComputable){
				var max = e.total;
				var current = e.loaded;
				var p = (current * 100) / max;
				progress.progress({
					percent: p
				});
				console.log(p);
			}  
		}, ()=>{
			console.log("file upload complete")
			window.location = "/"
		}, ()=>{
			console.log("file upload error")
		}, ()=>{
			console.log("file upload abort")
		})
	})
})