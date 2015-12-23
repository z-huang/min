//http://stackoverflow.com/a/5086688/4603285

jQuery.fn.insertAt = function (index, element) {
	var lastIndex = this.children().size()
	if (index < 0) {
		index = Math.max(0, lastIndex + 1 + index)
	}
	this.append(element)
	if (index < lastIndex) {
		this.children().eq(index).before(this.children().last())
	}
	return this;
}

var tabContainer = $(".tab-group");
var tabGroup = $(".tab-group #tabs"); //TODO these names are confusing

/* tab events */

var lastTabDeletion = 0;

tabGroup.on("mousewheel", ".tab-item", function (e) {
	if (e.originalEvent.deltaY > 65 && e.originalEvent.deltaX < 10 && Date.now() - lastTabDeletion > 650) { //swipe up to delete tabs

		var tab = $(this).attr("data-tab");

		//TODO this should be a css animation
		getTabElement(tab).animate({
			"margin-top": "-40px",
		}, 125, function () {

			if (tab == tabs.getSelected()) {
				var currentIndex = tabs.getIndex(tabs.getSelected());
				var nextTab = tabs.getAtIndex(currentIndex + 1) || tabs.getAtIndex(currentIndex - 1);

				destroyTab(tab);

				if (nextTab) {
					switchToTab(nextTab.id);
				} else {
					addTab();
				}

			} else {
				destroyTab(tab);
			}

		});

		lastTabDeletion = Date.now();
	}

	if (e.originalEvent.deltaY > 0) { //downward swipes should still be handled by expandedTabMode.js
		e.stopPropagation(); //prevent the event from bubbling up to expandedTabMode.js, where exitExpandedMode would be triggered
	}

});

//click to enter edit mode or switch to tab

tabGroup.on("click", ".tab-item", function (e) {
	var tabId = $(this).attr("data-tab");

	//if the tab isn't focused
	if (tabs.getSelected() != tabId) {
		switchToTab(tabId);
	} else if (!isExpandedMode) { //the tab is focused, edit tab instead
		enterEditMode(tabId);
	}

});

/* draws tabs and manages tab events */

function getTabElement(id) { //gets the DOM element for a tab
	return $(".tab-item[data-tab={id}]".replace("{id}", id))
}

//gets the input for a tab element

$.fn.getInput = function () {
	return this.find(".tab-input");
}

function setActiveTabElement(tabId) {
	$(".tab-item").removeClass("active");

	var el = getTabElement(tabId);
	el.addClass("active");

	if (tabs.count() > 1) { //if there is only one tab, we don't need to indicate which one is selected
		el.addClass("has-highlight");
	} else {
		el.removeClass("has-highlight");
	}

	if (!isExpandedMode) {

		requestIdleCallback(function () {
			el[0].scrollIntoView({
				behavior: "smooth"
			});
		}, {
			timeout: 1000
		});

	}

}

function leaveTabEditMode(options) {
	$(".tab-item").removeClass("selected");
	options && options.blur && $(".tab-item .tab-input").blur();
	tabGroup.removeClass("has-selected-tab");
	hideAwesomebar();
}

function enterEditMode(tabId) {

	leaveExpandedMode();

	var tabEl = getTabElement(tabId);
	var webview = getWebview(tabId)[0];

	//when editing a tab, show the current page url. Sometimes, if the webview was just created, getting the URL can throw an error. If this happens, we fallback to whatever was there already.
	try {
		var currentURL = webview.getURL();
	} catch (e) {
		console.warn("failed to get webview URL");
		var currentURL = null;
	}

	var input = tabEl.getInput();

	tabEl.addClass("selected");
	input.val(currentURL);
	input.get(0).focus();
	input.select();
	showAwesomebar(input);
	showAwesomebarResults("", input, null);
	tabGroup.addClass("has-selected-tab");

	//show keyword suggestions in the awesomebar

	try { //before first webview navigation, this will be undefined
		getWebview(tabs.getSelected())[0].send("getKeywordsData");
	} catch (e) {

	}
}

function rerenderTabElement(tabId) {
	var tabEl = getTabElement(tabId),
		tabData = tabs.get(tabId);

	var tabTitle = tabData.title || "New Tab";
	tabEl.find(".tab-view-contents .title").text(tabTitle).attr("title", tabTitle);

	var secIcon = tabEl[0].getElementsByClassName("icon-tab-is-secure");

	if (tabData.secure) {
		if (!secIcon[0]) {
			tabEl.find(".tab-view-contents").prepend("<i class='fa fa-lock icon-tab-is-secure'></i>");
		}
	} else if (secIcon[0]) {
		secIcon[0].parentNode.removeChild(secIcon[0]);
	}

	//update the star to reflect whether the page is bookmarked or not
	bookmarks.renderStar(tabId, tabEl.find(".bookmarks-button"));
}

