/*********************************
* Facebook History Collector
* Author: Tonio Loewald
* Copyright: University of Alabama
**********************************/

function GetFBData(){
		if( !document.getElementById('profile_pager') ){
				return;
		}
		
		/***********************
		* configuration options
		***********************/
		// we include the at to avoid matching false positives (organic references to dates in prose)
		var stop_month = prompt('Stop searching past (Month)', 'March');
		// /(April 25 at)|(April 24 at)(March [0-9]+ at)/;
		var date_stop_searching = new RegExp( '(' + stop_month + ' [0-9]+ at)', 'i' );
		
		// note that when we actually grab threads we're reading UTC formatted dates which have three-letter month abbreviations
		var dates = prompt('Collect dates (regular expression with three letter month abbreviations)', '(([23][0-9]) Apr 2011)|([0-9]+ May 2011)');
		// /(26 Apr 2011)|(27 Apr 2011)|(28 Apr 2011)|(29 Apr 2011)/;
		var date_for_collection = new RegExp( dates, 'i' );
		/***********************
		* end of configuration options
		***********************/
		
		// version info
		var version = 'Facebook History Collector 1.0.1';
		
		var clickCount = 0;
		var subjectId = prompt('Please enter Subject ID', 'test');
		
		if( !subjectId ){
				return;
		}
		
		var w = window.open('','Facebook Scraper','height=300,width=400');
		w.document.write('<!doctype html><html><head><title>Facebook Scraper</title><head><body><pre>');
		function log( msg, noNewLine ){
				if( typeof(msg) == 'undefined' ){
						msg = '';
				}
				if( !noNewLine ){
						msg += '<br/>';
				}
				w.document.write( msg );
				w.scrollTo(0,1000000);
		}
		
		function finishLog(){
			log();
			log( 'Done.' );
			log();
			log( 'To preserve everything here: <b>Select All</b>, <b>Copy</b>, and then <b>Paste</b> into <b>TextEdit</b> in <b>Rich Text</b> mode and then be sure to <b>Save</b>.' );
			w.document.write('</pre></body></html>');
			w.document.close();
			w.focus();
		}
		
		// Record subject ID, date of collection, and version of software
		log( '<b>Subject ID</b>: ' + subjectId );
		
		var d = new Date();
		log( '<b>Date</b>: ' + d.getUTCDate() );
		
		log( '<b>Version</b>: ' + version );
		
		// utility function to synthesize a click event on a non-form element
		function synthetic_click( elt ){
			var evt = document.createEvent('MouseEvents');
			evt.initMouseEvent(
					'click', true, true,
					document.defaultView, 1, 0, 0, 0, 0, 
					false, false, false, false, 0, null
			);
			elt.dispatchEvent(evt);
		}
		
		// This function clicks "Older Posts" until it sees date_stop_searching
		function LoadOlderPosts(){
				// profile_pager is the id of the div containing the "Older Posts" link
				var e = document.getElementById('profile_pager');
				if(e){
						// we're looking for the loading animation
						var b = e.querySelector('.async_saving');
						if( b ){
								log( '+', true );
						} else {
								// simplest way to grab the "Older Posts" link
								var b = e.querySelector('a.pam');
								if( b.innerHTML == 'Older Posts' ){
										// synthesize a mouse click on "Older Posts"
										synthetic_click( b );
										log( '.', true );
								} else {
										alert('Error: cannot find Older Posts link.');
										return;
								}
						}
				} else {
						alert('Error: cannot find Profile Pager. Possibly you are not in a Facebook Profile.');
						return;
				}
				window.scrollTo(0,1000000);
				
				// continue until the date is far enough back
				if( document.body.innerHTML.search( date_stop_searching ) == -1 ){
						setTimeout(LoadOlderPosts,1000);
				} else {
						// OK, we've finished expanding. Time to collect some data
						log();
						CollectData();
				}
		}
		
		function CollectData(){
			var list = document.body.querySelectorAll('.genericStreamStory');
			
			// filter list down to those with matching dates
			var expandQueue = [];
			var printQueue = [];
			var threadCount = 0;
			var nameList = []; // list of names of people in threads
			
			for( var i in list ){
				if( list[i].querySelector ){
					var src = list[i].querySelector('.uiStreamSource abbr');
					if( src && src.getAttribute( 'data-date' ).search( date_for_collection ) != -1 ){
						expandQueue.push( list[i] );
					}
				}
			}
			log( 'found ' + expandQueue.length + ' threads of total ' + list.length );
			
			// expand all the threads
			function expandThread(){
				while( expandQueue.length > 0 ){
					var thread = expandQueue.pop();
					printQueue.push( thread );
					var viewAllButton = thread.querySelector('input[name="view_all[1]"]');
					if( viewAllButton ){
						viewAllButton.click();
						log( '.', true );
						// give browser a second to catch its breath
						setTimeout( expandThread, 1000 );
						return;
					}
				}
				if( expandQueue.length == 0 ){
					// OK, we're done expanding. Time to actually print out the data
					log();
					printThread();
				}
			}
			
			function actorId( elt ){
				// given an element, provides a unique (anonymized) actorId
				if( elt ){
					var actor = elt.innerHTML;
					if( nameList.indexOf(actor) == -1 ){
						nameList.push( actor );
					}
					return nameList.indexOf(actor);
				} else {
					return -1;
				}
			}
			
			function countLikes( elt ){
				if( elt ){
					/*
						1 person likes this
						fred, bob and darren like this
						fred and 4 others like this
						tom, dick, harry and 4 others like thisk
					*/
					var count = 0;
					var src = elt.innerHTML
					var parts = src.split(',');
					count = parts.length;
					parts = parts.pop();
					if( parts.search(/and/) > -1 ){
						count++;
					}
					parts = parts.match(/[0-9]+ (other|people|person)/);
					if( parts != null ){
						count += parseInt( parts ) - 1;
					}
					return count + ' (' + src + ')';
				} else {
					return '0';
				}
			}
			
			function printThread(){
				if( printQueue.length > 0 ){
					var thread = printQueue.pop();
					
					threadCount++;
					log();
					log( 'Thread: ' + threadCount );
					
					var elt, actor, messageBody, likes, postDate, attachment, attachment_elt, images, image_url;
					
					// print out the first comment
					elt = thread.querySelector('.uiStreamMessage');
					actor = actorId(elt.querySelector('.actorName a,.passiveName'));
					try{
						messageBody = elt.querySelector('.messageBody').innerHTML;
					} catch(e){
						messageBody = '';
					}
					attachment_elt = elt.parentNode.querySelector('.uiStreamAttachments');
					if( attachment_elt ){
						var e;
						e = attachment_elt.querySelector('.uiAttachmentTitle strong a');
						attachment = e ? 'Attachment Title: ' + e.innerHTML + '<br>' + 'Attachment URL: ' + e.getAttribute('href') : '' ;
						e = attachment_elt.querySelector('.uiAttachmentDesc');
						if( e ){
							attachment += '<br>Attachment Description: ' + e.innerHTML;
						}
						e = attachment_elt.querySelector('.uiPhotoThumb img');
						if( e ){
							images = attachment_elt.querySelectorAll('.uiPhotoThumb img');
							for( var i = 0; i < images.length; i++ ){
								image_url = images[i].getAttribute('src').replace(/_s\.jpg/, '_n.jpg');
								attachment += '<br><img style="max-width: 400px;" src="' + image_url + '" />';
								attachment += '<br>Attachment Image URL: ' + image_url;
							}
						}
						e = attachment_elt.querySelectorAll('.uiAttachmentPhotobox');
						if( e ){
							images = attachment_elt.querySelectorAll('.uiMediaThumb i');
							for( var i = 0; i < images.length; i++ ){
								//http://a3.sphotos.ak.fbcdn.net/hphotos-ak-ash4/s320x320/225899_10100727172287753_5209930_68635635_1344059_n.jpg
								//http://a3.sphotos.ak.fbcdn.net/hphotos-ak-ash4/225899_10100727172287753_5209930_68635635_1344059_n.jpg
								image_url = images[i].getAttribute('style').replace(/background\-image: url\(/, '');
								image_url = image_url.replace(/s[0-9]+x[0-9]+\//, '');
								image_url = image_url.substr(0, image_url.indexOf(');') );
								attachment += '<br><img style="max-width: 400px;" src="' + image_url + '" />';
								attachment += '<br>Attachment Image URL: ' + image_url;
							}
						}
					} else {
						attachment = false;
					}
					
					postDate = thread.querySelector('.uiStreamSource abbr').getAttribute('data-date');
					
					likes = thread.querySelector('.uiUfiLike .UIImageBlock_Content');
					likes = countLikes( likes );
					
					log( 'Message: [' + actor + '] ' + messageBody );
					if( attachment ){
						log( attachment );
					}
					log( 'Date: ' + postDate );
					log( 'Likes: ' + likes );
					
					// print out all responses
					var comments = thread.querySelectorAll('.commentContent');
					for( var i = 0; i < comments.length; i++ ){
						actor = actorId(comments[i].querySelector('.actorName'));
						messageBody = comments[i].querySelector('span[data-jsid="text"]').innerHTML;
						postDate = comments[i].querySelector('.commentActions abbr').getAttribute('data-date');
						
						try {
							likes = comments[i].querySelector('.comment_like_button');
							likes = likes ? parseInt((likes.innerHTML.match(/[0-9]+\s/))[0]) : '0' ;
						} catch(e) {
							likes = 0;
						}
						log( '-- Message: [' + actor + '] ' + messageBody );
						log( '-- Date: ' + postDate );
						log( '-- Likes: ' + likes );
					}
					
					setTimeout( printThread, 100 );
				} else {
					log();
					log('Names');
					for( var i = 0; i < nameList.length; i++ ){
						log( '[' + i + '] ' + nameList[i] );
					}
					console.log( nameList );
					
					finishLog();
				}
			}
			
			log('Expanding Threads');
			setTimeout( expandThread, 1000 );
		}
		
		log( 'Loading Older Posts' );
		LoadOlderPosts();
}

function handleMessage( event ){
		switch( event.name ){
				case 'GetFBData':
						GetFBData();
						break;
		}
}

safari.self.addEventListener("message", handleMessage, false);