function createTabElement(tabId) {
	var data = tabs.get(tabId),
		url = urlParser.parse(data.url);

	var tab = $("<div class='tab-item'>");
	tab.attr("data-tab", tabId);

	if (data.private) {
		tab.addClass("private-tab");
	}

	var ec = $("<div class='tab-edit-contents'>");

	var input = $("<input class='tab-input mousetrap'>");
	input.attr("placeholder", "Search or enter address");
	input.attr("value", url);

	input.appendTo(ec);
	bookmarks.getStar(tabId).appendTo(ec);

	ec.appendTo(tab);

	var vc = $("<div class='tab-view-contents'>")
	readerView.getButton(tabId).appendTo(vc);

	if (data.private) {
		vc.prepend("<i class='fa fa-ban icon-tab-is-private'></i>").attr("title", "Private tab");
	}

	vc.append($("<span class='title'>").text(data.title || "New Tab"));

	vc.append("<span class='secondary-text'></span>");
	vc.appendTo(tab);



	/* events */

	input.on("keydown", function (e) {
		if (e.keyCode == 9 || e.keyCode == 40) { //if the tab or arrow down key was pressed
			focusAwesomebarItem();
			e.preventDefault();
		}
	});

	//keypress doesn't fire on delete key - use keyup instead
	input.on("keyup", function (e) {
		if (e.keyCode == 8) {
			showAwesomebarResults($(this).val(), $(this), e);
		}
	});

	input.on("keypress", function (e) {

		if (e.keyCode == 13) { //return key pressed; update the url
			var tabId = $(this).parents(".tab-item").attr("data-tab");
			var newURL = parseAwesomebarURL($(this).val());

			navigate(tabId, newURL);
			leaveTabEditMode(tabId);

		} else if (e.keyCode == 9) {
			return;
			//tab key, do nothing - in keydown listener
		} else if (e.keyCode == 16) {
			return;
			//shift key, do nothing
		} else if (e.keyCode == 8) {
			return;
			//delete key is handled in keyUp
		} else { //show the awesomebar
			showAwesomebarResults($(this).val(), $(this), e);
		}

		//on keydown, if the autocomplete result doesn't change, we move the selection instead of regenerating it to avoid race conditions with typing. Adapted from https://github.com/patrickburke/jquery.inlineComplete

		var v = String.fromCharCode(e.keyCode).toLowerCase();
		var sel = this.value.substring(this.selectionStart, this.selectionEnd).indexOf(v);

		if (v && sel == 0) {
			this.selectionStart += 1;
			didFireKeydownSelChange = true;
			return false;
		} else {
			didFireKeydownSelChange = false;
		}
	});

	//prevent clicking in the input from re-entering edit-tab mode

	input.on("click", function (e) {
		e.stopPropagation();
	});

	return tab;
}

function addTab(tabId, options) {

	/* options 
	
						options.focus - whether to enter editing mode when the tab is created. Defaults to true.
						options.openInBackground - whether to open the tab without switching to it. Defaults to false.
						options.leaveEditMode - whether to hide the awesomebar when creating the tab
	
						*/

	options = options || {}

	if (options.leaveEditMode != false) {
		leaveTabEditMode(); //if a tab is in edit-mode, we want to exit it
	}

	tabId = tabId || tabs.add();

	//use the correct new tab colors

	var tab = tabs.get(tabId);

	if (tab.private && !tab.backgroundColor) {
		tabs.update(tabId, {
			backgroundColor: defaultColors.private[0],
			foregroundColor: defaultColors.private[1]
		});
	} else if (!tab.backgroundColor) {
		tabs.update(tabId, {
			backgroundColor: defaultColors.regular[0],
			foregroundColor: defaultColors.regular[1]
		});
	}

	var index = tabs.getIndex(tabId);
	tabGroup.insertAt(index, createTabElement(tabId));

	addWebview(tabId, {
		openInBackground: options.openInBackground, //if the tab is being opened in the background, the webview should be as well
	});

	browserEvents.emit("addTab");

	//open in background - we don't want to enter edit mode or switch to tab

	if (options.openInBackground) {
		return;
	}

	switchToTab(tabId);
	if (options.focus != false) {
		enterEditMode(tabId)
	}
}

//startup state is created in sessionRestore.js

//when we click outside the navbar, we leave editing mode

bindWebviewEvent("focus", function () {
	leaveExpandedMode();
	leaveTabEditMode();
});
